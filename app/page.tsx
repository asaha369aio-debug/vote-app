'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const VOTER_NAME_KEY = 'voterName'
const SITE_AUTH_KEY = 'siteAuth'

const th = {
  pageBg: '#ffe600',
  cardBg: '#ffffff', cardBorder: '#000000',
  titleColor: '#000000', mutedColor: '#444444',
  primaryBg: '#000000', primaryText: '#ffe600',
  dangerBg: '#ff2200',
  inputBg: '#ffffff', inputBorder: '#000000', inputText: '#000000',
  fabBg: '#000000', fabText: '#ffe600',
  fabMenuBg: '#ffffff', fabMenuBorder: '#000000',
  fabMenuPrimary: '#000000', fabMenuDanger: '#ff2200',
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: `2px solid ${th.inputBorder}`, background: th.inputBg,
  padding: '12px 16px', color: th.inputText, fontSize: '1rem', textAlign: 'center', outline: 'none',
}

// 全機能の定義（keyはfeature_flagsのkeyと対応）
const FEATURES = [
  { key: 'vote',    href: '/vote',    icon: '🗳️', label: '投票',   desc: 'リアルタイムで投票・集計',             accent: '#ff2200' },
  { key: 'katten',  href: '/katten',  icon: '📊', label: '加点',   desc: '対象を選んでリアルタイム加点',         accent: '#0033cc' },
  { key: 'enkaku',  href: '/enkaku',  icon: '📡', label: '遠隔加点', desc: '遠隔から対象を選んでリアルタイム加点', accent: '#00aa44' },
  { key: 'tap',     href: '/tap',     icon: '🎹', label: 'TAP',    desc: '音声ファイルを読み込んでパッド演奏',   accent: '#cc00ff' },
]

