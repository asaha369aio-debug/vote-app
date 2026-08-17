import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Poll = {
  id: string
  question: string
  created_at: string
  category: string
}

export type PollOption = {
  id: string
  poll_id: string
  text: string
}

export type QuickWord = {
  id: string
  word: string
  created_at: string
}

export type Vote = {
  id: string
  poll_id: string
  option_id: string
  // 投票者の名前（名前入力画面で設定したもの）
  voter_name: string | null
  created_at: string
}
