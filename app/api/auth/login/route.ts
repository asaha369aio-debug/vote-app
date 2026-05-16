import { NextRequest, NextResponse } from 'next/server'

// サイト閲覧用パスワードを検証するAPIエンドポイント
export async function POST(req: NextRequest) {
  const { password } = await req.json()
  // 環境変数 SITE_PASSWORD と照合する
  if (password === process.env.SITE_PASSWORD) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}
