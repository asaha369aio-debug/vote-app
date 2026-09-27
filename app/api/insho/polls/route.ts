import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// 分割印象投票は管理者以外も作成できる（category は insho 固定）
// 質問と選択肢の組を複数受け取り、まとめて作成する
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
  const { polls: input } = await req.json()
  const polls = parsePolls(input)
  if (!polls) return NextResponse.json({ error: 'invalid request' }, { status: 400 })

  // 一覧は新しい順に表示されるため、最後の質問から作成して質問1が一番上に来るようにする
  const created = []
  for (const { question, options } of [...polls].reverse()) {
    const { data: poll, error } = await supabaseAdmin.from('polls').insert({ question, category: 'insho' }).select().single()
    if (error || !poll) return NextResponse.json({ error: error?.message ?? 'failed to create poll' }, { status: 500 })

    const { error: optError } = await supabaseAdmin.from('poll_options').insert(options.map((text) => ({ poll_id: poll.id, text })))
    if (optError) return NextResponse.json({ error: optError.message }, { status: 500 })
    created.push(poll)
  }

  return NextResponse.json({ polls: created.reverse() })
}
