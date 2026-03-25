import { NextResponse } from 'next/server'

import { verifyUserCredentials } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string
      password?: string
    }

    const result = await verifyUserCredentials(body.username ?? '', body.password ?? '')

    if (!result.success || !result.user) {
      return NextResponse.json(
        { success: false, message: result.error ?? '登录失败。' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      token: result.user.accessToken,
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
    })
  } catch (error) {
    console.error('User login error:', error)

    return NextResponse.json(
      { success: false, message: '登录失败，请稍后重试。' },
      { status: 500 }
    )
  }
}
