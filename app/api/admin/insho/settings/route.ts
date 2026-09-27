import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { INSHO_POINTS_SETTING_CATEGORY, MAX_INSHO_POINTS, MIN_INSHO_POINTS } from '@/lib/inshoSettings'

// 分割印象投票の持ち票（1人が配分できる票数）を設定する
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { points } = await req.json()
  if (!Number.isInteger(points) || points < MIN_INSHO_POINTS || points > MAX_INSHO_POINTS) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin.from('polls').select('id').eq('category', INSHO_POINTS_SETTING_CATEGORY).limit(1)
  const { error } = existing?.[0]
    ? await supabaseAdmin.from('polls').update({ question: String(points) }).eq('id', existing[0].id)
    : await supabaseAdmin.from('polls').insert({ question: String(points), category: INSHO_POINTS_SETTING_CATEGORY })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, points })
}
