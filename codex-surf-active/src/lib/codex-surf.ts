import { getSupabaseClient, isDemoModeEnabled, type ActivationCodeRecord, type ActivationCodeStatus } from './supabase'

const CODE_TABLE = process.env.CODEX_SURF_TABLE || 'codex_activation_codes'
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface CodeListResult {
  codes: ActivationCodeRecord[]
  total: number
}

export interface CodeSummary {
  total: number
  activated: number
  unused: number
  disabled: number
  activatedToday: number
}

interface DemoStore {
  codes: ActivationCodeRecord[]
}

function getDemoStore(): DemoStore {
  const globalScope = globalThis as typeof globalThis & {
    __codexSurfDemoStore?: DemoStore
  }

  if (!globalScope.__codexSurfDemoStore) {
    globalScope.__codexSurfDemoStore = {
      codes: createDemoSeedRecords(),
    }
  }

  return globalScope.__codexSurfDemoStore
}

function createDemoSeedRecords(): ActivationCodeRecord[] {
  const now = Date.now()

  return [
    {
      id: 'demo-activated',
      code: 'SURF-DEMO-A1B2-C3D4',
      status: 'activated',
      subscription_plan_id: 1,
      activated_account: 'preview@codexsurf.dev',
      activated_at: new Date(now - 30 * 60 * 1000).toISOString(),
      batch_id: 'DEMO-BATCH',
      note: 'Preview data',
      created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-unused-1',
      code: 'SURF-DEMO-E5F6-G7H8',
      status: 'unused',
      subscription_plan_id: 1,
      activated_account: null,
      activated_at: null,
      batch_id: 'DEMO-BATCH',
      note: 'Preview data',
      created_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-unused-2',
      code: 'SURF-DEMO-J9K2-L3M4',
      status: 'unused',
      subscription_plan_id: 2,
      activated_account: null,
      activated_at: null,
      batch_id: 'DEMO-BATCH',
      note: 'Preview data',
      created_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-disabled',
      code: 'SURF-DEMO-N5P6-Q7R8',
      status: 'disabled',
      subscription_plan_id: 2,
      activated_account: null,
      activated_at: null,
      batch_id: 'DEMO-BATCH',
      note: 'Preview data',
      created_at: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    },
  ]
}

function cloneRecord(record: ActivationCodeRecord): ActivationCodeRecord {
  return { ...record }
}

