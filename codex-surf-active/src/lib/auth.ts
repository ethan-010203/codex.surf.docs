interface NewApiAuthResponse<T> {
  success?: boolean
  message?: string
  data?: T
}

interface NewApiLoginData {
  id: number
  username: string
  role: number
  status: number
  group?: string
  require_2fa?: boolean
}

interface NewApiSelfData {
  id: number
  username: string
  role: number
  status: number
  group?: string
}

interface NewApiSubscriptionPlan {
  id: number
  title: string
  subtitle?: string
  enabled: boolean
  price_amount: number
  currency: string
  duration_unit: string
  duration_value: number
  total_amount: number
  quota_reset_period: string
}

interface NewApiSubscriptionPlanItem {
  plan?: NewApiSubscriptionPlan
}

interface NewApiAdminMutationData {
  message?: string
}

export interface AuthUser {
  id: string
  username: string
  role: number
  status: number
  accessToken: string
}

export interface SubscriptionPlanOption {
  id: number
  title: string
  subtitle: string
  enabled: boolean
  priceAmount: number
  currency: string
  durationUnit: string
  durationValue: number
  totalAmount: number
  quotaResetPeriod: string
}

export class NewApiAdminConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NewApiAdminConfigError'
  }
}

const ROLE_ADMIN_USER = 10
const USER_STATUS_ENABLED = 1
const NETWORK_RETRY_ATTEMPTS = 3
const NETWORK_RETRY_DELAY_MS = 350

function getNewApiBaseUrl(): string {
  const baseUrl =
    process.env.NEWAPI_BASE_URL?.trim() ?? process.env.NEXT_PUBLIC_NEWAPI_BASE_URL?.trim() ?? ''

  if (!baseUrl) {
    throw new Error('Missing NEWAPI_BASE_URL. Please configure the newapi server address first.')
  }

  return baseUrl.replace(/\/+$/, '')
}

function normalizeCredential(value: string): string {
  return value.trim()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return ''
  }

  const maybeCode = 'code' in error ? error.code : ''
  return typeof maybeCode === 'string' ? maybeCode : ''
}

function getErrorCause(error: unknown): unknown {
  if (!error || typeof error !== 'object' || !('cause' in error)) {
    return null
  }

  return error.cause
}

function formatNetworkError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Network request failed.'
  }

  const pieces = [error.message]
  let cause = getErrorCause(error)

  while (cause instanceof Error) {
    if (cause.message && !pieces.includes(cause.message)) {
      pieces.push(cause.message)
    }
    cause = getErrorCause(cause)
  }

  const code = getErrorCode(error) || (cause ? getErrorCode(cause) : '')

  if (code && !pieces.some((item) => item.includes(code))) {
    pieces.push(code)
  }

  return pieces.filter(Boolean).join(' | ')
}

function isRetriableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const text = formatNetworkError(error).toLowerCase()

  return (
    text.includes('fetch failed') ||
    text.includes('econnreset') ||
    text.includes('etimedout') ||
    text.includes('eai_again') ||
    text.includes('enotfound') ||
    text.includes('socket') ||
    text.includes('tls')
  )
}

async function fetchWithRetry(
  input: string,
  init: RequestInit,
  label: string
): Promise<Response> {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(input, init)
    } catch (error) {
      lastError = error

      if (!isRetriableNetworkError(error) || attempt >= NETWORK_RETRY_ATTEMPTS) {
        throw error
      }

      console.warn(
        `[codex_surf] ${label} failed on attempt ${attempt}/${NETWORK_RETRY_ATTEMPTS}: ${formatNetworkError(error)}`
      )
      await sleep(NETWORK_RETRY_DELAY_MS * attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`)
}

function extractCookieHeader(response: Response): string {
  const rawCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')
        ? [response.headers.get('set-cookie') as string]
        : []

  return rawCookies
    .map((cookie) => cookie.split(';', 1)[0]?.trim())
    .filter(Boolean)
    .join('; ')
}

async function readJson<T>(response: Response): Promise<NewApiAuthResponse<T>> {
  try {
    return (await response.json()) as NewApiAuthResponse<T>
  } catch {
    return {
      success: false,
      message: 'Invalid response from newapi.',
    }
  }
}

async function loginToNewApi(username: string, password: string) {
  const response = await fetchWithRetry(
    `${getNewApiBaseUrl()}/api/user/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ username, password }),
      redirect: 'manual',
    },
    'newapi login'
  )

  return {
    ok: response.ok,
    cookieHeader: extractCookieHeader(response),
    payload: await readJson<NewApiLoginData>(response),
  }
}

async function createNewApiAccessToken(userId: number, cookieHeader: string) {
  const response = await fetchWithRetry(
    `${getNewApiBaseUrl()}/api/user/token`,
    {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
        'Cache-Control': 'no-store',
        'New-Api-User': String(userId),
      },
    },
    'newapi access token'
  )

  return {
    ok: response.ok,
    payload: await readJson<string>(response),
  }
}

