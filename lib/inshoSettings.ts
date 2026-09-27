import { supabase } from '@/lib/supabase'

// 分割印象投票で1人が配分できる持ち票の数（管理者が全体で設定する）。
// 専用テーブルを作らず、polls に category=SETTING_CATEGORY の行を1つ置き、question に数値を文字列で保存する
export const INSHO_POINTS_SETTING_CATEGORY = 'setting:insho_points'
export const DEFAULT_INSHO_POINTS = 10
export const MIN_INSHO_POINTS = 1
export const MAX_INSHO_POINTS = 100

export function parseInshoPoints(value: string | null | undefined): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= MIN_INSHO_POINTS && n <= MAX_INSHO_POINTS ? n : DEFAULT_INSHO_POINTS
}

export async function fetchInshoPoints(): Promise<number> {
  const { data } = await supabase.from('polls').select('question').eq('category', INSHO_POINTS_SETTING_CATEGORY).limit(1)
  return parseInshoPoints(data?.[0]?.question)
}
