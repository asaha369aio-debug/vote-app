import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type OptionInput = { id: string | null; text: string }

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params

  const { question, options, removedOptionIds } = await req.json()
  const validOptions: OptionInput[] = Array.isArray(options)
    ? options.map((o: OptionInput) => ({ id: o.id ?? null, text: String(o.text).trim() })).filter((o) => o.text)
    : []
  if (typeof question !== 'string' || !question.trim() || validOptions.length < 2) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  await supabaseAdmin.from('polls').update({ question: question.trim() }).eq('id', id)

  const removed: string[] = Array.isArray(removedOptionIds) ? removedOptionIds : []
  if (removed.length > 0) {
    await supabaseAdmin.from('votes').delete().in('option_id', removed)
    await supabaseAdmin.from('poll_options').delete().in('id', removed)
  }

  const existingUpdates = validOptions.filter((o) => o.id !== null)
  await Promise.all(existingUpdates.map((o) => supabaseAdmin.from('poll_options').update({ text: o.text }).eq('id', o.id!)))

  const newOptions = validOptions.filter((o) => o.id === null)
  if (newOptions.length > 0) {
    await supabaseAdmin.from('poll_options').insert(newOptions.map((o) => ({ poll_id: id, text: o.text })))
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params

  await supabaseAdmin.from('votes').delete().eq('poll_id', id)
  await supabaseAdmin.from('poll_options').delete().eq('poll_id', id)
  await supabaseAdmin.from('polls').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
