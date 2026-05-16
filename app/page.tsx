'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, type Poll } from '@/lib/supabase'

const VOTER_NAME_KEY = 'voterName'
const SITE_AUTH_KEY = 'siteAuth'
const THEME_KEY = 'appTheme'

// ===== テーマ定義 =====

type T = {
  id: string; label: string
  pageBg: string
  headerBg: string; headerText: string; headerMuted: string
  cardBg: string; cardBorder: string; accents: string[]; cardRadius: string
  titleColor: string; mutedColor: string
  primaryBg: string; primaryText: string
  secondaryBorder: string; secondaryText: string
  inputBg: string; inputBorder: string; inputFocus: string; inputText: string; inputPlaceholder: string
  votedBg: string; votedBorder: string; votedText: string
  numText: string; numBg?: string; numRadius?: string
  fabBg: string; fabText: string
  fabMenuBg: string; fabMenuBorder: string; fabMenuPrimary: string; fabMenuDanger: string; fabMenuHover: string
  dangerBg: string; dangerText: string; cancelBg: string; cancelText: string
  glass?: boolean; newspaper?: boolean; neon?: boolean; block?: boolean
}

const THEMES: T[] = [
  {
    id: 'A', label: 'A ネオン',
    pageBg: '#0a0f1e',
    headerBg: '#060c1a', headerText: '#e0f0ff', headerMuted: '#00d4ff',
    cardBg: '#111827', cardBorder: '#00d4ff22', accents: ['#00d4ff', '#00ff9f', '#bf5af2', '#ff6b6b'], cardRadius: '4px',
    titleColor: '#e0f0ff', mutedColor: '#2a4a6a',
    primaryBg: '#00d4ff', primaryText: '#0a0f1e',
    secondaryBorder: '#00d4ff40', secondaryText: '#00d4ff',
    inputBg: '#141e30', inputBorder: '#00d4ff20', inputFocus: '#00d4ff', inputText: '#e0f0ff', inputPlaceholder: '#1e3a5a',
    votedBg: '#00ff9f10', votedBorder: '#00ff9f35', votedText: '#00ff9f',
    numText: '#00d4ff',
    fabBg: '#00d4ff', fabText: '#0a0f1e',
    fabMenuBg: '#0d1a2d', fabMenuBorder: '#00d4ff18', fabMenuPrimary: '#00d4ff', fabMenuDanger: '#ff6b6b', fabMenuHover: '#162035',
    dangerBg: '#ff4444', dangerText: '#fff', cancelBg: '#141e30', cancelText: '#2a4a6a',
    neon: true,
  },
  {
    id: 'B', label: 'B モノトーン',
    pageBg: '#ffffff',
    headerBg: '#ffffff', headerText: '#111111', headerMuted: '#888888',
    cardBg: '#ffffff', cardBorder: '#e5e5e5', accents: ['#4f46e5', '#4f46e5', '#4f46e5', '#4f46e5'], cardRadius: '0px',
    titleColor: '#111111', mutedColor: '#aaaaaa',
    primaryBg: '#111111', primaryText: '#ffffff',
    secondaryBorder: '#cccccc', secondaryText: '#888888',
    inputBg: '#ffffff', inputBorder: '#cccccc', inputFocus: '#111111', inputText: '#111111', inputPlaceholder: '#cccccc',
    votedBg: '#f5f5f5', votedBorder: '#cccccc', votedText: '#555555',
    numText: '#cccccc',
    fabBg: '#111111', fabText: '#ffffff',
    fabMenuBg: '#ffffff', fabMenuBorder: '#e5e5e5', fabMenuPrimary: '#111111', fabMenuDanger: '#cc0000', fabMenuHover: '#f5f5f5',
    dangerBg: '#111111', dangerText: '#ffffff', cancelBg: '#f5f5f5', cancelText: '#888888',
  },
  {
    id: 'C', label: 'C ペーパー',
    pageBg: '#f5f0e8',
    headerBg: '#3d2b1f', headerText: '#faf6ee', headerMuted: '#c8b89a',
    cardBg: '#fffdf7', cardBorder: '#d8c9b0', accents: ['#8b6f47', '#6b8f6b', '#b85c38', '#7a6fa0'], cardRadius: '2px',
    titleColor: '#3d2b1f', mutedColor: '#a08c78',
    primaryBg: '#8b6f47', primaryText: '#faf6ee',
    secondaryBorder: '#c8b89a55', secondaryText: '#c8b89a',
    inputBg: '#faf6ee', inputBorder: '#c8b89a', inputFocus: '#8b6f47', inputText: '#3d2b1f', inputPlaceholder: '#c8b89a',
    votedBg: '#eef5ee', votedBorder: '#c0d8c0', votedText: '#6b8f6b',
    numText: '#a08c78',
    fabBg: '#3d2b1f', fabText: '#faf6ee',
    fabMenuBg: '#fffdf7', fabMenuBorder: '#d8c9b0', fabMenuPrimary: '#8b6f47', fabMenuDanger: '#b85c38', fabMenuHover: '#f5f0e8',
    dangerBg: '#b85c38', dangerText: '#faf6ee', cancelBg: '#f0e8d8', cancelText: '#7a6352',
  },
  {
    id: 'D', label: 'D ガラス',
    pageBg: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0a1929 100%)',
    headerBg: 'rgba(10,18,36,0.75)', headerText: '#e2e8f0', headerMuted: '#60a5fa',
    cardBg: 'rgba(255,255,255,0.07)', cardBorder: 'rgba(255,255,255,0.14)', accents: ['#60a5fa', '#22d3ee', '#818cf8', '#34d399'], cardRadius: '12px',
    titleColor: '#e2e8f0', mutedColor: '#334155',
    primaryBg: '#3b82f6', primaryText: '#ffffff',
    secondaryBorder: 'rgba(255,255,255,0.25)', secondaryText: '#94a3b8',
    inputBg: 'rgba(255,255,255,0.07)', inputBorder: 'rgba(255,255,255,0.18)', inputFocus: '#60a5fa', inputText: '#e2e8f0', inputPlaceholder: '#334155',
    votedBg: 'rgba(52,211,153,0.1)', votedBorder: 'rgba(52,211,153,0.3)', votedText: '#34d399',
    numText: '#60a5fa', numBg: 'rgba(96,165,250,0.12)', numRadius: '50%',
    fabBg: '#3b82f6', fabText: '#ffffff',
    fabMenuBg: 'rgba(10,18,36,0.92)', fabMenuBorder: 'rgba(255,255,255,0.14)', fabMenuPrimary: '#60a5fa', fabMenuDanger: '#f87171', fabMenuHover: 'rgba(255,255,255,0.07)',
    dangerBg: '#ef4444', dangerText: '#fff', cancelBg: 'rgba(255,255,255,0.07)', cancelText: '#94a3b8',
    glass: true,
  },
  {
    id: 'E', label: 'E 新聞',
    pageBg: '#f0e8d0',
    headerBg: '#111111', headerText: '#f0e8d0', headerMuted: '#888888',
    cardBg: '#fffef8', cardBorder: '#111111', accents: ['#111111', '#111111', '#111111', '#111111'], cardRadius: '0px',
    titleColor: '#111111', mutedColor: '#777777',
    primaryBg: '#111111', primaryText: '#f0e8d0',
    secondaryBorder: '#888888', secondaryText: '#555555',
    inputBg: '#fffef8', inputBorder: '#111111', inputFocus: '#111111', inputText: '#111111', inputPlaceholder: '#aaaaaa',
    votedBg: '#f0e8d0', votedBorder: '#111111', votedText: '#333333',
    numText: '#aaaaaa',
    fabBg: '#111111', fabText: '#f0e8d0',
    fabMenuBg: '#fffef8', fabMenuBorder: '#111111', fabMenuPrimary: '#111111', fabMenuDanger: '#333333', fabMenuHover: '#f0e8d0',
    dangerBg: '#111111', dangerText: '#f0e8d0', cancelBg: '#f0e8d0', cancelText: '#555555',
    newspaper: true,
  },
  {
    id: 'F', label: 'F カラーブロック',
    pageBg: '#ffe600',
    headerBg: '#ffe600', headerText: '#000000', headerMuted: '#333333',
    cardBg: '#ffffff', cardBorder: '#000000', accents: ['#ff2200', '#0033cc', '#00aa44', '#ff6600'], cardRadius: '0px',
    titleColor: '#000000', mutedColor: '#444444',
    primaryBg: '#000000', primaryText: '#ffe600',
    secondaryBorder: '#000000', secondaryText: '#000000',
    inputBg: '#ffffff', inputBorder: '#000000', inputFocus: '#000000', inputText: '#000000', inputPlaceholder: '#888888',
    votedBg: '#00aa44', votedBorder: '#000000', votedText: '#ffffff',
    numText: '#ffffff', numBg: '#000000', numRadius: '0px',
    fabBg: '#000000', fabText: '#ffe600',
    fabMenuBg: '#ffffff', fabMenuBorder: '#000000', fabMenuPrimary: '#000000', fabMenuDanger: '#ff2200', fabMenuHover: '#ffe600',
    dangerBg: '#ff2200', dangerText: '#ffffff', cancelBg: '#ffe600', cancelText: '#000000',
    block: true,
  },
]

