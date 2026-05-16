'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase, type Poll } from '@/lib/supabase'

const VOTER_NAME_KEY = 'voterName'
const SITE_AUTH_KEY = 'siteAuth'

// F デザイン固定値
const th = {
  pageBg: '#ffe600',
  headerBg: '#ffe600', headerText: '#000000', headerMuted: '#333333',
  cardBg: '#ffffff', cardBorder: '#000000', accents: ['#ff2200', '#0033cc', '#00aa44', '#ff6600'], cardRadius: '0px',
  titleColor: '#000000', mutedColor: '#444444',
  primaryBg: '#000000', primaryText: '#ffe600',
  secondaryBorder: '#000000', secondaryText: '#000000',
  inputBg: '#ffffff', inputBorder: '#000000', inputText: '#000000', inputPlaceholder: '#888888',
  votedBg: '#00aa44', votedBorder: '#000000', votedText: '#ffffff',
  numText: '#ffffff', numBg: '#000000',
  fabBg: '#000000', fabText: '#ffe600',
  fabMenuBg: '#ffffff', fabMenuBorder: '#000000', fabMenuPrimary: '#000000', fabMenuDanger: '#ff2200',
  dangerBg: '#ff2200', dangerText: '#ffffff', cancelBg: '#ffe600', cancelText: '#000000',
}

const cardStyle = (i: number): React.CSSProperties => ({
  background: th.cardBg,
  border: '2.5px solid #000000',
  borderLeft: `6px solid ${th.accents[i % 4]}`,
})

const inputStyle: React.CSSProperties = {
  width: '100%', border: `2px solid ${th.inputBorder}`, background: th.inputBg,
  padding: '12px 16px', color: th.inputText, fontSize: '1rem', textAlign: 'center', outline: 'none',
}

