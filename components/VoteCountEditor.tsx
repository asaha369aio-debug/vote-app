'use client'

import { useState } from 'react'
import type { PollOption } from '@/lib/supabase'
import { ADJUST_VOTER_NAME } from '@/lib/voteAdjust'

type Props = {
  pollId: string
  options: PollOption[]
  counts: Record<string, number>
  colors: string[]
  onSaved: () => void
}

// 管理者が選択肢ごとの票数を修正するパネル
export default function VoteCountEditor({ pollId, options, counts, colors, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  const start = () => {
    setDraft(Object.fromEntries(options.map((o) => [o.id, counts[o.id] ?? 0])))
    setEditing(true)
  }
  const change = (optionId: string, value: number) =>
    setDraft((prev) => ({ ...prev, [optionId]: Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)) }))

  const changed = options.filter((o) => draft[o.id] !== (counts[o.id] ?? 0))
  const decreased = changed.some((o) => draft[o.id] < (counts[o.id] ?? 0))

  const save = async () => {
    if (changed.length === 0) { setEditing(false); return }
    setSaving(true)
    const res = await fetch(`/api/admin/polls/${pollId}/counts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counts: Object.fromEntries(changed.map((o) => [o.id, draft[o.id]])) }),
    })
    setSaving(false)
    if (!res.ok) {
      alert(res.status === 401 ? '管理者セッションが切れています。管理者ログインをやり直してください。' : '票数の修正に失敗しました。')
      return
    }
    setEditing(false)
    onSaved()
  }

  if (!editing) {
    return (
      <button
        onClick={start}
        style={{ background: '#ffffff', color: '#000000', border: '2px solid #000000' }}
        className="text-sm font-black px-4 py-1.5 transition-opacity hover:opacity-80"
      >
        ✏️ 票数を修正
      </button>
    )
  }

  return (
    <div className="text-left p-4" style={{ background: '#f5f5f5', border: '2px solid #000000' }}>
      <p className="text-sm font-black text-black mb-3">✏️ 票数を修正</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const color = colors[i % colors.length]
          const n = draft[opt.id] ?? 0
          const before = counts[opt.id] ?? 0
          return (
            <div key={opt.id} className="flex items-center gap-2">
              <span className="w-3 h-3 flex-shrink-0" style={{ background: color }} />
              <span className="text-sm font-bold text-black flex-1 truncate">{opt.text}</span>
              {n !== before && <span className="text-xs text-black/40 line-through">{before}</span>}
              <button onClick={() => change(opt.id, n - 1)} disabled={n === 0} className="w-8 h-8 font-black disabled:opacity-30" style={{ background: '#ffffff', border: '2px solid #000000' }}>−</button>
              <input
                type="number"
                min={0}
                value={n}
                onChange={(e) => change(opt.id, e.target.valueAsNumber)}
                className="w-16 h-8 text-center font-black focus:outline-none"
                style={{ border: `2px solid ${color}`, color }}
              />
              <button onClick={() => change(opt.id, n + 1)} className="w-8 h-8 font-black text-white" style={{ background: color, border: '2px solid #000000' }}>＋</button>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-black/50 mt-3">
        増やした分は「{ADJUST_VOTER_NAME}」の票として追加されます。
        {decreased && <span className="font-bold" style={{ color: '#ff2200' }}> 減らした分は「{ADJUST_VOTER_NAME}」→新しい票の順に削除されます。</span>}
      </p>
      <div className="flex gap-2 mt-3 justify-end">
        <button onClick={() => setEditing(false)} disabled={saving} className="text-sm font-black px-4 py-1.5 disabled:opacity-50" style={{ background: '#ffffff', border: '2px solid #000000' }}>キャンセル</button>
        <button onClick={save} disabled={saving || changed.length === 0} className="text-sm font-black px-4 py-1.5 disabled:opacity-50" style={{ background: '#000000', color: '#ffe600' }}>
          {saving ? '保存中...' : '💾 保存'}
        </button>
      </div>
    </div>
  )
}
