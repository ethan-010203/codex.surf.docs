import { NextResponse } from 'next/server'

import { getAdminSubscriptionPlans, getAuthUser } from '@/lib/auth'
import { getCodeSummary, listCodes, listRecentActivations } from '@/lib/codex-surf'

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

    const [summary, codeList, recentActivations, subscriptionPlans] = await Promise.all([
      getCodeSummary(),
      listCodes({ status, search, page, pageSize }),
      listRecentActivations(8),
      getAdminSubscriptionPlans(user),
    ])

    return NextResponse.json({
      success: true,
      user,
      summary,
      recentActivations,
      subscriptionPlans,
      codes: codeList.codes,
      pagination: {
        page,
        pageSize: Math.min(100, pageSize),
        total: codeList.total,
        totalPages: Math.max(1, Math.ceil(codeList.total / Math.min(100, pageSize))),
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