// 管理者がオン/オフできる機能キー
const TOGGLEABLE_KEYS = ['vote', 'katten', 'enkaku', 'tap']

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false)
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
  const [flags, setFlags] = useState<Record<string, boolean>>({})  // 機能の表示フラグ

  useEffect(() => {
    const authed = sessionStorage.getItem(SITE_AUTH_KEY) === '1'
    setSiteAuthed(authed)
    const savedName = localStorage.getItem(VOTER_NAME_KEY)
    setVoterName(savedName)
    setIsAdmin(localStorage.getItem('isAdmin') === '1')
    setNameLoaded(true)

    // 機能フラグを取得
    supabase.from('feature_flags').select('key, enabled')
      .then(({ data }) => {
        const map: Record<string, boolean> = {}
        data?.forEach((r) => { map[r.key] = r.enabled })
        setFlags(map)
      })

    // リアルタイムでフラグ変更を反映
    const ch = supabase.channel('feature-flags')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'feature_flags' }, (payload) => {
        setFlags((prev) => ({ ...prev, [payload.new.key]: payload.new.enabled }))
      }).subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  const toggleFlag = async (key: string) => {
    const next = !flags[key]
    setFlags((prev) => ({ ...prev, [key]: next }))
    await supabase.from('feature_flags').update({ enabled: next }).eq('key', key)
  }

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
  const handleAdminLogout = () => {
    localStorage.removeItem('isAdmin'); setIsAdmin(false); setFloatingMenuOpen(false)
  }
  const handleSiteLogout = () => {
    sessionStorage.removeItem(SITE_AUTH_KEY); setSiteAuthed(false); setFloatingMenuOpen(false)
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
          <p className="text-4xl text-center mb-4">👋</p>
          <h1 className="text-2xl font-black text-center mb-2" style={{ color: th.titleColor }}>ようこそ！</h1>
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

  // 表示する機能（enabled=trueのもの、または管理者は全て見える）
  const visibleFeatures = FEATURES.filter((f) => {
    if (!TOGGLEABLE_KEYS.includes(f.key)) return true  // 準備中は常に表示
    return isAdmin || flags[f.key] !== false
  })

  // ===== 機能選択画面 =====
  return (
    <div className="min-h-screen" style={{ background: th.pageBg }}>
      <header style={{ background: th.pageBg, borderBottom: '3px solid #000000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Image src="/qol_logo.png" alt="QOL" width={120} height={40} style={{ objectFit: 'contain' }} priority />
          <div className="flex items-center gap-2">
            {editingName ? (
              <form onSubmit={handleNameEdit} className="flex items-center gap-1">
                <input type="text" value={editNameInput} onChange={(e) => setEditNameInput(e.target.value)} className="w-24 text-sm px-2 py-1 focus:outline-none" style={{ border: '1px solid #000', background: 'rgba(0,0,0,0.08)' }} placeholder="新しい名前" autoFocus maxLength={20} />
                <button type="submit" className="text-xs font-black px-2 py-1 hover:opacity-80" style={{ background: 'rgba(0,0,0,0.12)' }}>変更</button>
                <button type="button" onClick={() => setEditingName(false)} className="text-xs px-1 hover:opacity-80">✕</button>
              </form>
            ) : (
              <button onClick={() => { setEditNameInput(voterName); setEditingName(true) }} className="flex items-center gap-1.5 text-sm px-3 py-1.5 hover:opacity-70 transition-opacity" style={{ border: '1px solid #000', borderRadius: '999px' }}>
                <span>👤</span><span className="font-black">{voterName}</span><span className="text-xs opacity-40">✎</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* 管理者: 機能の表示/非表示コントロール */}
        {isAdmin && (
          <div style={{ background: '#000', border: '2.5px solid #000' }} className="p-4">
            <p className="text-xs font-black mb-3" style={{ color: '#ffe600', letterSpacing: '0.1em' }}>🔧 管理者: 機能の表示設定</p>
            <div className="flex gap-3">
              {TOGGLEABLE_KEYS.map((key) => {
                const f = FEATURES.find((f) => f.key === key)!
                const enabled = flags[key] !== false
                return (
                  <button
                    key={key}
                    onClick={() => toggleFlag(key)}
                    style={{
                      background: enabled ? f.accent : '#333',
                      color: '#fff',
                      border: `2px solid ${enabled ? f.accent : '#555'}`,
                      padding: '8px 20px',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      transition: 'all 0.15s',
                    }}
                    className="hover:opacity-80"
                  >
                    {f.icon} {f.label}：{enabled ? '表示中' : '非表示'}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 機能カード一覧 */}
        <div>
          <h2 className="text-lg font-black mb-4" style={{ color: th.titleColor }}>機能を選択してください</h2>
          <div className="space-y-3">
            {visibleFeatures.map((f) => {
              const isActive = f.href !== '#'
              const isEnabled = !TOGGLEABLE_KEYS.includes(f.key) || flags[f.key] !== false
              // 管理者が非表示にしている機能はグレーアウトで表示
              const dimmed = isAdmin && !isEnabled

              return isActive && isEnabled ? (
                <Link key={f.key} href={f.href}>
                  <div className="flex items-center gap-4 px-6 py-5 transition-opacity hover:opacity-80 cursor-pointer" style={{ background: th.cardBg, border: '2.5px solid #000', borderLeft: `8px solid ${f.accent}` }}>
                    <span className="text-4xl flex-shrink-0">{f.icon}</span>
                    <div className="flex-1">
                      <p className="text-xl font-black" style={{ color: th.titleColor }}>{f.label}</p>
                      <p className="text-sm" style={{ color: th.mutedColor }}>{f.desc}</p>
                    </div>
                    <span className="text-2xl font-black" style={{ color: f.accent }}>→</span>
                  </div>
                </Link>
              ) : (
                <div key={f.key} className="flex items-center gap-4 px-6 py-5" style={{ background: th.cardBg, border: '2.5px solid #ccc', borderLeft: `8px solid #ccc`, opacity: dimmed ? 0.5 : 0.4 }}>
                  <span className="text-4xl flex-shrink-0">{f.icon}</span>
                  <div className="flex-1">
                    <p className="text-xl font-black" style={{ color: th.titleColor }}>{f.label}</p>
                    <p className="text-sm" style={{ color: th.mutedColor }}>{f.desc}</p>
                  </div>
                  <span className="text-xs font-black px-2 py-1" style={{ background: '#eee', color: '#999' }}>
                    {dimmed ? '非表示中' : '準備中'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* フローティングメニュー */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2">
        {floatingMenuOpen && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {/* 管理者状態に応じてログイン/ログアウトを切り替え */}
            {isAdmin ? (
              <button onClick={handleAdminLogout} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: th.fabMenuBg, color: th.fabMenuPrimary, border: `1px solid ${th.fabMenuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>👤</span>管理者ログアウト
              </button>
            ) : (
              <Link href="/admin/login" onClick={() => setFloatingMenuOpen(false)} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: th.fabMenuBg, color: th.fabMenuPrimary, border: `1px solid ${th.fabMenuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>🔐</span>管理者ログイン
              </Link>
            )}
            <button onClick={handleSiteLogout} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: th.fabMenuBg, color: th.fabMenuDanger, border: `1px solid ${th.fabMenuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <span>🚪</span>ログアウト
            </button>
          </div>
        )}
        <button onClick={() => setFloatingMenuOpen((v) => !v)} className="w-12 h-12 text-xl hover:opacity-80 transition-opacity flex items-center justify-center" style={{ background: th.fabBg, color: th.fabText, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {floatingMenuOpen ? '✕' : '⚙️'}
        </button>
      </div>
    </div>
  )
}
