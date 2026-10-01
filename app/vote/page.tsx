'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, type Poll } from '@/lib/supabase'
import { buildResultsCsv, downloadCsv, fetchAllVotes } from '@/lib/resultsCsv'
import PointsSettingPanel from '@/components/PointsSettingPanel'

const VOTER_NAME_KEY = 'voterName'
const SITE_AUTH_KEY = 'siteAuth'

// qol_final_ui_app_top.jpg のデザインに合わせた配色
const th = {
  // 上下が淡いオレンジ、中央が明るい黄色のグラデーション
  pageBg: 'linear-gradient(180deg, #ffd966 0%, #ffff00 35%, #ffd966 100%)',
  headerBorder: '#000000',
  namePillBg: '#fff2cc',
  cardBg: '#ffffff', cardBorder: '#000000',
  titleColor: '#000000', mutedColor: '#444444',
  accents: ['#ff2200', '#0033cc', '#00aa44', '#ff6600'],
  numText: '#ffffff', numBg: '#000000',
  votedBg: '#00aa44', votedBorder: '#000000', votedText: '#ffffff',
  dangerBg: '#ff2200', dangerText: '#ffffff',
  cancelBg: '#ffffff', cancelText: '#000000',
  fabBg: '#3d3418', fabText: '#ffffff', fabBorder: '#8a8060',
  menuBg: '#ffffff', menuBorder: '#000000', menuPrimary: '#000000', menuDanger: '#ff2200',
}

// 各カード（最終投票の一覧と同じデザイン: 左端を色分け）
const cardStyle = (i: number): React.CSSProperties => ({
  background: th.cardBg,
  border: '2.5px solid #000000',
  borderLeft: `6px solid ${th.accents[i % 4]}`,
})

