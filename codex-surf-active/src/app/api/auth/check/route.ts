import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'

export async function GET(request: Request) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json(
      { success: false, message: '未登录或登录已失效。' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    success: true,
    user,
  })
}
