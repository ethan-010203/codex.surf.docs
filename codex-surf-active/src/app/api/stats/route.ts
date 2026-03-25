import { NextResponse } from 'next/server'

import { getCodeSummary } from '@/lib/codex-surf'

export async function GET() {
  try {
    const summary = await getCodeSummary()

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    console.error('Public stats error:', error)
    return NextResponse.json(
      { success: false, message: '读取统计信息失败' },
      { status: 500 }
    )
  }
}
