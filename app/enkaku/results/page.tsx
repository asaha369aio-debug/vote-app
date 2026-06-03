'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// テーマカラー
const th = {
  pageBg: '#ffe600',
  titleColor: '#000000',
  mutedColor: '#444444',
  primaryBg: '#000000',
  primaryText: '#ffe600',
}

// 結果レコードの型
type Result = {
  id: number
  voter_name: string
  answer: string
  scores: { voter_name: string; score: number }[]
  total_score: number
  recorded_at: string
}

export default function EnkakuResultsPage() {
  const router = useRouter()
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 認証チェック
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    if (!localStorage.getItem('voterName')) { router.replace('/'); return }

    // 結果一覧を新しい順に取得
    supabase.from('enkaku_results')
      .select('*')
      .order('recorded_at', { ascending: false })
      .then(({ data }) => {
        if (data) setResults(data as Result[])
        setLoading(false)
      })
  }, [router])

  return (
    <div className="min-h-screen" style={{ background: th.pageBg }}>
      {/* ヘッダー */}
      <header style={{ background: th.pageBg, borderBottom: '3px solid #000' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/enkaku" className="font-black text-black hover:opacity-60 transition-opacity text-lg">←</Link>
          <Image src="/qol_logo.png" alt="QOL" width={80} height={27} style={{ objectFit: 'contain' }} priority />
          <span className="font-black text-black text-xs px-1.5 py-0.5" style={{ border: '2px solid #000' }}>結果一覧</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <p className="font-black text-center py-8" style={{ color: th.mutedColor }}>読み込み中...</p>
        ) : results.length === 0 ? (
          <p className="font-black text-center py-8" style={{ color: th.mutedColor }}>まだ記録がありません</p>
        ) : (
          results.map((r, i) => (
            <div key={r.id} style={{ background: '#fff', border: '2.5px solid #000' }}>
              {/* ヘッダー行: 番号・回答者・合計点 */}
              <div
                className="flex items-center justify-between px-4 py-2"
                style={{ borderBottom: '2px solid #000', background: '#000' }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-xs" style={{ color: '#ffe600' }}>#{results.length - i}</span>
                  <span className="font-black text-sm" style={{ color: '#ffe600' }}>👤 {r.voter_name}</span>
                </div>
                <span className="font-black text-lg" style={{ color: '#ffe600' }}>
                  {r.total_score}点
                </span>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* 回答内容 */}
                <div>
                  <p className="font-black text-xs mb-1" style={{ color: th.mutedColor }}>回答</p>
                  {r.answer.startsWith('data:image/') ? (
                    <img src={r.answer} alt="回答" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', border: '1.5px solid #eee' }} />
                  ) : (
                    <p className="font-black text-sm" style={{ color: th.titleColor, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {r.answer || '（回答なし）'}
                    </p>
                  )}
                </div>

                {/* 審査員スコア */}
                {r.scores.length > 0 && (
                  <div>
                    <p className="font-black text-xs mb-1" style={{ color: th.mutedColor }}>審査員スコア</p>
                    <div className="flex flex-wrap gap-2">
                      {r.scores.map((s, j) => (
                        <span
                          key={j}
                          className="font-black text-xs px-2 py-1"
                          style={{ background: '#f5f5f5', border: '1.5px solid #000' }}
                        >
                          {s.voter_name}：{s.score}点
                        </span>
                      ))}
                    </div>
                    {/* 計算式 */}
                    <p className="text-xs mt-1" style={{ color: th.mutedColor }}>
                      {r.scores.map((s) => s.score).join(' × ')} = {r.total_score}
                    </p>
                  </div>
                )}

                {/* 記録日時 */}
                <p className="text-xs" style={{ color: th.mutedColor }}>
                  {new Date(r.recorded_at).toLocaleString('ja-JP')}
                </p>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
