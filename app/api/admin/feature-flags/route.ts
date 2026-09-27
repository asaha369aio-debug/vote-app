import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { changes } = await req.json()
  if (!changes || typeof changes !== 'object') return NextResponse.json({ error: 'invalid request' }, { status: 400 })

  const entries = Object.entries(changes) as [string, boolean][]
  // 新しく追加した機能はまだ行がないため upsert で作成する
  const results = await Promise.all(entries.map(([key, enabled]) => supabaseAdmin.from('feature_flags').upsert({ key, enabled }, { onConflict: 'key' })))
  const failed = results.find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
