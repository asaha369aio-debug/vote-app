import { NextRequest, NextResponse } from 'next/server'
import { verifySitePassword } from '@/lib/sitePassword'

// サイト閲覧用パスワードを検証するAPIエンドポイント
export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (typeof password !== 'string') return NextResponse.json({ ok: false }, { status: 401 })
  // 管理者が設定したパスワード（未設定なら環境変数 SITE_PASSWORD）と照合する
  try {
    if (await verifySitePassword(password)) return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('site password verification failed:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}
