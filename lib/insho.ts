import type { Poll } from '@/lib/supabase'

// 分割印象投票は「項目（category=insho）」の下に「質問（category=insho_q:<項目ID>）」をぶら下げて保存する。
// 一覧には項目だけが出て、質問ごとに選択肢と票（votes）を持つ。
export const INSHO_CATEGORY = 'insho'
export const inshoQuestionCategory = (itemId: string) => `insho_q:${itemId}`

// 質問を持たない古い項目（質問を1件ずつ作っていた頃のもの）は、項目自身を1つの質問として扱う
export function questionsOrSelf(item: Poll, questions: Poll[]): Poll[] {
  return questions.length > 0 ? questions : [item]
}
