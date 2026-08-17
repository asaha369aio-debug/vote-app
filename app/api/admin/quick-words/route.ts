import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { word } = await req.json()
  const trimmed = typeof word === 'string' ? word.trim() : ''
  if (!trimmed) return NextResponse.json({ error: 'invalid request' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('quick_words').insert({ word: trimmed }).select().single()
  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ word: data })
}
