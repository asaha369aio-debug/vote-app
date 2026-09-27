import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type OptionInput = { id: string | null; text: string }

export function normalizeOptions(options: unknown): OptionInput[] {
  return Array.isArray(options)
    ? options.map((o: OptionInput) => ({ id: o.id ?? null, text: String(o.text).trim() })).filter((o) => o.text)
    : []
}

// 質問文と選択肢を更新する（削除された選択肢の票も消す）
export async function updatePollWithOptions(id: string, question: string, options: OptionInput[], removedOptionIds: string[]) {
  await supabaseAdmin.from('polls').update({ question }).eq('id', id)

  if (removedOptionIds.length > 0) {
    await supabaseAdmin.from('votes').delete().in('option_id', removedOptionIds)
    await supabaseAdmin.from('poll_options').delete().in('id', removedOptionIds)
  }

  const existingUpdates = options.filter((o) => o.id !== null)
  await Promise.all(existingUpdates.map((o) => supabaseAdmin.from('poll_options').update({ text: o.text }).eq('id', o.id!)))

  const newOptions = options.filter((o) => o.id === null)
  if (newOptions.length > 0) {
    await supabaseAdmin.from('poll_options').insert(newOptions.map((o) => ({ poll_id: id, text: o.text })))
  }
}

// 質問と、その選択肢・票をまとめて削除する
export async function deletePolls(ids: string[]) {
  if (ids.length === 0) return
  await supabaseAdmin.from('votes').delete().in('poll_id', ids)
  await supabaseAdmin.from('poll_options').delete().in('poll_id', ids)
  await supabaseAdmin.from('polls').delete().in('id', ids)
}
