import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { INSHO_CATEGORY, inshoQuestionCategory } from '@/lib/insho'
import { deletePolls } from '@/lib/pollUpdate'
import { savePointsSnapshot } from '@/lib/pointsSnapshot'

// 分割印象投票は管理者以外も作成できる。
// タイトル（一覧に出る項目）と、質問・選択肢の組を複数受け取り、1つの項目としてまとめて作成する
const MAX_TITLE_LENGTH = 200
const MAX_QUESTION_LENGTH = 200
const MAX_POLLS = 10
const MAX_OPTION_LENGTH = 100
const MAX_OPTIONS = 20

type PollInput = { question: string; options: string[] }

function parsePolls(value: unknown): PollInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_POLLS) return null
  const polls = value.map((p) => ({
    question: String(p?.question ?? '').trim(),
    options: Array.isArray(p?.options) ? p.options.map((o: unknown) => String(o).trim()).filter(Boolean) : [],
  }))
  const valid = polls.every((p) =>
    p.question && p.question.length <= MAX_QUESTION_LENGTH &&
    p.options.length >= 2 && p.options.length <= MAX_OPTIONS && p.options.every((o: string) => o.length <= MAX_OPTION_LENGTH)
  )
  return valid ? polls : null
}

export async function POST(req: NextRequest) {
  const { title, polls: input } = await req.json()
  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  const polls = parsePolls(input)
  if (!trimmedTitle || trimmedTitle.length > MAX_TITLE_LENGTH || !polls) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  const { data: item, error } = await supabaseAdmin.from('polls').insert({ question: trimmedTitle, category: INSHO_CATEGORY }).select().single()
  if (error || !item) return NextResponse.json({ error: error?.message ?? 'failed to create item' }, { status: 500 })

  // 質問は作成順（created_at 昇順）で並べるため、1つずつ順番に作成する
  const createdIds: string[] = []
  for (const { question, options } of polls) {
    const { data: poll, error: pollError } = await supabaseAdmin.from('polls').insert({ question, category: inshoQuestionCategory(item.id) }).select().single()
    const optError = poll
      ? (await supabaseAdmin.from('poll_options').insert(options.map((text) => ({ poll_id: poll.id, text })))).error
      : null
    if (poll) createdIds.push(poll.id)
    if (pollError || !poll || optError) {
      // 途中で失敗したら作りかけの項目を残さない
      await deletePolls([...createdIds, item.id])
      return NextResponse.json({ error: (pollError ?? optError)?.message ?? 'failed to create question' }, { status: 500 })
    }
  }

  // 作成時点の持ち票をこの項目の値として保存する（あとで全体設定を変えても変わらない）
  const { error: pointsError } = await savePointsSnapshot('insho', item.id)
  if (pointsError) {
    await deletePolls([...createdIds, item.id])
    return NextResponse.json({ error: pointsError.message }, { status: 500 })
  }

  return NextResponse.json({ poll: item })
}
