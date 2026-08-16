import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminSession'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { changes } = await req.json()
  if (!changes || typeof changes !== 'object') return NextResponse.json({ error: 'invalid request' }, { status: 400 })

  const entries = Object.entries(changes) as [string, boolean][]
  await Promise.all(entries.map(([key, enabled]) => supabaseAdmin.from('feature_flags').update({ enabled }).eq('key', key)))

  return NextResponse.json({ ok: true })
}
