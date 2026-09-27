import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ADJUST_VOTER_NAME } from '@/lib/voteAdjust'

const MAX_COUNT = 100000

// 管理者が選択肢ごとの票数を指定した数に修正する
// 増やす分は「管理者調整」の票として追加し、減らす分は「管理者調整」の票→新しい票の順に削除する
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params

  const { counts } = await req.json()
  if (!counts || typeof counts !== 'object') return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  const targets = Object.entries(counts as Record<string, unknown>)
  if (targets.some(([, n]) => !Number.isInteger(n) || (n as number) < 0 || (n as number) > MAX_COUNT)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  const { data: options } = await supabaseAdmin.from('poll_options').select('id').eq('poll_id', id)
  const optionIds = new Set((options ?? []).map((o) => o.id))
  if (targets.some(([optionId]) => !optionIds.has(optionId))) return NextResponse.json({ error: 'invalid option' }, { status: 400 })

  for (const [optionId, n] of targets as [string, number][]) {
    const { data: rows, error } = await supabaseAdmin
      .from('votes')
      .select('id, voter_name, created_at')
      .eq('poll_id', id)
      .eq('option_id', optionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const current = rows ?? []
    const diff = n - current.length

    if (diff > 0) {
      const { error: insertError } = await supabaseAdmin.from('votes').insert(
        Array.from({ length: diff }, () => ({ poll_id: id, option_id: optionId, voter_name: ADJUST_VOTER_NAME }))
      )
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    } else if (diff < 0) {
      const removeIds = [...current]
        .sort((a, b) => {
          const aAdjust = a.voter_name === ADJUST_VOTER_NAME ? 0 : 1
          const bAdjust = b.voter_name === ADJUST_VOTER_NAME ? 0 : 1
          return aAdjust - bAdjust || b.created_at.localeCompare(a.created_at)
        })
        .slice(0, -diff)
        .map((r) => r.id)
      const { error: deleteError } = await supabaseAdmin.from('votes').delete().in('id', removeIds)
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