export default function Home() {
  const [polls, setPolls] = useState<Poll[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [voterName, setVoterName] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [nameLoaded, setNameLoaded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editNameInput, setEditNameInput] = useState('')
  const [siteAuthed, setSiteAuthed] = useState<boolean | null>(null)
  const [sitePasswordInput, setSitePasswordInput] = useState('')
  const [sitePasswordError, setSitePasswordError] = useState(false)
  const [sitePasswordLoading, setSitePasswordLoading] = useState(false)
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchPolls = async () => {
    setReloading(true)
    const { data } = await supabase.from('polls').select('*').order('created_at', { ascending: false })
    setPolls(data ?? [])
    setReloading(false)
  }

  useEffect(() => {
    const authed = sessionStorage.getItem(SITE_AUTH_KEY) === '1'
    setSiteAuthed(authed)
    setIsAdmin(localStorage.getItem('isAdmin') === '1')
    const savedName = localStorage.getItem(VOTER_NAME_KEY)
    setVoterName(savedName)
    setNameLoaded(true)
    fetchPolls()

    const channel = supabase.channel('polls-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls' }, (payload) => {
        setPolls((prev) => [payload.new as Poll, ...prev])
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleLogout = () => { localStorage.removeItem('isAdmin'); setIsAdmin(false); setFloatingMenuOpen(false) }
  const handleDeletePoll = async (pollId: string) => {
    setDeletingId(pollId)
    await supabase.from('votes').delete().eq('poll_id', pollId)
    await supabase.from('poll_options').delete().eq('poll_id', pollId)
    await supabase.from('polls').delete().eq('id', pollId)
    setPolls((prev) => prev.filter((p) => p.id !== pollId))
    setConfirmDeleteId(null); setDeletingId(null)
  }
  const handleSiteLogout = () => { sessionStorage.removeItem(SITE_AUTH_KEY); setSiteAuthed(false); setFloatingMenuOpen(false) }
  const handleSitePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSitePasswordLoading(true); setSitePasswordError(false)
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: sitePasswordInput }) })
    if (res.ok) { sessionStorage.setItem(SITE_AUTH_KEY, '1'); setSiteAuthed(true) } else { setSitePasswordError(true) }
    setSitePasswordLoading(false)
  }
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault(); const trimmed = nameInput.trim(); if (!trimmed) return
    localStorage.setItem(VOTER_NAME_KEY, trimmed); setVoterName(trimmed)
  }
  const handleNameEdit = (e: React.FormEvent) => {
    e.preventDefault(); const trimmed = editNameInput.trim(); if (!trimmed) return
    localStorage.setItem(VOTER_NAME_KEY, trimmed); setVoterName(trimmed); setEditingName(false)
  }

  if (siteAuthed === null || !nameLoaded) return null

  // ===== パスワード画面 =====
  if (!siteAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: th.pageBg }}>
        <div style={{ background: th.cardBg, border: `2.5px solid ${th.cardBorder}`, padding: '32px', maxWidth: '360px', width: '100%' }}>
          <p className="text-4xl text-center mb-4">🔒</p>
          <h1 className="text-2xl font-black text-center mb-2" style={{ color: th.titleColor }}>パスワードを入力</h1>
          <p className="text-sm text-center mb-6" style={{ color: th.mutedColor }}>このサイトへのアクセスにはパスワードが必要です</p>
          <form onSubmit={handleSitePasswordSubmit} className="space-y-4">
            <input type="password" value={sitePasswordInput} onChange={(e) => setSitePasswordInput(e.target.value)} placeholder="パスワードを入力してください" style={inputStyle} autoFocus required />
            {sitePasswordError && <p className="text-sm text-center font-bold" style={{ color: th.dangerBg }}>✗ パスワードが間違っています</p>}
            <button type="submit" disabled={sitePasswordLoading} className="w-full font-black py-3 transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: th.primaryBg, color: th.primaryText, fontSize: '1rem' }}>
              {sitePasswordLoading ? '確認中...' : '入場する'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ===== 名前入力画面 =====
  if (!voterName) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: th.pageBg }}>
        <div style={{ background: th.cardBg, border: `2.5px solid ${th.cardBorder}`, padding: '32px', maxWidth: '360px', width: '100%' }}>
          <p className="text-4xl text-center mb-4">🗳️</p>
          <h1 className="text-2xl font-black text-center mb-2" style={{ color: th.titleColor }}>投票へようこそ</h1>
          <p className="text-sm text-center mb-6" style={{ color: th.mutedColor }}>あなたのお名前を教えてください</p>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="例: 田中太郎" style={inputStyle} autoFocus required maxLength={20} />
            <button type="submit" className="w-full font-black py-3 transition-opacity hover:opacity-80" style={{ background: th.primaryBg, color: th.primaryText, fontSize: '1rem' }}>
              はじめる
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ===== 投票一覧画面 =====
  return (
    <div className="min-h-screen" style={{ background: th.pageBg }}>
      {/* ヘッダー */}
      <header style={{ background: th.headerBg, borderBottom: '3px solid #000000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={fetchPolls} disabled={reloading} className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40 text-xl font-black" style={{ color: th.headerMuted }}>
              <span className={reloading ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
            </button>
            {/* ロゴ画像 */}
            <Image src="/qol_logo.png" alt="QOL" width={120} height={40} style={{ objectFit: 'contain' }} priority />
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            {editingName ? (
              <form onSubmit={handleNameEdit} className="flex items-center gap-1">
                <input type="text" value={editNameInput} onChange={(e) => setEditNameInput(e.target.value)} className="w-24 text-sm px-2 py-1 focus:outline-none" style={{ border: `1px solid ${th.secondaryBorder}`, background: 'rgba(0,0,0,0.08)', color: th.headerText }} placeholder="新しい名前" autoFocus maxLength={20} />
                <button type="submit" className="text-xs font-black px-2 py-1 transition-opacity hover:opacity-80" style={{ background: 'rgba(0,0,0,0.12)', color: th.headerText }}>変更</button>
                <button type="button" onClick={() => setEditingName(false)} className="text-xs px-1 transition-opacity hover:opacity-80" style={{ color: th.headerMuted }}>✕</button>
              </form>
            ) : (
              <button onClick={() => { setEditNameInput(voterName); setEditingName(true) }} className="flex items-center gap-1.5 text-sm px-3 py-1.5 transition-opacity hover:opacity-80" style={{ color: th.headerMuted, border: `1px solid ${th.secondaryBorder}`, borderRadius: '999px' }}>
                <span>👤</span><span className="font-black">{voterName}</span><span className="text-xs opacity-50">✎</span>
              </button>
            )}
            {isAdmin ? (
              <Link href="/create" className="font-black px-4 py-1.5 text-sm transition-opacity hover:opacity-80" style={{ background: th.primaryBg, color: th.primaryText }}>＋ 新しい投票</Link>
            ) : (
              <Link href="/admin/login" className="text-sm px-3 py-1.5 transition-opacity hover:opacity-80" style={{ color: th.headerMuted, border: `1px solid ${th.secondaryBorder}`, borderRadius: '999px' }}>管理者ログイン</Link>
            )}
          </div>
        </div>
      </header>

      {/* 投票リスト */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {polls.length === 0 ? (
          <div className="text-center py-20" style={{ color: th.mutedColor }}>
            <p className="text-5xl mb-4">📭</p>
            <p className="text-lg font-black">まだ投票がありません</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {polls.map((poll, i) => {
              const hasVoted = !!localStorage.getItem(`voted-${poll.id}`)
              const isConfirming = confirmDeleteId === poll.id
              const isDeleting = deletingId === poll.id
              return (
                <li key={poll.id}>
                  <div style={cardStyle(i)}>
                    {isAdmin && isConfirming ? (
                      <div className="px-5 py-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-black" style={{ color: th.titleColor }}>この投票を削除しますか？</p>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => handleDeletePoll(poll.id)} disabled={isDeleting} className="text-xs font-black px-3 py-1.5 transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: th.dangerBg, color: th.dangerText }}>
                            {isDeleting ? '削除中...' : '削除する'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-black px-3 py-1.5 transition-opacity hover:opacity-80" style={{ background: th.cancelBg, color: th.cancelText, border: '1.5px solid #000' }}>
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-4 flex items-start gap-3">
                        <span className="text-sm font-black flex-shrink-0 mt-0.5 flex items-center justify-center" style={{ color: th.numText, background: th.numBg, width: '24px', height: '24px', minWidth: '24px' }}>
                          {i + 1}
                        </span>
                        <Link href={`/poll/${poll.id}`} className="flex-1 min-w-0">
                          <p className="font-black text-base leading-snug" style={{ color: th.titleColor }}>{poll.question}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs" style={{ color: th.mutedColor }}>{new Date(poll.created_at).toLocaleString('ja-JP')}</p>
                            {hasVoted && (
                              <span className="text-xs font-black px-2 py-0.5 flex-shrink-0" style={{ background: th.votedBg, border: `1px solid ${th.votedBorder}`, color: th.votedText }}>
                                ✓ 投票済み
                              </span>
                            )}
                          </div>
                        </Link>
                        {isAdmin && (
                          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                            <Link href={`/edit/${poll.id}`} className="transition-opacity hover:opacity-60 text-base" style={{ color: th.mutedColor }} title="編集">✏️</Link>
                            <button onClick={() => setConfirmDeleteId(poll.id)} className="transition-opacity hover:opacity-60 text-base" style={{ color: th.mutedColor }} title="削除">🗑️</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {/* フローティングメニュー */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2">
        {floatingMenuOpen && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {isAdmin && (
              <button onClick={handleLogout} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 transition-opacity hover:opacity-80 whitespace-nowrap" style={{ background: th.fabMenuBg, color: th.fabMenuPrimary, border: `1px solid ${th.fabMenuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>👤</span>管理者ログアウト
              </button>
            )}
            <button onClick={handleSiteLogout} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 transition-opacity hover:opacity-80 whitespace-nowrap" style={{ background: th.fabMenuBg, color: th.fabMenuDanger, border: `1px solid ${th.fabMenuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <span>🚪</span>アプリ全体ログアウト
            </button>
          </div>
        )}
        <button onClick={() => setFloatingMenuOpen((v) => !v)} className="w-12 h-12 text-xl transition-opacity hover:opacity-80 flex items-center justify-center" style={{ background: th.fabBg, color: th.fabText, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {floatingMenuOpen ? '✕' : '⚙️'}
        </button>
      </div>
    </div>
  )
}
