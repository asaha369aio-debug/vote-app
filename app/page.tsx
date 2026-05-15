'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, type Poll } from '@/lib/supabase'

// 投票者名を保存するlocalStorageのキー
const VOTER_NAME_KEY = 'voterName'

export default function Home() {
  const [polls, setPolls] = useState<Poll[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  // リロード中のスピナー表示フラグ
  const [reloading, setReloading] = useState(false)

  // 投票者名（nullは未設定＝名前入力画面を表示する）
  const [voterName, setVoterName] = useState<string | null>(null)
  // 名前入力画面のフォーム値
  const [nameInput, setNameInput] = useState('')
  // localStorageの読み込みが完了したか（完了前に画面をレンダーするとちらつく）
  const [nameLoaded, setNameLoaded] = useState(false)
  // 名前変更モードのフラグ
  const [editingName, setEditingName] = useState(false)
  // 名前変更フォームの入力値
  const [editNameInput, setEditNameInput] = useState('')

  // 投票一覧をSupabaseから取得する関数（初回・リロードボタンで共用）
  const fetchPolls = async () => {
    setReloading(true)
    const { data } = await supabase
      .from('polls')
      .select('*')
      .order('created_at', { ascending: false })
    setPolls(data ?? [])
    setReloading(false)
  }

  useEffect(() => {
    setIsAdmin(localStorage.getItem('isAdmin') === '1')
    // localStorageから保存済みの名前を読み込む
    const savedName = localStorage.getItem(VOTER_NAME_KEY)
    setVoterName(savedName)
    setNameLoaded(true)
    fetchPolls()

    // pollsテーブルへのINSERTをリアルタイムで監視する
    // 管理者が新しい投票を作成したとき、ユーザーがリロードしなくても自動で一覧に追加される
    const channel = supabase
      .channel('polls-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polls' },
        (payload) => {
          // 取得した新しい投票をリストの先頭に追加する（再フェッチ不要）
          setPolls((prev) => [payload.new as Poll, ...prev])
        }
      )
      .subscribe()

    // アンマウント時にチャンネルを解除する
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('isAdmin')
    setIsAdmin(false)
  }

  // 名前入力画面で「はじめる」を押したときの処理
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) return
    localStorage.setItem(VOTER_NAME_KEY, trimmed)
    setVoterName(trimmed)
  }

  // ヘッダーの名前変更フォームで「変更」を押したときの処理
  const handleNameEdit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = editNameInput.trim()
    if (!trimmed) return
    localStorage.setItem(VOTER_NAME_KEY, trimmed)
    setVoterName(trimmed)
    setEditingName(false)
  }

  // localStorageのロード完了前は何も表示しない（名前入力画面が一瞬ちらつくのを防ぐ）
  if (!nameLoaded) return null

  // ===== 名前入力画面 =====
  // 名前が未設定のときはこの画面を全画面で表示する
  if (!voterName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
          <p className="text-5xl text-center mb-4">🗳️</p>
          <h1 className="text-2xl font-extrabold text-gray-800 text-center mb-2">投票へようこそ！</h1>
          <p className="text-gray-500 text-center text-sm mb-6">
            あなたのお名前を教えてください
          </p>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="例: 田中太郎"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-400 transition text-center text-lg"
              autoFocus
              required
              maxLength={20}
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 text-white font-bold py-3 rounded-xl shadow hover:shadow-lg transition text-lg"
            >
              はじめる →
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ===== 投票一覧画面 =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <header className="bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 shadow-lg">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* リロードボタン：タイトルの左に配置 */}
            <button
              onClick={fetchPolls}
              disabled={reloading}
              className="text-white/80 hover:text-white text-3xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/20 transition disabled:opacity-50"
              title="更新"
            >
              {/* reloading中はCSSアニメーションで回転させる */}
              <span className={reloading ? 'inline-block animate-spin' : 'inline-block'}>🔄</span>
            </button>
            <span className="text-2xl">🗳️</span>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">投票</h1>
          </div>

          <div className="flex gap-2 items-center flex-wrap justify-end">
            {/* 現在の名前表示と変更ボタン */}
            {editingName ? (
              // 名前変更フォーム（インライン表示）
              <form onSubmit={handleNameEdit} className="flex items-center gap-1">
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="w-24 text-sm px-2 py-1 rounded-lg border border-white/40 bg-white/20 text-white placeholder-white/60 focus:outline-none focus:bg-white/30"
                  placeholder="新しい名前"
                  autoFocus
                  maxLength={20}
                />
                <button
                  type="submit"
                  className="text-white text-xs font-bold px-2 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition"
                >
                  変更
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="text-white/70 text-xs px-1 py-1 hover:text-white transition"
                >
                  ✕
                </button>
              </form>
            ) : (
              // 名前バッジ：押すと変更モードへ
              <button
                onClick={() => { setEditNameInput(voterName); setEditingName(true) }}
                className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm px-3 py-1.5 rounded-full border border-white/30 hover:border-white/60 transition"
                title="名前を変更する"
              >
                <span>👤</span>
                <span className="font-bold">{voterName}</span>
                <span className="text-white/50 text-xs">✎</span>
              </button>
            )}

            {isAdmin ? (
              <>
                <Link
                  href="/create"
                  className="bg-white text-pink-600 font-bold px-4 py-2 rounded-full text-sm shadow hover:shadow-md transition"
                >
                  ＋ 新しい投票
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-white/80 hover:text-white text-sm px-3 py-2 rounded-full border border-white/40 hover:border-white transition"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/admin/login"
                className="text-white/80 hover:text-white text-sm px-3 py-2 rounded-full border border-white/40 hover:border-white transition"
              >
                管理者ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {polls.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-lg">まだ投票がありません</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {polls.map((poll, i) => {
              const colors = [
                'from-violet-400 to-purple-500',
                'from-pink-400 to-rose-500',
                'from-orange-400 to-amber-500',
                'from-teal-400 to-cyan-500',
              ]
              const color = colors[i % colors.length]
              // このユーザーがこの投票に投票済みかどうかをlocalStorageで確認する
              const hasVoted = !!localStorage.getItem(`voted-${poll.id}`)
              return (
                <li key={poll.id}>
                  <Link href={`/poll/${poll.id}`}>
                    <div className={`bg-gradient-to-r ${color} p-1 rounded-2xl shadow-md hover:shadow-xl transition-shadow`}>
                      <div className="bg-white rounded-xl px-5 py-4 hover:bg-opacity-95 transition">
                        <div className="flex items-start gap-3">
                          {/* ナンバリング：グラデーションの丸バッジで番号を表示する */}
                          <span className={`bg-gradient-to-br ${color} text-white text-sm font-black w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-lg leading-snug">{poll.question}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-sm text-gray-400">
                                {new Date(poll.created_at).toLocaleString('ja-JP')}
                              </p>
                              {/* 投票済みバッジ：localStorageに記録がある場合のみ表示する */}
                              {hasVoted && (
                                <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                  ✓ 投票済み
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
