import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { inshoQuestionCategory } from '@/lib/insho'
import { deletePolls, normalizeOptions, updatePollWithOptions } from '@/lib/pollUpdate'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params

  const { question, options, removedOptionIds } = await req.json()
  const validOptions = normalizeOptions(options)
  if (typeof question !== 'string' || !question.trim() || validOptions.length < 2) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  await updatePollWithOptions(id, question.trim(), validOptions, Array.isArray(removedOptionIds) ? removedOptionIds : [])

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params

  // 分割印象投票の項目なら、ぶら下がっている質問もまとめて削除する
  const { data: questions } = await supabaseAdmin.from('polls').select('id').eq('category', inshoQuestionCategory(id))
  await deletePolls([...(questions ?? []).map((q) => q.id), id])

  return NextResponse.json({ ok: true })
}
