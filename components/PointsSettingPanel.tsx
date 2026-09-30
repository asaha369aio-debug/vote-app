'use client'

import { useEffect, useState } from 'react'
import { MAX_POINTS, MIN_POINTS, POINTS_DEFAULTS, fetchPoints, type PointsKind } from '@/lib/pointsSettings'

type Props = { kind: PointsKind; label: string; note: string }

// 管理者が1人の持ち票を設定するパネル（一覧画面の上に表示）
export default function PointsSettingPanel({ kind, label, note }: Props) {
  const [points, setPoints] = useState(POINTS_DEFAULTS[kind])
  const [input, setInput] = useState(String(POINTS_DEFAULTS[kind]))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPoints(kind).then((n) => { setPoints(n); setInput(String(n)) })
  }, [kind])

  const save = async () => {
    const value = Number(input)
    if (!Number.isInteger(value) || value < MIN_POINTS || value > MAX_POINTS) {
      alert(`持ち票は${MIN_POINTS}〜${MAX_POINTS}の整数で入力してください`)
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/points-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, points: value }),
    })
    setSaving(false)
    if (res.ok) {
      setPoints(value)
    } else {
      alert(res.status === 401 ? '管理者セッションが切れています。管理者ログインをやり直してください。' : '保存に失敗しました。')
    }
  }

  return (
    <div className="mb-4 p-4 flex flex-wrap items-center gap-2" style={{ background: '#000000', border: '2.5px solid #000000' }}>
      <span className="text-sm font-black" style={{ color: '#ffe600' }}>🔧 {label}</span>
      <input
        type="number"
        min={MIN_POINTS}
        max={MAX_POINTS}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-20 px-2 py-1 text-center font-black focus:outline-none"
        style={{ background: '#ffffff', color: '#000000', border: '2px solid #ffe600' }}
      />
      <span className="text-sm font-black" style={{ color: '#ffe600' }}>票</span>
      <button
        onClick={save}
        disabled={saving || Number(input) === points}
        className="text-sm font-black px-3 py-1 transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ background: '#ffe600', color: '#000000' }}
      >
        {saving ? '保存中...' : '保存'}
      </button>
      <span className="text-xs w-full" style={{ color: '#aaaaaa' }}>{note}（{MIN_POINTS}〜{MAX_POINTS}票）</span>
    </div>
  )
}
