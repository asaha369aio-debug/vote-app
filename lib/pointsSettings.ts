import { supabase } from '@/lib/supabase'

// 1人が配分できる持ち票の数。
// - 全体の設定: 管理者が機能ごとに設定し、これから作成する項目に使われる（category=setting:<kind>_points）
// - 項目ごとの値: 作成時点の全体設定を保存し、その項目の投票で使う（category=setting:points:<項目ID>）
// 専用テーブルを作らず、polls に設定用の行を置いて question に数値を文字列で保存する
export type PointsKind = 'vote' | 'insho'

// 全体設定がないとき、および項目ごとの値がない既存の項目（作成時点は常にこの値だった）に使う
export const POINTS_DEFAULTS: Record<PointsKind, number> = {
  vote: 1,    // 最終投票は1人1票が基本
  insho: 10,
}
export const MIN_POINTS = 1
export const MAX_POINTS = 100

export const isPointsKind = (value: unknown): value is PointsKind => value === 'vote' || value === 'insho'
export const pointsSettingCategory = (kind: PointsKind) => `setting:${kind}_points`
export const itemPointsCategory = (itemId: string) => `setting:points:${itemId}`

export function parsePoints(kind: PointsKind, value: string | null | undefined): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= MIN_POINTS && n <= MAX_POINTS ? n : POINTS_DEFAULTS[kind]
}

// 全体の設定（一覧画面の設定パネル用）
export async function fetchPoints(kind: PointsKind): Promise<number> {
  const { data } = await supabase.from('polls').select('question').eq('category', pointsSettingCategory(kind)).limit(1)
  return parsePoints(kind, data?.[0]?.question)
}

// 項目の持ち票（投票画面用）。作成時に保存した値を使う
export async function fetchItemPoints(kind: PointsKind, itemId: string): Promise<number> {
  const { data } = await supabase.from('polls').select('question').eq('category', itemPointsCategory(itemId)).limit(1)
  return parsePoints(kind, data?.[0]?.question)
}
