import { NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/auth'
import { buildBatchId, generateCodes } from '@/lib/codex-surf'

export async function POST(request: Request) {
  const user = await getAuthUser(request)

  if (!user) {
    return NextResponse.json(
      { success: false, message: '未登录或登录已失效。' },
      { status: 401 }
    )
  }

  try {
    const body = (await request.json()) as {
      count?: number
      prefix?: string
      batchId?: string
      note?: string
      subscriptionPlanId?: number
    }

    const count = Math.min(200, Math.max(1, Number(body.count ?? 1)))
    const batchId = body.batchId?.trim() || buildBatchId()
    const subscriptionPlanId = Number(body.subscriptionPlanId ?? 0)

    if (!Number.isInteger(subscriptionPlanId) || subscriptionPlanId <= 0) {
      return NextResponse.json(
        { success: false, message: '请选择要绑定的套餐。' },
        { status: 400 }
      )
    }

    const codes = await generateCodes({
      count,
      prefix: body.prefix ?? '',
      batchId,
      note: body.note ?? '',
      subscriptionPlanId,
    })

    return NextResponse.json({
      success: true,
      message: `成功生成 ${codes.length} 个激活码。`,
      batchId,
      codes,
    })
  } catch (error) {
    console.error('Generate codes error:', error)

    const message = error instanceof Error ? error.message : '生成激活码失败。'

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
