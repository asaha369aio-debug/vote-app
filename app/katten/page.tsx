'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type KattenUser = { id: string; name: string }
type KattenScore = { id: string; score: number; selected_user: string | null; voter_name: string | null; created_at: string }

// Fデザイン固定
const SCORE_COLORS = ['#444444', '#0033cc', '#ff6600', '#ff2200']
const SCORE_LABELS = ['0', '1', '2', '3']

export default function KattenPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [voterName, setVoterName] = useState<string | null>(null)
  const [currentSelected, setCurrentSelected] = useState<string | null>(null)
  const [users, setUsers] = useState<KattenUser[]>([])
  const [scores, setScores] = useState<KattenScore[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [lastSubmitted, setLastSubmitted] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    const name = localStorage.getItem('voterName')
    if (!name) { router.replace('/'); return }
    setVoterName(name)
    const admin = localStorage.getItem('isAdmin') === '1'
    setIsAdmin(admin)

    // 現在の選択を取得
    supabase.from('katten_current').select('selected_user').eq('id', 1).single()
      .then(({ data }) => setCurrentSelected(data?.selected_user ?? null))

    // ユーザーリストを取得
    supabase.from('katten_users').select('*').order('created_at')
      .then(({ data }) => setUsers(data ?? []))

    // スコア履歴（管理者のみ）
    if (admin) {
      supabase.from('katten_scores').select('*').order('created_at', { ascending: false })
        .then(({ data }) => setScores(data ?? []))
    }

    // リアルタイム: 選択ユーザーの変更を購読
    const selChannel = supabase.channel('katten-current')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'katten_current' }, (payload) => {
        setCurrentSelected(payload.new.selected_user ?? null)
      }).subscribe()

    // リアルタイム: スコア追加（管理者のみ）
    const scoreChannel = supabase.channel('katten-scores')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'katten_scores' }, (payload) => {
        if (admin) setScores((prev) => [payload.new as KattenScore, ...prev])
      }).subscribe()

    return () => {
      supabase.removeChannel(selChannel)
      supabase.removeChannel(scoreChannel)
    }
  }, [])

  // 選択ユーザーを変更（管理者のみ）
  const selectUser = async (name: string | null) => {
    await supabase.from('katten_current').update({ selected_user: name, updated_at: new Date().toISOString() }).eq('id', 1)
  }

  // スコア送信
  const submitScore = async (score: number) => {
    if (!voterName || submitting) return
    setSubmitting(true)
    await supabase.from('katten_scores').insert({ score, selected_user: currentSelected, voter_name: voterName })
    setLastSubmitted(score)
    setSubmitting(false)
    // 2秒後にトースト消去
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setLastSubmitted(null), 2000)
  }

  // ユーザー追加（管理者のみ）
  const addUser = async () => {
    const name = newUserName.trim()
    if (!name) return
    const { data } = await supabase.from('katten_users').insert({ name }).select().single()
    if (data) { setUsers((prev) => [...prev, data]); setNewUserName('') }
  }

  // ユーザー削除（管理者のみ）
  const removeUser = async (id: string) => {
    await supabase.from('katten_users').delete().eq('id', id)
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  if (!voterName) return null

  return (
    <div className="min-h-screen" style={{ background: '#ffe600' }}>
      {/* ヘッダー */}
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-black text-black hover:opacity-60 transition-opacity text-lg">←</Link>
            <Image src="/qol_logo.png" alt="QOL" width={100} height={34} style={{ objectFit: 'contain' }} priority />
            <span className="font-black text-black text-sm px-2 py-0.5" style={{ border: '2px solid #000' }}>加点</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: '#333' }}>👤 {voterName}</span>
            {isAdmin && <span className="text-xs font-black px-2 py-0.5" style={{ background: '#000', color: '#ffe600' }}>管理者</span>}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-6">

        {/* ===== 現在の対象（全員に表示） ===== */}
        <div style={{ background: '#000', border: '3px solid #000' }} className="px-6 py-6 text-center">
          <p className="text-xs font-black mb-2" style={{ color: '#ffe600', letterSpacing: '0.15em' }}>現在の対象</p>
          {currentSelected ? (
            <p className="text-4xl font-black" style={{ color: '#ffe600' }}>{currentSelected}</p>
          ) : (
            <p className="text-xl font-black" style={{ color: '#666' }}>未選択</p>
          )}
        </div>

        {/* ===== 管理者: ユーザー選択 ===== */}
        {isAdmin && (
          <div style={{ background: '#fff', border: '2.5px solid #000' }} className="p-5">
            <p className="text-sm font-black mb-3" style={{ color: '#000' }}>対象を選択</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => selectUser(null)}
                style={{
                  background: currentSelected === null ? '#000' : '#fff',
                  color: currentSelected === null ? '#ffe600' : '#000',
                  border: '2px solid #000',
                  padding: '6px 16px',
                }}
                className="font-black text-sm transition-opacity hover:opacity-70"
              >
                解除
              </button>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u.name)}
                  style={{
                    background: currentSelected === u.name ? '#ff2200' : '#fff',
                    color: currentSelected === u.name ? '#fff' : '#000',
                    border: '2px solid #000',
                    padding: '6px 16px',
                  }}
                  className="font-black text-sm transition-opacity hover:opacity-70"
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== 管理者: ユーザー管理 ===== */}
        {isAdmin && (
          <div style={{ background: '#fff', border: '2.5px solid #000', borderLeft: '6px solid #0033cc' }} className="p-5">
            <p className="text-sm font-black mb-3" style={{ color: '#000' }}>ユーザー管理</p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addUser()}
                placeholder="ユーザー名を入力"
                style={{ border: '2px solid #000', background: '#fff', color: '#000', padding: '6px 12px', flex: 1, outline: 'none' }}
                className="text-sm font-black"
              />
              <button onClick={addUser} style={{ background: '#000', color: '#ffe600', padding: '6px 16px' }} className="font-black text-sm hover:opacity-80">
                追加
              </button>
            </div>
            {users.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center" style={{ border: '1.5px solid #000' }}>
                    <span className="text-sm font-black px-3 py-1" style={{ color: '#000' }}>{u.name}</span>
                    <button onClick={() => removeUser(u.id)} style={{ background: '#ff2200', color: '#fff', padding: '0 8px', height: '100%' }} className="font-black text-xs hover:opacity-80">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== スコア送信ボタン（全員） ===== */}
        <div style={{ background: '#fff', border: '2.5px solid #000' }} className="p-5">
          <p className="text-sm font-black mb-4" style={{ color: '#000' }}>
            {currentSelected ? `「${currentSelected}」に加点` : '対象が選択されるまでお待ちください'}
          </p>
          <div className="grid grid-cols-4 gap-3">
            {SCORE_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => submitScore(i)}
                disabled={!currentSelected || submitting}
                style={{
                  background: SCORE_COLORS[i],
                  color: '#fff',
                  border: '3px solid #000',
                  padding: '20px 0',
                  fontSize: '2rem',
                  fontWeight: 900,
                  opacity: !currentSelected || submitting ? 0.3 : 1,
                }}
                className="transition-opacity hover:opacity-80 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            ))}
          </div>
          {/* 送信トースト */}
          {lastSubmitted !== null && (
            <div className="mt-4 text-center py-2 font-black text-lg" style={{ background: SCORE_COLORS[lastSubmitted], color: '#fff' }}>
              ✓ {lastSubmitted}点を送信しました
            </div>
          )}
        </div>

        {/* ===== 管理者: スコア履歴 ===== */}
        {isAdmin && (
          <div style={{ background: '#fff', border: '2.5px solid #000', borderLeft: '6px solid #00aa44' }} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black" style={{ color: '#000' }}>
                📋 スコア履歴
                <span className="ml-2 font-black" style={{ color: '#ff2200' }}>{scores.length}</span>
                <span className="font-normal text-xs ml-1" style={{ color: '#666' }}>件</span>
              </p>
              <button
                onClick={() => setShowHistory((v) => !v)}
                style={{ background: '#000', color: '#ffe600', padding: '3px 12px' }}
                className="text-xs font-black hover:opacity-80"
              >
                {showHistory ? '▲ 閉じる' : '▼ 表示'}
              </button>
            </div>
            {showHistory && (
              <div className="max-h-72 overflow-y-auto">
                {scores.length === 0 ? (
                  <p className="text-sm" style={{ color: '#888' }}>まだ記録がありません</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '2px solid #000' }}>
                        <th className="text-left py-1 px-2 font-black">点数</th>
                        <th className="text-left py-1 px-2 font-black">対象</th>
                        <th className="text-left py-1 px-2 font-black">送信者</th>
                        <th className="text-left py-1 px-2 font-black">時刻</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td className="py-1.5 px-2">
                            <span className="font-black text-base" style={{ color: SCORE_COLORS[s.score] }}>{s.score}</span>
                          </td>
                          <td className="py-1.5 px-2 font-bold" style={{ color: '#000' }}>{s.selected_user ?? '—'}</td>
                          <td className="py-1.5 px-2" style={{ color: '#444' }}>{s.voter_name ?? '—'}</td>
                          <td className="py-1.5 px-2 text-xs" style={{ color: '#888' }}>
                            {new Date(s.created_at).toLocaleString('ja-JP')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
