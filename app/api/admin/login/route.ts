import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, adminCookieOptions, createAdminSessionToken } from '@/lib/adminSession'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), adminCookieOptions)
  return res
}
