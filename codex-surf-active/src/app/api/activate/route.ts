import { NextResponse } from 'next/server'

import {
  assignSubscriptionPlanToUser,
  getCurrentUser,
  NewApiAdminConfigError,
} from '@/lib/auth'
import {
  activateCode,
  getCodeRecordByCode,
  normalizeAccountIdentifier,
  normalizeActivationCode,
} from '@/lib/codex-surf'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string
    }

    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { success: false, message: '请先登录后再兑换激活码。' },
        { status: 401 }
      )
    }

    const account = normalizeAccountIdentifier(user.username)
    const code = normalizeActivationCode(body.code ?? '')

    if (!account) {
      return NextResponse.json(
        { success: false, message: '未获取到当前登录账号。' },
        { status: 400 }
      )
    }

    if (!code) {
      return NextResponse.json(
        { success: false, message: '请输入激活码。' },
        { status: 400 }
      )
    }

    const codeRecord = await getCodeRecordByCode(code)

    if (!codeRecord) {
      return NextResponse.json(
        { success: false, message: '激活码不存在。' },
        { status: 400 }
      )
    }

    if (codeRecord.status === 'disabled') {
      return NextResponse.json(
        { success: false, message: '该激活码已被停用。' },
        { status: 400 }
      )
    }

    if (codeRecord.status === 'activated') {
      if (codeRecord.activated_account === account) {
        return NextResponse.json({
          success: true,
          alreadyActivated: true,
          message: '该账号已经使用过这枚激活码。',
          record: codeRecord,
        })
      }

      return NextResponse.json(
        {
          success: false,
          message: `该激活码已绑定到 ${codeRecord.activated_account ?? '其他账号'}。`,
        },
        { status: 400 }
      )
    }

    const subscriptionPlanId = Number(codeRecord.subscription_plan_id ?? 0)

    if (!Number.isInteger(subscriptionPlanId) || subscriptionPlanId <= 0) {
      return NextResponse.json(
        { success: false, message: '该激活码未绑定套餐，请联系管理员处理。' },
        { status: 400 }
      )
    }

    const provisionMessage = await assignSubscriptionPlanToUser(user.id, subscriptionPlanId)
    const result = await activateCode({ account, code })

    return NextResponse.json({
      success: true,
      alreadyActivated: result.alreadyActivated,
      message:
        result.alreadyActivated
          ? '该账号已经使用过这枚激活码。'
          : provisionMessage
            ? `激活成功，${provisionMessage}`
            : '激活成功。',
      record: result.record,
    })
  } catch (error) {
    console.error('Activate code error:', error)

    const rawMessage = error instanceof Error ? error.message : '激活失败，请稍后重试。'
    const message =
      rawMessage.toLowerCase().includes('fetch failed') || rawMessage.toLowerCase().includes('econnreset')
        ? '连接 newapi 失败，请稍后重试一次。'
        : rawMessage
    const status = error instanceof NewApiAdminConfigError ? 500 : 400

    return NextResponse.json({ success: false, message }, { status })
  }
}
