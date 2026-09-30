import { supabase } from '@/lib/supabase'

// 1人が配分できる持ち票の数（管理者が機能ごとに全体で設定する）。
// 専用テーブルを作らず、polls に category=setting:<kind>_points の行を1つ置き、question に数値を文字列で保存する
export type PointsKind = 'vote' | 'insho'

export const POINTS_DEFAULTS: Record<PointsKind, number> = {
  vote: 1,    // 最終投票は1人1票が基本
  insho: 10,
}
export const MIN_POINTS = 1
export const MAX_POINTS = 100

export const isPointsKind = (value: unknown): value is PointsKind => value === 'vote' || value === 'insho'
export const pointsSettingCategory = (kind: PointsKind) => `setting:${kind}_points`

export function parsePoints(kind: PointsKind, value: string | null | undefined): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= MIN_POINTS && n <= MAX_POINTS ? n : POINTS_DEFAULTS[kind]
}

export async function fetchPoints(kind: PointsKind): Promise<number> {
  const { data } = await supabase.from('polls').select('question').eq('category', pointsSettingCategory(kind)).limit(1)
  return parsePoints(kind, data?.[0]?.question)
}
