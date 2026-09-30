import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { MAX_POINTS, MIN_POINTS, isPointsKind, pointsSettingCategory } from '@/lib/pointsSettings'

// 最終投票・分割印象投票の持ち票（1人が配分できる票数）を設定する
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { kind, points } = await req.json()
  if (!isPointsKind(kind) || !Number.isInteger(points) || points < MIN_POINTS || points > MAX_POINTS) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  const category = pointsSettingCategory(kind)
  const { data: existing } = await supabaseAdmin.from('polls').select('id').eq('category', category).limit(1)
  const { error } = existing?.[0]
    ? await supabaseAdmin.from('polls').update({ question: String(points) }).eq('id', existing[0].id)
    : await supabaseAdmin.from('polls').insert({ question: String(points), category })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, points })
}
