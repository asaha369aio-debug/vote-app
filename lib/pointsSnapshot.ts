import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { itemPointsCategory, parsePoints, pointsSettingCategory, type PointsKind } from '@/lib/pointsSettings'

// 項目の作成時に、その時点の全体設定の持ち票を項目ごとの値として保存する（サーバー専用）
export async function savePointsSnapshot(kind: PointsKind, itemId: string) {
  const { data } = await supabaseAdmin.from('polls').select('question').eq('category', pointsSettingCategory(kind)).limit(1)
  const points = parsePoints(kind, data?.[0]?.question)
  return supabaseAdmin.from('polls').insert({ question: String(points), category: itemPointsCategory(itemId) })
}

export async function deletePointsSnapshot(itemId: string) {
  await supabaseAdmin.from('polls').delete().eq('category', itemPointsCategory(itemId))
}
