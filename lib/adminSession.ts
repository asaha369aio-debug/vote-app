import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export const ADMIN_COOKIE_NAME = 'admin_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7日

function sign(payload: string): string {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET!).update(payload).digest('hex')
}

// "有効期限.署名" 形式のトークンを発行する
export function createAdminSessionToken(): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000
  const payload = String(expires)
  return `${payload}.${sign(payload)}`
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  if (Number(payload) < Date.now()) return false
  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function isAdminRequest(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value)
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_SECONDS,
}
