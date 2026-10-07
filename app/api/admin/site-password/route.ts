import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { isValidSitePassword, setSitePassword } from '@/lib/sitePassword'

// 一般パスワード（サイト入場用）を変更する。現在のパスワードは返さない
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { password } = await req.json()
  if (!isValidSitePassword(password)) return NextResponse.json({ error: 'invalid request' }, { status: 400 })

  try {
    await setSitePassword(password)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
