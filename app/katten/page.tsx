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
  const [allScores, setAllScores] = useState<KattenScore[]>([])  // 管理者用全体履歴
  const [newUserName, setNewUserName] = useState('')
  const [selectedScore, setSelectedScore] = useState<number | null>(null)
  // ラウンドID: 管理者が選択を変えるたびにupdated_atが更新される
  // 送信済みラウンドと現在ラウンドが一致していれば送信ロック
  const [currentRound, setCurrentRound] = useState<string | null>(null)
  const [submittedForRound, setSubmittedForRound] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false)
  const [sessionNote, setSessionNote] = useState('')     // 管理者メモ（全員に表示）
  const [editingNote, setEditingNote] = useState(false)  // 管理者のみ編集モード
  const [noteInput, setNoteInput] = useState('')

  useEffect(() => {
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    const name = localStorage.getItem('voterName')
    if (!name) { router.replace('/'); return }
    setVoterName(name)
    const admin = localStorage.getItem('isAdmin') === '1'
    setIsAdmin(admin)

    supabase.from('katten_current').select('selected_user, updated_at, note').eq('id', 1).single()
      .then(({ data }) => {
        setCurrentSelected(data?.selected_user ?? null)
        setCurrentRound(data?.updated_at ?? null)
        setSessionNote(data?.note ?? '')
      })

    supabase.from('katten_users').select('*').order('created_at')
      .then(({ data }) => setUsers(data ?? []))

    // 自分の送信履歴
    supabase.from('katten_scores').select('*').eq('voter_name', name).order('created_at', { ascending: false })
      .then(({ data }) => setMyScores(data ?? []))

    // 全体履歴（管理者のみ）
    if (admin) {
      supabase.from('katten_scores').select('*').order('created_at', { ascending: false })
        .then(({ data }) => setAllScores(data ?? []))
    }

    const selChannel = supabase.channel('katten-current')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'katten_current' }, (payload) => {
        setCurrentSelected(payload.new.selected_user ?? null)
        setCurrentRound(payload.new.updated_at)  // ラウンドIDを更新（選択が何であれ毎回変わる）
        setSelectedScore(null)
        // メモの変更もリアルタイム反映
        if (payload.new.note !== undefined) setSessionNote(payload.new.note ?? '')
      }).subscribe()

    // スコア追加をリアルタイム反映
    const scoreChannel = supabase.channel('katten-my-scores')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'katten_scores' }, (payload) => {
        const s = payload.new as KattenScore
        if (s.voter_name === name) setMyScores((prev) => [s, ...prev])
        if (admin) setAllScores((prev) => [s, ...prev])
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

  const deleteScore = async (id: string) => {
    await supabase.from('katten_scores').delete().eq('id', id)
    setAllScores((prev) => prev.filter((s) => s.id !== id))
  }

  const saveNote = async () => {
    await supabase.from('katten_current').update({ note: noteInput }).eq('id', 1)
    setSessionNote(noteInput)
    setEditingNote(false)
  }

  const handleAdminLogout = () => { localStorage.removeItem('isAdmin'); setIsAdmin(false); setFloatingMenuOpen(false) }
  const handleSiteLogout = () => { sessionStorage.removeItem('siteAuth'); router.replace('/'); setFloatingMenuOpen(false) }

  const removeUser = async (id: string) => {
    await supabase.from('katten_users').delete().eq('id', id)
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  const exportCSV = () => {
    // メモをCSVの先頭行として付加
    const header = '点数,対象,送信者,時刻,ステージ'
    const rows = allScores.map((s) =>
      `${s.score},"${s.selected_user ?? ''}","${s.voter_name ?? ''}","${new Date(s.created_at).toLocaleString('ja-JP')}","${sessionNote}"`
    )
    const csv = '﻿' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `katten_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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

        {/* メモ・現在の対象を横並び */}
        <div className="flex gap-3 items-stretch">
          {/* 現在の対象 */}
          <div style={{ background: '#000' }} className="px-4 py-5 text-center flex flex-col justify-center flex-1">
            <p className="text-xs font-black mb-2" style={{ color: '#ffe600', letterSpacing: '0.15em' }}>現在の対象</p>
            {currentSelected
              ? <p className="text-2xl font-black" style={{ color: '#ffe600' }}>{currentSelected}</p>
              : <p className="text-base font-black" style={{ color: '#666' }}>未選択</p>
            }
          </div>

          {/* メモ欄（管理者が編集・全員に表示） */}
          {(isAdmin || sessionNote) && (
            <div style={{ background: '#fff', border: '2.5px solid #000', borderLeft: '6px solid #ffe600' }} className="p-4 flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black" style={{ color: '#888', letterSpacing: '0.08em' }}>📝 ステージ</p>
                {isAdmin && !editingNote && (
                  <button
                    onClick={() => { setNoteInput(sessionNote); setEditingNote(true) }}
                    className="text-xs font-black px-2 py-0.5 hover:opacity-70"
                    style={{ background: '#000', color: '#ffe600' }}
                  >
                    編集
                  </button>
                )}
              </div>
              {isAdmin && editingNote ? (
                <div className="flex gap-2">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    rows={3}
                    placeholder="ステージを入力してください"
                    className="flex-1 text-sm font-black resize-none focus:outline-none"
                    style={{ border: '2px solid #000', padding: '8px 10px', background: '#fff', color: '#000' }}
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={saveNote} className="text-xs font-black px-3 py-1.5 hover:opacity-80" style={{ background: '#000', color: '#ffe600' }}>保存</button>
                    <button onClick={() => setEditingNote(false)} className="text-xs font-black px-3 py-1.5 hover:opacity-80" style={{ border: '1.5px solid #000', color: '#000' }}>ｷｬﾝｾﾙ</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-black whitespace-pre-wrap" style={{ color: sessionNote ? '#000' : '#aaa' }}>
                  {sessionNote || '（ステージなし）'}
                </p>
              )}
            </div>
          )}
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
                <div key={u.id} className="flex items-center">
                  <button
                    onClick={() => selectUser(u.name)}
                    style={{ background: currentSelected === u.name ? '#ff2200' : '#fff', color: currentSelected === u.name ? '#fff' : '#000', border: '2px solid #000', borderRight: 'none', padding: '6px 16px' }}
                    className="font-black text-sm hover:opacity-70"
                  >
                    {u.name}
                  </button>
                  <button
                    onClick={() => removeUser(u.id)}
                    style={{ background: '#000', color: '#ffe600', border: '2px solid #000', padding: '6px 8px' }}
                    className="font-black text-xs hover:opacity-70"
                    title="削除"
                  >
                    ×
                  </button>
                </div>
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

        {/* 管理者: 全体の送信履歴 */}
        {isAdmin && (
          <div style={{ background: '#fff', border: '2.5px solid #000', borderLeft: '6px solid #ff2200' }} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black">
                📊 全体の送信履歴
                <span className="ml-2 font-black" style={{ color: '#ff2200' }}>{allScores.length}</span>
                <span className="font-normal text-xs ml-1" style={{ color: '#666' }}>件</span>
              </p>
              <div className="flex gap-2">
                <button onClick={exportCSV} style={{ background: '#0033cc', color: '#fff', padding: '3px 12px' }} className="text-xs font-black hover:opacity-80">CSV出力</button>
                <button onClick={() => setShowAllHistory((v) => !v)} style={{ background: '#000', color: '#ffe600', padding: '3px 12px' }} className="text-xs font-black hover:opacity-80">
                  {showAllHistory ? '▲ 閉じる' : '▼ 表示'}
                </button>
              </div>
            </div>
            {showAllHistory && (
              <div className="max-h-72 overflow-y-auto">
                {allScores.length === 0 ? (
                  <p className="text-sm" style={{ color: '#888' }}>まだ記録がありません</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '2px solid #000' }}>
                        <th className="text-left py-1 px-2 font-black">点数</th>
                        <th className="text-left py-1 px-2 font-black">対象</th>
                        <th className="text-left py-1 px-2 font-black">送信者</th>
                        <th className="text-left py-1 px-2 font-black">時刻</th>
                        <th className="text-left py-1 px-2 font-black">ステージ</th>
                        <th className="py-1 px-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {allScores.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td className="py-1.5 px-2"><span className="font-black text-base" style={{ color: SCORE_COLORS[s.score] }}>{s.score}</span></td>
                          <td className="py-1.5 px-2 font-bold">{s.selected_user ?? '—'}</td>
                          <td className="py-1.5 px-2" style={{ color: '#444' }}>{s.voter_name ?? '—'}</td>
                          <td className="py-1.5 px-2 text-xs" style={{ color: '#888' }}>{new Date(s.created_at).toLocaleString('ja-JP')}</td>
                          <td className="py-1.5 px-2 text-xs" style={{ color: '#555', maxWidth: '120px' }}>{sessionNote || '—'}</td>
                          <td className="py-1.5 px-2">
                            <button
                              onClick={() => deleteScore(s.id)}
                              className="text-xs font-black px-1.5 py-0.5 hover:opacity-80"
                              style={{ background: '#ff2200', color: '#fff' }}
                              title="削除"
                            >×</button>
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

      {/* フローティングメニュー */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2">
        {floatingMenuOpen && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {/* 管理者状態に応じてログイン/ログアウトを切り替え */}
            {isAdmin ? (
              <button onClick={handleAdminLogout} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: '#ffffff', color: '#000000', border: '1px solid #000000', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>👤</span>管理者ログアウト
              </button>
            ) : (
              <Link href="/admin/login" onClick={() => setFloatingMenuOpen(false)} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: '#ffffff', color: '#000000', border: '1px solid #000000', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>🔐</span>管理者ログイン
              </Link>
            )}
            <button onClick={handleSiteLogout} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: '#ffffff', color: '#ff2200', border: '1px solid #000000', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <span>🚪</span>ログアウト
            </button>
          </div>
        )}
        <button onClick={() => setFloatingMenuOpen((v) => !v)} className="w-12 h-12 text-xl hover:opacity-80 transition-opacity flex items-center justify-center" style={{ background: '#000000', color: '#ffe600', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {floatingMenuOpen ? '✕' : '⚙️'}
        </button>
      </div>
    </div>
  )
}
