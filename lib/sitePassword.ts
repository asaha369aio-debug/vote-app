import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export { isValidSitePassword } from '@/lib/sitePasswordRules'

// 一般パスワード（サイト入場用）はハッシュ化して app_secrets テーブルに保存する。
// app_secrets は anon から読めないよう RLS を有効にし、ポリシーは作らない（service_role のみアクセス可）。
//   create table app_secrets (key text primary key, value text not null, updated_at timestamptz not null default now());
//   alter table app_secrets enable row level security;
// DB に未設定の間は環境変数 SITE_PASSWORD を使う。
const SITE_PASSWORD_KEY = 'site_password'
const KEY_LENGTH = 64

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `scrypt$${salt}$${hash}`
}

function verifyHash(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export async function verifySitePassword(password: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('app_secrets').select('value').eq('key', SITE_PASSWORD_KEY).maybeSingle()
  // 取得に失敗したときに古い環境変数のパスワードで通さないよう、エラーは例外にする
  if (error) throw new Error(error.message)
  if (data) return verifyHash(password, data.value)
  const fallback = process.env.SITE_PASSWORD
  return !!fallback && safeEqual(password, fallback)
}

export async function setSitePassword(password: string): Promise<void> {
  const { error } = await supabaseAdmin.from('app_secrets').upsert(
    { key: SITE_PASSWORD_KEY, value: hashPassword(password), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) throw new Error(error.message)
}