function sortRecords(records: ActivationCodeRecord[]): ActivationCodeRecord[] {
  return [...records].sort((left, right) => {
    const leftActivated = left.activated_at ? new Date(left.activated_at).getTime() : -1
    const rightActivated = right.activated_at ? new Date(right.activated_at).getTime() : -1

    if (leftActivated !== rightActivated) {
      return rightActivated - leftActivated
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}

function buildSummary(records: ActivationCodeRecord[]): CodeSummary {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  return {
    total: records.length,
    activated: records.filter((record) => record.status === 'activated').length,
    unused: records.filter((record) => record.status === 'unused').length,
    disabled: records.filter((record) => record.status === 'disabled').length,
    activatedToday: records.filter((record) => {
      return (
        record.activated_at !== null &&
        new Date(record.activated_at).getTime() >= startOfDay.getTime()
      )
    }).length,
  }
}

function includesSearch(record: ActivationCodeRecord, search: string): boolean {
  if (!search) {
    return true
  }

  const normalizedSearch = search.toLowerCase()

  return [
    record.code,
    record.subscription_plan_id ? String(record.subscription_plan_id) : null,
    record.activated_account,
    record.batch_id,
    record.note,
  ].some((value) => value?.toLowerCase().includes(normalizedSearch))
}

function escapeSearchTerm(term: string): string {
  return term.replace(/[%(),]/g, '').trim()
}

export function normalizeActivationCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
}

export function normalizeAccountIdentifier(account: string): string {
  return account.trim()
}

function randomSegment(length = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let output = ''

  for (const byte of bytes) {
    output += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  }

  return output
}

function sanitizePrefix(prefix: string): string {
  return prefix
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function buildActivationCode(prefix = ''): string {
  const normalizedPrefix = sanitizePrefix(prefix)
  const body = [randomSegment(), randomSegment(), randomSegment()].join('-')
  return normalizedPrefix ? `${normalizedPrefix}-${body}` : body
}

export function buildBatchId(): string {
  return `BATCH-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
}

export async function getCodeSummary(): Promise<CodeSummary> {
  if (isDemoModeEnabled()) {
    return buildSummary(getDemoStore().codes)
  }

  const supabase = await getSupabaseClient()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [totalRes, activatedRes, unusedRes, disabledRes, todayRes] = await Promise.all([
    supabase.from(CODE_TABLE).select('id', { count: 'exact', head: true }),
    supabase.from(CODE_TABLE).select('id', { count: 'exact', head: true }).eq('status', 'activated'),
    supabase.from(CODE_TABLE).select('id', { count: 'exact', head: true }).eq('status', 'unused'),
    supabase.from(CODE_TABLE).select('id', { count: 'exact', head: true }).eq('status', 'disabled'),
    supabase
      .from(CODE_TABLE)
      .select('id', { count: 'exact', head: true })
      .gte('activated_at', startOfDay.toISOString()),
  ])

  return {
    total: totalRes.count ?? 0,
    activated: activatedRes.count ?? 0,
    unused: unusedRes.count ?? 0,
    disabled: disabledRes.count ?? 0,
    activatedToday: todayRes.count ?? 0,
  }
}

export async function listCodes(options: {
  status?: 'all' | ActivationCodeStatus
  search?: string
  page?: number
  pageSize?: number
}): Promise<CodeListResult> {
  const status = options.status ?? 'all'
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25))
  const search = escapeSearchTerm(options.search ?? '')

  if (isDemoModeEnabled()) {
    const filtered = sortRecords(getDemoStore().codes).filter((record) => {
      if (status !== 'all' && record.status !== status) {
        return false
      }

      return includesSearch(record, search)
    })

    const from = (page - 1) * pageSize
    const to = from + pageSize

    return {
      codes: filtered.slice(from, to).map(cloneRecord),
      total: filtered.length,
    }
  }

  const supabase = await getSupabaseClient()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dataQuery = supabase
    .from(CODE_TABLE)
    .select('*', { count: 'exact' })
    .order('activated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  let countQuery = supabase.from(CODE_TABLE).select('id', { count: 'exact', head: true })

  if (status !== 'all') {
    dataQuery = dataQuery.eq('status', status)
    countQuery = countQuery.eq('status', status)
  }

  if (search) {
    const like = `%${search}%`
    const filters = [
      `code.ilike.${like}`,
      `activated_account.ilike.${like}`,
      `batch_id.ilike.${like}`,
      `note.ilike.${like}`,
    ]

    if (/^\d+$/.test(search)) {
      filters.push(`subscription_plan_id.eq.${Number(search)}`)
    }

    const filter = filters.join(',')
    dataQuery = dataQuery.or(filter)
    countQuery = countQuery.or(filter)
  }

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    dataQuery,
    countQuery,
  ])

  if (error) {
    throw error
  }

  if (countError) {
    throw countError
  }

  return {
    codes: (data as ActivationCodeRecord[] | null) ?? [],
    total: count ?? 0,
  }
}

export async function listRecentActivations(limit = 8): Promise<ActivationCodeRecord[]> {
  if (isDemoModeEnabled()) {
    return sortRecords(getDemoStore().codes)
      .filter((record) => record.status === 'activated')
      .slice(0, Math.min(50, Math.max(1, limit)))
      .map(cloneRecord)
  }

  const supabase = await getSupabaseClient()
  const { data, error } = await supabase
    .from(CODE_TABLE)
    .select('*')
    .eq('status', 'activated')
    .order('activated_at', { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)))

  if (error) {
    throw error
  }

  return (data as ActivationCodeRecord[] | null) ?? []
}

export async function getCodeRecordByCode(code: string): Promise<ActivationCodeRecord | null> {
  if (isDemoModeEnabled()) {
    const record = getDemoStore().codes.find((item) => item.code === code)
    return record ? cloneRecord(record) : null
  }

  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.from(CODE_TABLE).select('*').eq('code', code).maybeSingle()

  if (error) {
    throw error
  }

  return (data as ActivationCodeRecord | null) ?? null
}

export async function generateCodes(options: {
  count: number
  prefix?: string
  batchId?: string
  note?: string
  subscriptionPlanId: number
}): Promise<ActivationCodeRecord[]> {
  const count = Math.min(200, Math.max(1, options.count))
  const batchId = options.batchId?.trim() || buildBatchId()
  const note = options.note?.trim() || null
  const subscriptionPlanId = Number.isInteger(options.subscriptionPlanId)
    ? options.subscriptionPlanId
    : 0

  if (subscriptionPlanId <= 0) {
    throw new Error('A valid subscription plan is required.')
  }

  if (isDemoModeEnabled()) {
    const store = getDemoStore()
    const existingCodes = new Set(store.codes.map((record) => record.code))
    const results: ActivationCodeRecord[] = []

    while (results.length < count) {
      const code = buildActivationCode(options.prefix)
      if (existingCodes.has(code)) {
        continue
      }

      existingCodes.add(code)

      const record: ActivationCodeRecord = {
        id: crypto.randomUUID(),
        code,
        status: 'unused',
        subscription_plan_id: subscriptionPlanId,
        activated_account: null,
        activated_at: null,
        batch_id: batchId,
        note,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      store.codes.push(record)
      results.push(cloneRecord(record))
    }

    return results
  }

  const supabase = await getSupabaseClient()
  const results: ActivationCodeRecord[] = []
  const seen = new Set<string>()

  while (results.length < count) {
    const code = buildActivationCode(options.prefix)
    if (seen.has(code)) {
      continue
    }

    seen.add(code)

    const payload = {
      code,
      status: 'unused' as const,
      subscription_plan_id: subscriptionPlanId,
      batch_id: batchId,
      note,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from(CODE_TABLE)
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      seen.delete(code)
      if ('code' in error && error.code === '23505') {
        continue
      }
      throw error
    }

    results.push(data as ActivationCodeRecord)
  }

  return results
}

export async function activateCode(options: {
  code: string
  account: string
}): Promise<{
  record: ActivationCodeRecord
  alreadyActivated: boolean
}> {
  const code = normalizeActivationCode(options.code)
  const account = normalizeAccountIdentifier(options.account)

  if (isDemoModeEnabled()) {
    const store = getDemoStore()
    const record = store.codes.find((item) => item.code === code)

    if (!record) {
      throw new Error('Activation code not found.')
    }

    if (record.status === 'disabled') {
      throw new Error('This activation code has been disabled.')
    }

    if (record.status === 'activated') {
      if (record.activated_account === account) {
        return { record: cloneRecord(record), alreadyActivated: true }
      }

      throw new Error(`This activation code is already bound to ${record.activated_account ?? 'another account'}.`)
    }

    const now = new Date().toISOString()
    record.status = 'activated'
    record.activated_account = account
    record.activated_at = now
    record.updated_at = now

    return {
      record: cloneRecord(record),
      alreadyActivated: false,
    }
  }

  const supabase = await getSupabaseClient()
  const { data: existing, error: lookupError } = await supabase
    .from(CODE_TABLE)
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (!existing) {
    throw new Error('Activation code not found.')
  }

  const record = existing as ActivationCodeRecord

  if (record.status === 'disabled') {
    throw new Error('This activation code has been disabled.')
  }

  if (record.status === 'activated') {
    if (record.activated_account === account) {
      return { record, alreadyActivated: true }
    }

    throw new Error(`This activation code is already bound to ${record.activated_account ?? 'another account'}.`)
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from(CODE_TABLE)
    .update({
      status: 'activated',
      activated_account: account,
      activated_at: now,
      updated_at: now,
    })
    .eq('id', record.id)
    .eq('status', 'unused')
    .select('*')
    .maybeSingle()

  if (updateError) {
    throw updateError
  }

  if (!updated) {
    throw new Error('Activation code status changed. Please refresh and try again.')
  }

  return {
    record: updated as ActivationCodeRecord,
    alreadyActivated: false,
  }
}
