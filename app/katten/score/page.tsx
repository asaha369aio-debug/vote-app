'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// TAP/PDFページと同じバケット・ファイル名定数
const PDF_BUCKET = 'pdf-display'
const PDF_FILE = 'current.pdf'

type ScoreRow = { score: number; selected_user: string | null; created_at: string }

// 加点の合計点数をPDFに重ねて表示する専用画面（プロジェクター等での投影用）
export default function KattenScorePage() {
  const router = useRouter()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentSelected, setCurrentSelected] = useState<string | null>(null)
  const [totalScore, setTotalScore] = useState(0)

  // リアルタイムイベント内から最新の選択対象・ラウンドIDを参照するためのref
  const selectedRef = useRef<string | null>(null)
  const roundRef = useRef<string | null>(null)

  useEffect(() => {
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    if (!localStorage.getItem('voterName')) { router.replace('/'); return }

    supabase.storage.from(PDF_BUCKET).list('').then(({ data }) => {
      if (data?.some((f) => f.name === PDF_FILE)) {
        const { data: urlData } = supabase.storage.from(PDF_BUCKET).getPublicUrl(PDF_FILE)
        setPdfUrl(urlData.publicUrl)
      }
      setLoading(false)
    })

    // 対象・ラウンドが変わるたびに、そのラウンド分の合計点数を集計し直す
    const loadRound = async (selected: string | null, round: string | null) => {
      selectedRef.current = selected
      roundRef.current = round
      setCurrentSelected(selected)
      if (!selected || !round) { setTotalScore(0); return }
      const { data } = await supabase
        .from('katten_scores')
        .select('score')
        .eq('selected_user', selected)
        .gte('created_at', round)
      setTotalScore((data ?? []).reduce((sum, r) => sum + r.score, 0))
    }

    supabase.from('katten_current').select('selected_user, updated_at').eq('id', 1).single()
      .then(({ data }) => loadRound(data?.selected_user ?? null, data?.updated_at ?? null))

    // 管理者が対象を切り替えたら合計をリセットして集計し直す
    const currentChannel = supabase.channel('katten-score-display-current')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'katten_current' }, (payload) => {
        loadRound(payload.new.selected_user ?? null, payload.new.updated_at ?? null)
      }).subscribe()

    // 点数が送信されるたびに、現在のラウンド分であれば合計へ加算
    const scoreChannel = supabase.channel('katten-score-display-scores')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'katten_scores' }, (payload) => {
        const s = payload.new as ScoreRow
        if (selectedRef.current && roundRef.current && s.selected_user === selectedRef.current && s.created_at >= roundRef.current) {
          setTotalScore((prev) => prev + s.score)
        }
      }).subscribe()

    return () => {
      supabase.removeChannel(currentChannel)
      supabase.removeChannel(scoreChannel)
    }
  }, [router])

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      {/* ヘッダー */}
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000', flexShrink: 0, zIndex: 20 }}>
        <div className="px-6 py-3 flex items-center gap-3">
          <Link href="/katten" className="font-black text-black hover:opacity-60 transition-opacity text-lg">←</Link>
          <span className="font-black text-black text-sm">📺 点数表示</span>
        </div>
      </header>

      {/* メインコンテンツ: PDFをフルスクリーン表示 */}
      <main style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="font-black" style={{ color: '#fff' }}>読み込み中...</p>
          </div>
        ) : pdfUrl ? (
          <iframe src={pdfUrl} style={{ width: '100%', flex: 1, border: 'none' }} title="PDF全画面表示" />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <p className="text-4xl">📄</p>
            <p className="font-black" style={{ color: '#fff' }}>PDFがまだ設定されていません</p>
          </div>
        )}

        {/* 合計点数オーバーレイ: 画面右上に重ねて表示 */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            zIndex: 10,
            background: 'rgba(0,0,0,0.8)',
            border: '3px solid #ffe600',
            padding: '16px 28px',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <p className="font-black" style={{ color: '#ffe600', fontSize: '0.85rem', letterSpacing: '0.15em', marginBottom: '4px' }}>
            {currentSelected ?? '未選択'}
          </p>
          <p className="font-black" style={{ color: '#fff', fontSize: '3rem', lineHeight: 1 }}>
            {totalScore}
          </p>
        </div>
      </main>
    </div>
  )
}