// ===== コンポーネント =====

export default function Home() {
  const [themeId, setThemeId] = useState('F')
  const th = THEMES.find(t => t.id === themeId) ?? THEMES[2]

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
    localStorage.setItem(THEME_KEY, 'F')

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

  const switchTheme = (id: string) => {
    setThemeId(id)
    localStorage.setItem(THEME_KEY, id)
  }

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

  // テーマ切り替えバー（全画面共通で表示）
  const ThemeSwitcher = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center py-2.5 px-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center gap-2">
        <span style={{ color: '#888888', fontSize: '11px', whiteSpace: 'nowrap' }}>デザイン切替:</span>
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => switchTheme(t.id)}
            className="transition-all"
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              border: themeId === t.id ? '1.5px solid #ffffff' : '1.5px solid rgba(255,255,255,0.2)',
              background: themeId === t.id ? '#ffffff' : 'rgba(255,255,255,0.08)',
              color: themeId === t.id ? '#000000' : 'rgba(255,255,255,0.6)',
              fontSize: '11px',
              fontWeight: themeId === t.id ? '700' : '400',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )

  // カードのガラス・ネオン共通スタイル
  const cardStyle = (i: number): React.CSSProperties => ({
    background: th.cardBg,
    border: `1px solid ${th.cardBorder}`,
    borderLeft: `4px solid ${th.accents[i % 4]}`,
    borderRadius: th.cardRadius,
    ...(th.glass ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
    ...(th.neon ? { boxShadow: `0 0 12px ${th.accents[i % 4]}18` } : {}),
    ...(th.block ? { borderWidth: '2.5px', borderLeftWidth: '6px', borderLeftColor: th.accents[i % 4] } : {}),
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', border: `2px solid ${th.inputBorder}`, background: th.inputBg,
    borderRadius: th.cardRadius, padding: '12px 16px', color: th.inputText,
    fontSize: '1rem', textAlign: 'center', outline: 'none',
    ...(th.glass ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}),
  }

  const serifFont = th.newspaper ? '"Times New Roman", Times, Georgia, serif' : undefined

  if (siteAuthed === null || !nameLoaded) return null

  // ===== パスワード画面 =====
  if (!siteAuthed) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center px-6 pb-14" style={{ background: th.pageBg }}>
          <div style={{ background: th.cardBg, border: `2px solid ${th.cardBorder}`, borderRadius: th.cardRadius, padding: '32px', maxWidth: '360px', width: '100%', ...(th.glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}) }}>
            <p className="text-4xl text-center mb-4">🔒</p>
            <h1 className="text-2xl font-bold text-center mb-2" style={{ color: th.titleColor, fontFamily: serifFont }}>パスワードを入力</h1>
            <p className="text-sm text-center mb-6" style={{ color: th.mutedColor }}>このサイトへのアクセスにはパスワードが必要です</p>
            <form onSubmit={handleSitePasswordSubmit} className="space-y-4">
              <input type="password" value={sitePasswordInput} onChange={(e) => setSitePasswordInput(e.target.value)} placeholder="パスワードを入力してください" style={inputStyle} autoFocus required />
              {sitePasswordError && <p className="text-sm text-center" style={{ color: th.dangerBg }}>✗ パスワードが間違っています</p>}
              <button type="submit" disabled={sitePasswordLoading} className="w-full font-bold py-3 transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: th.primaryBg, color: th.primaryText, borderRadius: th.cardRadius, fontSize: '1rem' }}>
                {sitePasswordLoading ? '確認中...' : '入場する'}
              </button>
            </form>
          </div>
        </div>
        <ThemeSwitcher />
      </>
    )
  }

  // ===== 名前入力画面 =====
  if (!voterName) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center px-6 pb-14" style={{ background: th.pageBg }}>
          <div style={{ background: th.cardBg, border: `2px solid ${th.cardBorder}`, borderRadius: th.cardRadius, padding: '32px', maxWidth: '360px', width: '100%', ...(th.glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}) }}>
            <p className="text-4xl text-center mb-4">🗳️</p>
            <h1 className="text-2xl font-bold text-center mb-2" style={{ color: th.titleColor, fontFamily: serifFont }}>投票へようこそ</h1>
            <p className="text-sm text-center mb-6" style={{ color: th.mutedColor }}>あなたのお名前を教えてください</p>
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="例: 田中太郎" style={inputStyle} autoFocus required maxLength={20} />
              <button type="submit" className="w-full font-bold py-3 transition-opacity hover:opacity-80" style={{ background: th.primaryBg, color: th.primaryText, borderRadius: th.cardRadius, fontSize: '1rem' }}>
                はじめる
              </button>
            </form>
          </div>
        </div>
        <ThemeSwitcher />
      </>
    )
  }

  // ===== 投票一覧画面 =====
  return (
    <>
      <div className="min-h-screen pb-14" style={{ background: th.pageBg }}>
        {/* ヘッダー */}
        <header style={{ background: th.headerBg, boxShadow: th.block ? `0 3px 0 ${th.cardBorder}` : 'none', ...(th.glass ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}) }}>
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={fetchPolls} disabled={reloading} className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40 text-xl" style={{ color: th.headerMuted }}>
                <span className={reloading ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
              </button>
              <span className="text-xl">🗳️</span>
              <h1 className="text-xl font-bold" style={{ color: th.headerText, fontFamily: serifFont, letterSpacing: th.newspaper ? '0.05em' : undefined }}>投票</h1>
            </div>
            <div className="flex gap-2 items-center flex-wrap justify-end">
              {editingName ? (
                <form onSubmit={handleNameEdit} className="flex items-center gap-1">
                  <input type="text" value={editNameInput} onChange={(e) => setEditNameInput(e.target.value)} className="w-24 text-sm px-2 py-1 focus:outline-none" style={{ borderRadius: th.cardRadius, border: `1px solid ${th.secondaryBorder}`, background: 'rgba(255,255,255,0.12)', color: th.headerText }} placeholder="新しい名前" autoFocus maxLength={20} />
                  <button type="submit" className="text-xs font-bold px-2 py-1 transition-opacity hover:opacity-80" style={{ background: 'rgba(255,255,255,0.15)', color: th.headerText, borderRadius: th.cardRadius }}>変更</button>
                  <button type="button" onClick={() => setEditingName(false)} className="text-xs px-1 transition-opacity hover:opacity-80" style={{ color: th.headerMuted }}>✕</button>
                </form>
              ) : (
                <button onClick={() => { setEditNameInput(voterName); setEditingName(true) }} className="flex items-center gap-1.5 text-sm px-3 py-1.5 transition-opacity hover:opacity-80" style={{ color: th.headerMuted, border: `1px solid ${th.secondaryBorder}`, borderRadius: '999px' }}>
                  <span>👤</span><span className="font-bold">{voterName}</span><span className="text-xs opacity-50">✎</span>
                </button>
              )}
              {isAdmin ? (
                <>
                  <Link href="/create" className="font-bold px-4 py-1.5 text-sm transition-opacity hover:opacity-80" style={{ background: th.primaryBg, color: th.primaryText, borderRadius: th.cardRadius }}>＋ 新しい投票</Link>
                </>
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
              <p className="text-lg">まだ投票がありません</p>
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
                          <p className="text-sm font-bold" style={{ color: th.titleColor, fontFamily: serifFont }}>この投票を削除しますか？</p>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => handleDeletePoll(poll.id)} disabled={isDeleting} className="text-xs font-bold px-3 py-1.5 transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: th.dangerBg, color: th.dangerText, borderRadius: th.cardRadius }}>
                              {isDeleting ? '削除中...' : '削除する'}
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-bold px-3 py-1.5 transition-opacity hover:opacity-80" style={{ background: th.cancelBg, color: th.cancelText, borderRadius: th.cardRadius }}>
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-5 py-4 flex items-start gap-3">
                          {/* 番号 */}
                          <span className="text-sm font-bold flex-shrink-0 mt-0.5 flex items-center justify-center" style={{ color: th.numText, background: th.numBg, borderRadius: th.numBg ? (th.numRadius ?? '4px') : undefined, width: th.numBg ? '24px' : undefined, height: th.numBg ? '24px' : undefined, minWidth: th.numBg ? '24px' : undefined, fontFamily: serifFont }}>
                            {th.numBg ? i + 1 : `${i + 1}.`}
                          </span>
                          {/* タイトル・日時 */}
                          <Link href={`/poll/${poll.id}`} className="flex-1 min-w-0">
                            <p className="font-bold text-base leading-snug" style={{ color: th.titleColor, fontFamily: serifFont }}>{poll.question}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-xs" style={{ color: th.mutedColor }}>{new Date(poll.created_at).toLocaleString('ja-JP')}</p>
                              {hasVoted && (
                                <span className="text-xs font-bold px-2 py-0.5 flex-shrink-0" style={{ background: th.votedBg, border: `1px solid ${th.votedBorder}`, color: th.votedText, borderRadius: th.cardRadius }}>
                                  ✓ 投票済み
                                </span>
                              )}
                            </div>
                          </Link>
                          {/* 管理者操作 */}
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

        {/* フローティングメニュー（テーマ切り替えバーの上に配置） */}
        <div className="fixed bottom-14 right-6 flex flex-col items-end gap-2">
          {floatingMenuOpen && (
            <div className="flex flex-col items-end gap-2 mb-1">
              {isAdmin && (
                <button onClick={handleLogout} className="flex items-center gap-2 font-bold text-sm px-4 py-2.5 transition-opacity hover:opacity-80 whitespace-nowrap" style={{ background: th.fabMenuBg, color: th.fabMenuPrimary, border: `1px solid ${th.fabMenuBorder}`, borderRadius: th.cardRadius, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <span>👤</span>管理者ログアウト
                </button>
              )}
              <button onClick={handleSiteLogout} className="flex items-center gap-2 font-bold text-sm px-4 py-2.5 transition-opacity hover:opacity-80 whitespace-nowrap" style={{ background: th.fabMenuBg, color: th.fabMenuDanger, border: `1px solid ${th.fabMenuBorder}`, borderRadius: th.cardRadius, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>🚪</span>アプリ全体ログアウト
              </button>
            </div>
          )}
          <button onClick={() => setFloatingMenuOpen((v) => !v)} className="w-12 h-12 text-xl transition-opacity hover:opacity-80 flex items-center justify-center" style={{ background: th.fabBg, color: th.fabText, borderRadius: th.block ? '0px' : '50%', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            {floatingMenuOpen ? '✕' : '⚙️'}
          </button>
        </div>
      </div>
      <ThemeSwitcher />
    </>
  )
}
