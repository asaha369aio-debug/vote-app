'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type KattenUser = { id: string; name: string }
type KattenScore = { id: string; score: number; selected_user: string | null; voter_name: string | null; created_at: string }

const SCORE_COLORS = ['#444444', '#0033cc', '#ff6600', '#ff2200']

export default function KattenPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [voterName, setVoterName] = useState<string | null>(null)
  const [currentSelected, setCurrentSelected] = useState<string | null>(null)
  const [users, setUsers] = useState<KattenUser[]>([])
  const [myScores, setMyScores] = useState<KattenScore[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [selectedScore, setSelectedScore] = useState<number | null>(null)
  // ラウンドID: 管理者が選択を変えるたびにupdated_atが更新される
  // 送信済みラウンドと現在ラウンドが一致していれば送信ロック
  const [currentRound, setCurrentRound] = useState<string | null>(null)
  const [submittedForRound, setSubmittedForRound] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    const name = localStorage.getItem('voterName')
    if (!name) { router.replace('/'); return }
    setVoterName(name)
    const admin = localStorage.getItem('isAdmin') === '1'
    setIsAdmin(admin)

    supabase.from('katten_current').select('selected_user, updated_at').eq('id', 1).single()
      .then(({ data }) => {
        setCurrentSelected(data?.selected_user ?? null)
        setCurrentRound(data?.updated_at ?? null)
      })

    supabase.from('katten_users').select('*').order('created_at')
      .then(({ data }) => setUsers(data ?? []))

    // 自分の送信履歴のみ取得
    supabase.from('katten_scores').select('*').eq('voter_name', name).order('created_at', { ascending: false })
      .then(({ data }) => setMyScores(data ?? []))

    const selChannel = supabase.channel('katten-current')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'katten_current' }, (payload) => {
        setCurrentSelected(payload.new.selected_user ?? null)
        setCurrentRound(payload.new.updated_at)  // ラウンドIDを更新（選択が何であれ毎回変わる）
        setSelectedScore(null)
      }).subscribe()

    // 自分のスコアが追加されたらリアルタイム反映
    const scoreChannel = supabase.channel('katten-my-scores')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'katten_scores' }, (payload) => {
        const s = payload.new as KattenScore
        if (s.voter_name === name) setMyScores((prev) => [s, ...prev])
      }).subscribe()

    return () => {
      supabase.removeChannel(selChannel)
      supabase.removeChannel(scoreChannel)
    }
  }, [])

  const selectUser = async (userName: string | null) => {
    await supabase.from('katten_current').update({ selected_user: userName, updated_at: new Date().toISOString() }).eq('id', 1)
  }

  const handleSubmit = async () => {
    if (!voterName || submitting || selectedScore === null || !currentSelected) return
    setSubmitting(true)
    await supabase.from('katten_scores').insert({ score: selectedScore, selected_user: currentSelected, voter_name: voterName })
    setSubmittedForRound(currentRound)  // 現在のラウンドIDで送信済みとしてロック
    setSubmitting(false)
  }

  const addUser = async () => {
    const name = newUserName.trim(); if (!name) return
    const { data } = await supabase.from('katten_users').insert({ name }).select().single()
    if (data) { setUsers((prev) => [...prev, data]); setNewUserName('') }
  }

  const removeUser = async (id: string) => {
    await supabase.from('katten_users').delete().eq('id', id)
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  // ラウンドIDが一致 = このラウンド（選択操作）で既に送信済み
  const hasSubmitted = currentRound !== null && submittedForRound === currentRound
  const canSubmit = currentSelected !== null && !hasSubmitted && selectedScore !== null && !submitting

  if (!voterName) return null

  return (
    <div className="min-h-screen" style={{ background: '#ffe600' }}>
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

        {/* 現在の対象 */}
        <div style={{ background: '#000' }} className="px-6 py-6 text-center">
          <p className="text-xs font-black mb-2" style={{ color: '#ffe600', letterSpacing: '0.15em' }}>現在の対象</p>
          {currentSelected
            ? <p className="text-4xl font-black" style={{ color: '#ffe600' }}>{currentSelected}</p>
            : <p className="text-xl font-black" style={{ color: '#666' }}>未選択</p>
          }
        </div>

        {/* 管理者: 対象選択 */}
        {isAdmin && (
          <div style={{ background: '#fff', border: '2.5px solid #000' }} className="p-5">
            <p className="text-sm font-black mb-3">対象を選択</p>
            <div className="flex flex-wrap gap-2">
              {/* 解除ボタン: 同じ人を連続選択するときのリセット用 */}
              <button
                onClick={() => selectUser(null)}
                style={{ background: currentSelected === null ? '#000' : '#fff', color: currentSelected === null ? '#ffe600' : '#000', border: '2px solid #000', padding: '6px 16px' }}
                className="font-black text-sm hover:opacity-70"
              >
                解除
              </button>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u.name)}
                  style={{ background: currentSelected === u.name ? '#ff2200' : '#fff', color: currentSelected === u.name ? '#fff' : '#000', border: '2px solid #000', padding: '6px 16px' }}
                  className="font-black text-sm hover:opacity-70"
                >
                  {u.name}
                </button>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: '#888' }}>同じ人を連続して選ぶ場合は一度「解除」してから再選択してください</p>
          </div>
        )}

        {/* 管理者: ユーザー管理 */}
        {isAdmin && (
          <div style={{ background: '#fff', border: '2.5px solid #000', borderLeft: '6px solid #0033cc' }} className="p-5">
            <p className="text-sm font-black mb-3">ユーザー管理</p>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUser()} placeholder="ユーザー名を入力" style={{ border: '2px solid #000', background: '#fff', color: '#000', padding: '6px 12px', flex: 1, outline: 'none' }} className="text-sm font-black" />
              <button onClick={addUser} style={{ background: '#000', color: '#ffe600', padding: '6px 16px' }} className="font-black text-sm hover:opacity-80">追加</button>
            </div>
            {users.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center" style={{ border: '1.5px solid #000' }}>
                    <span className="text-sm font-black px-3 py-1">{u.name}</span>
                    <button onClick={() => removeUser(u.id)} style={{ background: '#ff2200', color: '#fff', padding: '0 8px', height: '100%' }} className="font-black text-xs hover:opacity-80">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* スコア入力 */}
        <div style={{ background: '#fff', border: '2.5px solid #000' }} className="p-5">
          <p className="text-sm font-black mb-3">
            {!currentSelected && '対象が選択されるまでお待ちください'}
            {currentSelected && !hasSubmitted && `「${currentSelected}」への点数を選んでください`}
            {hasSubmitted && `「${currentSelected}」への送信済みです`}
          </p>

          {hasSubmitted && (
            <div className="mb-4 py-3 text-center font-black text-lg" style={{ background: '#00aa44', color: '#fff' }}>
              ✓ {selectedScore}点を送信しました
              <p className="text-xs font-bold mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>管理者が対象を変更するまでお待ちください</p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 mb-4">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => !hasSubmitted && currentSelected && setSelectedScore(i)}
                disabled={!currentSelected || hasSubmitted}
                style={{
                  background: selectedScore === i ? SCORE_COLORS[i] : '#fff',
                  color: selectedScore === i ? '#fff' : '#000',
                  border: `3px solid ${selectedScore === i ? SCORE_COLORS[i] : '#000'}`,
                  padding: '20px 0',
                  fontSize: '2rem',
                  fontWeight: 900,
                  opacity: !currentSelected || hasSubmitted ? 0.3 : 1,
                  transform: selectedScore === i ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.1s',
                }}
                className="disabled:cursor-not-allowed"
              >
                {i}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? '#000' : '#ccc',
              color: canSubmit ? '#ffe600' : '#888',
              width: '100%',
              padding: '14px 0',
              fontSize: '1.1rem',
              fontWeight: 900,
              border: '3px solid #000',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.1s',
            }}
            className="hover:opacity-80 disabled:opacity-60"
          >
            {submitting ? '送信中...' : selectedScore !== null && !hasSubmitted ? `${selectedScore}点を送信する` : '送信する'}
          </button>
        </div>

        {/* 自分の送信履歴（全員表示） */}
        <div style={{ background: '#fff', border: '2.5px solid #000', borderLeft: '6px solid #00aa44' }} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black">
              📋 自分の送信履歴
              <span className="ml-2 font-black" style={{ color: '#ff2200' }}>{myScores.length}</span>
              <span className="font-normal text-xs ml-1" style={{ color: '#666' }}>件</span>
            </p>
            <button onClick={() => setShowHistory((v) => !v)} style={{ background: '#000', color: '#ffe600', padding: '3px 12px' }} className="text-xs font-black hover:opacity-80">
              {showHistory ? '▲ 閉じる' : '▼ 表示'}
            </button>
          </div>
          {showHistory && (
            <div className="max-h-64 overflow-y-auto">
              {myScores.length === 0 ? (
                <p className="text-sm" style={{ color: '#888' }}>まだ送信していません</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '2px solid #000' }}>
                      <th className="text-left py-1 px-2 font-black">点数</th>
                      <th className="text-left py-1 px-2 font-black">対象</th>
                      <th className="text-left py-1 px-2 font-black">時刻</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myScores.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td className="py-1.5 px-2"><span className="font-black text-base" style={{ color: SCORE_COLORS[s.score] }}>{s.score}</span></td>
                        <td className="py-1.5 px-2 font-bold">{s.selected_user ?? '—'}</td>
                        <td className="py-1.5 px-2 text-xs" style={{ color: '#888' }}>{new Date(s.created_at).toLocaleString('ja-JP')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
