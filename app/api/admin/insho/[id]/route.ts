import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { inshoQuestionCategory } from '@/lib/insho'
import { normalizeOptions, updatePollWithOptions } from '@/lib/pollUpdate'

type QuestionInput = { id: string; question: unknown; options: unknown; removedOptionIds: unknown }

// 分割印象投票の項目（タイトル＋全質問）をまとめて更新する
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params

  const { title, questions } = await req.json()
  if (!Array.isArray(questions) || questions.length === 0) return NextResponse.json({ error: 'invalid request' }, { status: 400 })

  // この項目に属する質問だけを更新対象にする（古い項目は項目自身が質問）
  const { data: owned } = await supabaseAdmin.from('polls').select('id').eq('category', inshoQuestionCategory(id))
  const allowedIds = new Set([...(owned ?? []).map((q) => q.id), id])

  const parsed = (questions as QuestionInput[]).map((q) => ({
    id: q.id,
    question: typeof q.question === 'string' ? q.question.trim() : '',
    options: normalizeOptions(q.options),
    removedOptionIds: Array.isArray(q.removedOptionIds) ? (q.removedOptionIds as string[]) : [],
  }))
  if (parsed.some((q) => !allowedIds.has(q.id) || !q.question || q.options.length < 2)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  if (typeof title === 'string' && title.trim()) {
    await supabaseAdmin.from('polls').update({ question: title.trim() }).eq('id', id)
  }
  for (const q of parsed) await updatePollWithOptions(q.id, q.question, q.options, q.removedOptionIds)

  return NextResponse.json({ ok: true })
}