export default function VotePage() {
  const router = useRouter()
  const [polls, setPolls] = useState<Poll[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [voterName, setVoterName] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [editNameInput, setEditNameInput] = useState('')
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [exporting, setExporting] = useState(false)

  // 全項目の結果を1つのCSVにまとめて出力する
  const handleExportAll = async () => {
    setExporting(true)
    try {
      const items = polls.map((poll) => ({ title: poll.question, questions: [poll] }))
      const ids = polls.map((p) => p.id)
      const [{ data: options }, votes] = await Promise.all([
        supabase.from('poll_options').select('*').in('poll_id', ids),
        fetchAllVotes(ids),
      ])
      downloadCsv(`最終投票_全結果_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`, buildResultsCsv(items, options ?? [], votes))
    } catch {
      alert('出力に失敗しました。もう一度お試しください。')
    }
    setExporting(false)
  }

  const fetchPolls = async () => {
    setReloading(true)
    const { data } = await supabase.from('polls').select('*').eq('category', 'vote').order('created_at', { ascending: false })
    setPolls(data ?? [])
    setReloading(false)
  }

  useEffect(() => {
    // 未認証なら入口へ戻す
    if (sessionStorage.getItem(SITE_AUTH_KEY) !== '1') { router.replace('/'); return }
    const name = localStorage.getItem(VOTER_NAME_KEY)
    if (!name) { router.replace('/'); return }
    setVoterName(name)
    setIsAdmin(localStorage.getItem('isAdmin') === '1')
    fetchPolls()

    const channel = supabase.channel('polls-list-vote')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls', filter: 'category=eq.vote' }, (payload) => {
        setPolls((prev) => [payload.new as Poll, ...prev])
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleLogout = () => { localStorage.removeItem('isAdmin'); setIsAdmin(false); setFloatingMenuOpen(false); fetch('/api/admin/logout', { method: 'POST' }) }
  const handleSiteLogout = () => { sessionStorage.removeItem(SITE_AUTH_KEY); router.replace('/'); setFloatingMenuOpen(false) }
  const handleDeletePoll = async (pollId: string) => {
    setDeletingId(pollId)
    const res = await fetch(`/api/admin/polls/${pollId}`, { method: 'DELETE' })
    if (res.ok) setPolls((prev) => prev.filter((p) => p.id !== pollId))
    setConfirmDeleteId(null); setDeletingId(null)
  }
  const handleNameEdit = (e: React.FormEvent) => {
    e.preventDefault(); const trimmed = editNameInput.trim(); if (!trimmed) return
    localStorage.setItem(VOTER_NAME_KEY, trimmed); setVoterName(trimmed); setEditingName(false)
  }

  if (!voterName) return null

  return (
    <div className="min-h-screen" style={{ background: th.pageBg }}>
      {/* ヘッダー: ← ロゴ [最終投票] (ユーザー名) ↶ */}
      <header style={{ borderBottom: `1.5px solid ${th.headerBorder}` }}>
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center gap-1.5">
          <Link href="/" className="font-black text-black hover:opacity-60 transition-opacity text-2xl leading-none flex-shrink-0" title="機能選択へ戻る">←</Link>
          <Image src="/qol_logo.png" alt="QOL" width={78} height={26} style={{ objectFit: 'contain' }} className="flex-shrink-0" priority />
          <span className="font-black text-black text-sm px-1.5 py-0.5 whitespace-nowrap flex-shrink-0" style={{ border: '2px solid #000' }}>最終投票</span>
          <div className="flex-1 min-w-0 flex justify-center">
            {editingName ? (
              <form onSubmit={handleNameEdit} className="flex items-center gap-1 min-w-0">
                <input type="text" value={editNameInput} onChange={(e) => setEditNameInput(e.target.value)} className="w-24 text-sm px-2 py-1 focus:outline-none" style={{ border: '1.5px solid #000', borderRadius: '999px', background: th.namePillBg, color: '#000000' }} placeholder="新しい名前" autoFocus maxLength={20} />
                <button type="submit" className="text-xs font-black px-2 py-1 hover:opacity-80" style={{ background: 'rgba(0,0,0,0.12)' }}>変更</button>
                <button type="button" onClick={() => setEditingName(false)} className="text-xs px-1 hover:opacity-80">✕</button>
              </form>
            ) : (
              <button
                onClick={() => { setEditNameInput(voterName); setEditingName(true) }}
                className="max-w-full truncate text-sm font-black px-3 py-1 hover:opacity-70 transition-opacity"
                style={{ border: '1.5px solid #000', borderRadius: '999px', background: th.namePillBg, color: '#000000' }}
                title="名前を変更"
              >
                {voterName}
              </button>
            )}
          </div>
          <button onClick={fetchPolls} disabled={reloading} className="text-3xl font-black leading-none flex-shrink-0 transition-opacity hover:opacity-60 disabled:opacity-40" title="再読み込み">
            <span className={reloading ? 'inline-block animate-spin' : 'inline-block'}>↶</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-3 pb-28">
        {/* 管理者: 1人の持ち票 */}
        {isAdmin && (
          <PointsSettingPanel
            kind="vote"
            variant="bar"
            label="現在の1人の持ち票"
            note="これから作成する最終投票に適用されます。作成済みの項目は作成時の票数のまま。1票なら1つを選ぶ投票です"
          />
        )}

        {polls.length === 0 ? (
          <div className="text-center py-20" style={{ color: th.mutedColor }}>
            <p className="text-5xl mb-4">📭</p>
            <p className="text-lg font-black">まだ最終投票がありません</p>
            {isAdmin && <p className="text-sm mt-2">右下の＋から作成できます</p>}
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
                      <div className="px-3 py-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-black" style={{ color: th.titleColor }}>この最終投票を削除しますか？</p>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => handleDeletePoll(poll.id)} disabled={isDeleting} className="text-xs font-black px-3 py-1.5 hover:opacity-80 disabled:opacity-50" style={{ background: th.dangerBg, color: th.dangerText }}>
                            {isDeleting ? '削除中...' : '削除する'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-black px-3 py-1.5 hover:opacity-80" style={{ background: th.cancelBg, color: th.cancelText, border: '1.5px solid #000' }}>
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-2 flex items-start gap-3">
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
                            <Link href={`/edit/${poll.id}`} className="hover:opacity-60 transition-opacity text-base" style={{ color: th.mutedColor }} title="編集" aria-label="編集">✏️</Link>
                            <button onClick={() => setConfirmDeleteId(poll.id)} className="hover:opacity-60 transition-opacity text-base" style={{ color: th.mutedColor }} title="削除" aria-label="削除">🗑️</button>
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

      {/* 右下: その他のメニュー（⚙）と、新しい最終投票の作成（＋・管理者のみ） */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3">
        {floatingMenuOpen && (
          <div className="flex flex-col items-end gap-2">
            {isAdmin && polls.length > 0 && (
              <button onClick={() => { setFloatingMenuOpen(false); handleExportAll() }} disabled={exporting} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap disabled:opacity-50" style={{ background: th.menuBg, color: th.menuPrimary, border: `1px solid ${th.menuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>📥</span>{exporting ? '出力中...' : '全結果をCSVで出力'}
              </button>
            )}
            {isAdmin ? (
              <button onClick={handleLogout} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: th.menuBg, color: th.menuPrimary, border: `1px solid ${th.menuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>👤</span>管理者ログアウト
              </button>
            ) : (
              <Link href="/admin/login" className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: th.menuBg, color: th.menuPrimary, border: `1px solid ${th.menuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span>👤</span>管理者ログイン
              </Link>
            )}
            <button onClick={handleSiteLogout} className="flex items-center gap-2 font-black text-sm px-4 py-2.5 hover:opacity-80 whitespace-nowrap" style={{ background: th.menuBg, color: th.menuDanger, border: `1px solid ${th.menuBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <span>🚪</span>ログアウト
            </button>
          </div>
        )}
        <button
          onClick={() => setFloatingMenuOpen((v) => !v)}
          className="w-10 h-10 mr-3 rounded-full text-base hover:opacity-80 transition-opacity flex items-center justify-center"
          style={{ background: th.menuBg, border: `2px solid ${th.fabBg}`, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          title="メニュー"
          aria-label="メニュー"
        >
          {floatingMenuOpen ? '✕' : '⚙️'}
        </button>
        {isAdmin && (
          <Link
            href="/create"
            className="w-16 h-16 rounded-full flex items-center justify-center text-4xl font-light hover:opacity-90 transition-opacity"
            style={{ background: th.fabBg, color: th.fabText, border: `2px solid ${th.fabBorder}`, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}
            title="新しい最終投票を作成"
            aria-label="新しい最終投票を作成"
          >
            +
          </Link>
        )}
      </div>
    </div>
  )
}