async function fetchNewApiSelf(accessToken: string, userId: string) {
  const response = await fetchWithRetry(
    `${getNewApiBaseUrl()}/api/user/self`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-store',
        'New-Api-User': userId,
      },
    },
    'newapi self profile'
  )

  return {
    ok: response.ok,
    payload: await readJson<NewApiSelfData>(response),
  }
}

async function fetchNewApiAdminPlans(accessToken: string, userId: string) {
  const response = await fetchWithRetry(
    `${getNewApiBaseUrl()}/api/subscription/admin/plans`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-store',
        'New-Api-User': userId,
      },
    },
    'newapi admin plans'
  )

  return {
    ok: response.ok,
    payload: await readJson<NewApiSubscriptionPlanItem[]>(response),
  }
}

async function createNewApiAdminSubscription(
  accessToken: string,
  adminUserId: string,
  targetUserId: string,
  planId: number
) {
  const response = await fetchWithRetry(
    `${getNewApiBaseUrl()}/api/subscription/admin/users/${targetUserId}/subscriptions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
        'New-Api-User': adminUserId,
      },
      body: JSON.stringify({
        plan_id: planId,
      }),
    },
    'newapi create subscription'
  )

  return {
    ok: response.ok,
    payload: await readJson<NewApiAdminMutationData | null>(response),
  }
}

function isEnabledUser(data: Pick<NewApiSelfData, 'status'>): boolean {
  return data.status === USER_STATUS_ENABLED
}

function isAdminUser(data: Pick<NewApiSelfData, 'role' | 'status'>): boolean {
  return data.role >= ROLE_ADMIN_USER && isEnabledUser(data)
}

function buildAuthUser(data: NewApiSelfData, accessToken: string): AuthUser {
  return {
    id: String(data.id),
    username: data.username,
    role: data.role,
    status: data.status,
    accessToken,
  }
}

function normalizeSubscriptionPlan(item: NewApiSubscriptionPlanItem): SubscriptionPlanOption | null {
  const plan = item.plan

  if (!plan?.id) {
    return null
  }

  return {
    id: plan.id,
    title: plan.title,
    subtitle: plan.subtitle ?? '',
    enabled: Boolean(plan.enabled),
    priceAmount: Number(plan.price_amount ?? 0),
    currency: plan.currency ?? 'USD',
    durationUnit: plan.duration_unit ?? 'month',
    durationValue: Number(plan.duration_value ?? 1),
    totalAmount: Number(plan.total_amount ?? 0),
    quotaResetPeriod: plan.quota_reset_period ?? 'never',
  }
}

async function verifyNewApiCredentials(
  username: string,
  password: string,
  options: { adminOnly?: boolean } = {}
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const normalizedUsername = normalizeCredential(username)
  const normalizedPassword = normalizeCredential(password)

  if (!normalizedUsername || !normalizedPassword) {
    return { success: false, error: 'Please enter a username and password.' }
  }

  try {
    const loginResult = await loginToNewApi(normalizedUsername, normalizedPassword)
    const loginData = loginResult.payload.data

    if (!loginResult.ok || !loginResult.payload.success || !loginData) {
      return {
        success: false,
        error: loginResult.payload.message ?? 'newapi login failed.',
      }
    }

    if (loginData.require_2fa) {
      return {
        success: false,
        error: 'This account requires 2FA. codex_surf does not support the 2FA flow yet.',
      }
    }

    if (!loginResult.cookieHeader) {
      return {
        success: false,
        error: 'newapi login succeeded but no session cookie was returned.',
      }
    }

    const tokenResult = await createNewApiAccessToken(loginData.id, loginResult.cookieHeader)
    const accessToken = tokenResult.payload.data

    if (!tokenResult.ok || !tokenResult.payload.success || !accessToken) {
      return {
        success: false,
        error: tokenResult.payload.message ?? 'Failed to generate newapi access token.',
      }
    }

    const selfResult = await fetchNewApiSelf(accessToken, String(loginData.id))
    const selfData = selfResult.payload.data

    if (!selfResult.ok || !selfResult.payload.success || !selfData) {
      return {
        success: false,
        error: selfResult.payload.message ?? 'Failed to verify newapi user session.',
      }
    }

    if (!isEnabledUser(selfData)) {
      return {
        success: false,
        error: 'This newapi account has been disabled.',
      }
    }

    if (options.adminOnly && !isAdminUser(selfData)) {
      return {
        success: false,
        error: 'Only newapi admin accounts can access this backend.',
      }
    }

    return {
      success: true,
      user: buildAuthUser(selfData, accessToken),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to newapi.',
    }
  }
}

async function getAuthorizedUserByToken(
  accessToken: string,
  newApiUser: string,
  options: { adminOnly?: boolean } = {}
): Promise<AuthUser | null> {
  if (!accessToken || !newApiUser) {
    return null
  }

  try {
    const selfResult = await fetchNewApiSelf(accessToken, newApiUser)
    const selfData = selfResult.payload.data

    if (!selfResult.ok || !selfResult.payload.success || !selfData) {
      return null
    }

    if (!isEnabledUser(selfData)) {
      return null
    }

    if (options.adminOnly && !isAdminUser(selfData)) {
      return null
    }

    return buildAuthUser(selfData, accessToken)
  } catch {
    return null
  }
}

async function getAuthorizedUser(
  request: Request,
  options: { adminOnly?: boolean } = {}
): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization')
  const newApiUser = request.headers.get('New-Api-User') ?? request.headers.get('New-API-User')

  if (!authHeader?.startsWith('Bearer ') || !newApiUser) {
    return null
  }

  const accessToken = authHeader.slice(7).trim()

  if (!accessToken) {
    return null
  }

  return getAuthorizedUserByToken(accessToken, newApiUser, options)
}

function getConfiguredAdminAccessToken() {
  const accessToken = process.env.NEWAPI_ADMIN_ACCESS_TOKEN?.trim() ?? ''
  const userId = process.env.NEWAPI_ADMIN_USER_ID?.trim() ?? ''

  if (!accessToken || !userId) {
    return null
  }

  return {
    accessToken,
    userId,
  }
}

function getConfiguredAdminCredentials() {
  const username = process.env.NEWAPI_ADMIN_USERNAME?.trim() ?? ''
  const password = process.env.NEWAPI_ADMIN_PASSWORD ?? ''

  if (!username || !password) {
    return null
  }

  return {
    username,
    password,
  }
}

async function getServiceAdminUser(): Promise<AuthUser> {
  const tokenConfig = getConfiguredAdminAccessToken()

  if (tokenConfig) {
    const verifiedUser = await getAuthorizedUserByToken(tokenConfig.accessToken, tokenConfig.userId, {
      adminOnly: true,
    })

    if (verifiedUser) {
      return verifiedUser
    }

    throw new NewApiAdminConfigError(
      'Configured NEWAPI admin access token is invalid or no longer has admin permission.'
    )
  }

  const credentialConfig = getConfiguredAdminCredentials()

  if (credentialConfig) {
    const loginResult = await verifyNewApiCredentials(
      credentialConfig.username,
      credentialConfig.password,
      { adminOnly: true }
    )

    if (loginResult.success && loginResult.user) {
      return loginResult.user
    }

    throw new NewApiAdminConfigError(
      loginResult.error ?? 'Unable to sign in with the configured NEWAPI admin account.'
    )
  }

  throw new NewApiAdminConfigError(
    'Missing NEWAPI admin credentials. Set NEWAPI_ADMIN_ACCESS_TOKEN and NEWAPI_ADMIN_USER_ID, or NEWAPI_ADMIN_USERNAME and NEWAPI_ADMIN_PASSWORD.'
  )
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  return verifyNewApiCredentials(username, password, { adminOnly: true })
}

export async function verifyUserCredentials(
  username: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  return verifyNewApiCredentials(username, password)
}

export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  return getAuthorizedUser(request, { adminOnly: true })
}

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  return getAuthorizedUser(request)
}

export async function getAdminSubscriptionPlans(user: AuthUser): Promise<SubscriptionPlanOption[]> {
  const plansResult = await fetchNewApiAdminPlans(user.accessToken, user.id)
  const rawPlans = plansResult.payload.data

  if (!plansResult.ok || !plansResult.payload.success || !rawPlans) {
    throw new Error(plansResult.payload.message ?? 'Failed to fetch subscription plans from newapi.')
  }

  return rawPlans
    .map(normalizeSubscriptionPlan)
    .filter((plan): plan is SubscriptionPlanOption => plan !== null)
}

export async function assignSubscriptionPlanToUser(
  targetUserId: string | number,
  planId: number
): Promise<string | null> {
  const normalizedUserId = String(targetUserId).trim()

  if (!normalizedUserId) {
    throw new Error('Missing target newapi user id.')
  }

  if (!Number.isInteger(planId) || planId <= 0) {
    throw new Error('A valid subscription plan is required.')
  }

  const adminUser = await getServiceAdminUser()
  const bindResult = await createNewApiAdminSubscription(
    adminUser.accessToken,
    adminUser.id,
    normalizedUserId,
    planId
  )

  if (!bindResult.ok || !bindResult.payload.success) {
    throw new Error(bindResult.payload.message ?? 'Failed to activate subscription in newapi.')
  }

  const data = bindResult.payload.data

  if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim()
  }

  return null
}
