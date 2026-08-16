import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const VALID_CATEGORIES = ['vote', 'bunkatsu']

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { question, options, category } = await req.json()
  const validOptions: string[] = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : []
  if (typeof question !== 'string' || !question.trim() || validOptions.length < 2 || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  const { data: poll, error } = await supabaseAdmin.from('polls').insert({ question: question.trim(), category }).select().single()
  if (error || !poll) return NextResponse.json({ error: error?.message ?? 'failed to create poll' }, { status: 500 })

  const { error: optError } = await supabaseAdmin.from('poll_options').insert(validOptions.map((text) => ({ poll_id: poll.id, text })))
  if (optError) return NextResponse.json({ error: optError.message }, { status: 500 })

  return NextResponse.json({ poll })
}
