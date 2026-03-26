import { NextResponse } from 'next/server'

import { getAdminSubscriptionPlans, getAuthUser } from '@/lib/auth'
import { getCodeSummary, listCodes, listRecentActivations } from '@/lib/codex-surf'
import { SupabaseConfigError } from '@/lib/supabase'

const EMPTY_SUMMARY = {
  total: 0,
  activated: 0,
  unused: 0,
  disabled: 0,
  activatedToday: 0,
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Unknown error.'
}

function formatDataWarning(scope: string, error: unknown): string {
  const message = formatErrorMessage(error)
  const lowerCaseMessage = message.toLowerCase()

  if (error instanceof SupabaseConfigError) {
    return (
      'Activation code storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and '
      + 'SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in Cloudflare first.'
    )
  }

  if (
    lowerCaseMessage.includes('does not exist')
    || lowerCaseMessage.includes('could not find the table')
    || lowerCaseMessage.includes('schema cache')
  ) {
    return 'Activation code storage table is missing. Create the codex_activation_codes table in Supabase first.'
  }

  return `${scope} unavailable: ${message}`
}

async function loadWithWarning<T>(
  scope: string,
  loader: () => Promise<T>,
  fallback: T
): Promise<{ value: T; warning: string }> {
  try {
    return {
      value: await loader(),
      warning: '',
    }
  } catch (error) {
    console.error(`${scope} error:`, error)

    return {
      value: fallback,
      warning: formatDataWarning(scope, error),
    }
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

export async function GET(request: Request) {
  const user = await getAuthUser(request)

  if (!user) {
    return NextResponse.json(
      { success: false, message: '未登录或登录已失效。' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''
    const statusParam = searchParams.get('status') ?? 'all'
    const status =
      statusParam === 'unused' || statusParam === 'activated' || statusParam === 'disabled'
        ? statusParam
        : 'all'

    const page = parsePositiveInt(searchParams.get('page'), 1)
    const pageSize = parsePositiveInt(searchParams.get('pageSize'), 25)

    const [summaryResult, codeListResult, recentActivationsResult, subscriptionPlansResult] = await Promise.all([
      loadWithWarning('Load activation code summary', () => getCodeSummary(), EMPTY_SUMMARY),
      loadWithWarning(
        'Load activation code list',
        () => listCodes({ status, search, page, pageSize }),
        { codes: [], total: 0 }
      ),
      loadWithWarning('Load recent activations', () => listRecentActivations(8), []),
      getAdminSubscriptionPlans(user)
        .then((plans) => ({
          plans,
          warning: '',
        }))
        .catch((error) => {
          console.error('Load subscription plans error:', error)

          return {
            plans: [],
            warning:
              error instanceof Error
                ? `套餐列表加载失败：${error.message}`
                : '套餐列表加载失败，请检查 newapi 订阅套餐接口是否可用。',
          }
        }),
    ])

    const warningMessages = [
      summaryResult.warning,
      codeListResult.warning,
      recentActivationsResult.warning,
      subscriptionPlansResult.warning,
    ].filter(Boolean)

    const warning = Array.from(new Set(warningMessages)).join(' ')

    return NextResponse.json({
      success: true,
      user,
      summary: summaryResult.value,
      recentActivations: recentActivationsResult.value,
      subscriptionPlans: subscriptionPlansResult.plans,
      warning: warning || undefined,
      codes: codeListResult.value.codes,
      pagination: {
        page,
        pageSize: Math.min(100, pageSize),
        total: codeListResult.value.total,
        totalPages: Math.max(1, Math.ceil(codeListResult.value.total / Math.min(100, pageSize))),
      },
    })
  } catch (error) {
    console.error('List codes error:', error)

    return NextResponse.json(
      { success: false, message: '加载激活码数据失败。' },
      { status: 500 }
    )
  }
}
