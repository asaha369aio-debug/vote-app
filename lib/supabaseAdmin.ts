import { createClient } from '@supabase/supabase-js'

// service_role キーを使うサーバー専用クライアント。RLSを無視して書き込みできるため、
// 管理者セッションを検証済みのAPIルートからのみ使用すること。
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
