'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'

// SSRを無効にしてブラウザ専用のPDFビューアを動的インポート
const PdfViewer = dynamic(() => import('./PdfViewer'), { ssr: false })

// PDFと挙手リストの共通固定縦幅
const PDF_HEIGHT = 300

// PDF表示用Storageバケット・固定ファイル名
const PDF_BUCKET = 'pdf-display'
const PDF_FILE = 'current.pdf'

// テーマカラー
const th = {
  pageBg: '#ffe600',
  titleColor: '#000000',
  mutedColor: '#444444',
  primaryBg: '#000000',
  primaryText: '#ffe600',
}

// 挙手レコードの型
type Hand = { id: number; voter_name: string; raised_at: string }
// 採点レコードの型
type Score = { id: number; voter_name: string; score: number }

export default function EnkakuPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [voterName, setVoterName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editNameInput, setEditNameInput] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)  // 全員に同期されるページ番号
  const [role, setRole] = useState<'回答者' | '審査員'>('回答者')  // ユーザーの役割
  const [hands, setHands] = useState<Hand[]>([])  // 挙手済みユーザー一覧
  const [score, setScore] = useState<string | null>(null)      // 審査員が選択中の数字
  const [scores, setScores] = useState<Score[]>([])             // 全審査員の送信済みスコア
  const [answerInput, setAnswerInput] = useState('')            // 回答者の入力テキスト（ローカル）
  const [displayAnswer, setDisplayAnswer] = useState('')        // 全員に表示される公開済み回答
  const [inputMode, setInputMode] = useState<'text' | 'draw'>('text')  // 入力モード
  const [pdfContainerWidth, setPdfContainerWidth] = useState(0)
  const pdfFileInputRef = useRef<HTMLInputElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const answerTextareaRef = useRef<HTMLTextAreaElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  // マウント直後に幅を取得するコールバックref（ResizeObserverのタイミング問題を回避）
  const pdfContainerCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    pdfContainerRef.current = node
    setPdfContainerWidth(node.clientWidth)
    const observer = new ResizeObserver((entries) => {
      setPdfContainerWidth(entries[0].contentRect.width)
    })
    observer.observe(node)
  }, [])

  useEffect(() => {
    // 認証チェック
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    if (!localStorage.getItem('voterName')) { router.replace('/'); return }

    setIsAdmin(localStorage.getItem('isAdmin') === '1')
    setVoterName(localStorage.getItem('voterName') ?? '')
    const savedRole = localStorage.getItem('enkakuRole')
    if (savedRole === '審査員') setRole('審査員')

    // StorageにPDFが存在すれば公開URLを取得
    supabase.storage.from(PDF_BUCKET).list('').then(({ data }) => {
      if (data?.some((f) => f.name === PDF_FILE)) {
        const { data: urlData } = supabase.storage.from(PDF_BUCKET).getPublicUrl(PDF_FILE)
        setPdfUrl(urlData.publicUrl)
      }
      setPdfLoading(false)
    })

    // DBから現在のページ番号と公開済み回答を取得
    supabase.from('pdf_settings').select('current_page, current_answer').eq('id', 1).single()
      .then(({ data }) => {
        if (data) {
          setCurrentPage(data.current_page)
          setDisplayAnswer(data.current_answer ?? '')
        }
      })

    // 挙手リストの初期取得（raised_at昇順）
    supabase.from('enkaku_hands').select('*').order('raised_at', { ascending: true })
      .then(({ data }) => { if (data) setHands(data as Hand[]) })

    // スコアリストの初期取得
    supabase.from('enkaku_scores').select('*')
      .then(({ data }) => { if (data) setScores(data as Score[]) })

    // Realtimeでページ変更・公開回答を即時反映
    const pageCh = supabase.channel('pdf-page')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pdf_settings' }, (payload) => {
        setCurrentPage(payload.new.current_page)
        setDisplayAnswer(payload.new.current_answer ?? '')
      }).subscribe()

    // RealtimeでINSERT・DELETEを即時反映（挙手）
    const handsCh = supabase.channel('enkaku-hands')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'enkaku_hands' }, (payload) => {
        setHands((prev) => prev.some((h) => h.id === payload.new.id) ? prev : [...prev, payload.new as Hand])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'enkaku_hands' }, (payload) => {
        setHands((prev) => prev.filter((h) => h.id !== payload.old.id))
      })
      .subscribe()

    // RealtimeでINSERT・UPDATE・DELETEを即時反映（採点）
    const scoresCh = supabase.channel('enkaku-scores')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'enkaku_scores' }, (payload) => {
        setScores((prev) => prev.some((s) => s.id === payload.new.id) ? prev : [...prev, payload.new as Score])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'enkaku_scores' }, (payload) => {
        setScores((prev) => prev.map((s) => s.id === payload.new.id ? payload.new as Score : s))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'enkaku_scores' }, () => {
        // DELETEは全削除（次の人）なので全クリア
        setScores([])
      })
      .subscribe()

    // Realtimeが途切れた場合のフォールバック: 2秒ごとにポーリング
    const poll = setInterval(async () => {
      const { data: pageData } = await supabase.from('pdf_settings').select('current_page, current_answer').eq('id', 1).single()
      if (pageData) { setCurrentPage(pageData.current_page); setDisplayAnswer(pageData.current_answer ?? '') }

      const { data: handsData } = await supabase.from('enkaku_hands').select('*').order('raised_at', { ascending: true })
      if (handsData) setHands((prev) => prev.length !== handsData.length ? handsData as Hand[] : prev)

      const { data: scoresData } = await supabase.from('enkaku_scores').select('*')
      if (scoresData) setScores(scoresData as Score[])
    }, 2000)

    return () => {
      supabase.removeChannel(pageCh)
      supabase.removeChannel(handsCh)
      supabase.removeChannel(scoresCh)
      clearInterval(poll)
    }
  }, [router])

  // 役割を切り替えてlocalStorageに保存
  const handleRoleChange = (newRole: '回答者' | '審査員') => {
    setRole(newRole)
    localStorage.setItem('enkakuRole', newRole)
  }

  // ユーザー名を編集して保存
  const handleNameEdit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = editNameInput.trim()
    if (!trimmed) return
    localStorage.setItem('voterName', trimmed)
    setVoterName(trimmed)
    setEditingName(false)
  }

  // 管理者のみ: PDFをStorageにアップロード（upsertで上書き）
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfUploading(true)
    await supabase.storage.from(PDF_BUCKET).upload(PDF_FILE, file, { upsert: true })
    const { data } = supabase.storage.from(PDF_BUCKET).getPublicUrl(PDF_FILE)
    // キャッシュバスティング用タイムスタンプをクエリに付与し、ページを先頭に戻す
    setPdfUrl(data.publicUrl + '?t=' + Date.now())
    await supabase.from('pdf_settings').update({ current_page: 1 }).eq('id', 1)
    e.target.value = ''
    setPdfUploading(false)
  }

  // 管理者のみ: ローカルを即時更新してからDBに書き込み → リアルタイムで全員に反映
  const goToPage = async (page: number) => {
    if (page < 1) return
    setCurrentPage(page)
    await supabase.from('pdf_settings').update({ current_page: page }).eq('id', 1)
  }

  // 管理者のみ: 結果を記録してから挙手・スコア・回答をクリアして次の人へ
  const handleNextPerson = async () => {
    const first = hands[0]
    if (!first) return
    // PDFコンテナ内のcanvasをキャプチャしてスクリーンショットを取得
    const pdfCanvas = pdfContainerRef.current?.querySelector('canvas')
    let pdfScreenshot = ''
    if (pdfCanvas) {
      try { pdfScreenshot = pdfCanvas.toDataURL('image/jpeg', 0.8) } catch { /* CORS等でキャプチャ失敗時はスキップ */ }
    }
    // 現在のスコア・回答・PDFスクリーンショットをDBに記録
    const totalScore = scores.length > 0 ? scores.reduce((acc, s) => acc * s.score, 1) : 0
    await supabase.from('enkaku_results').insert({
      voter_name: first.voter_name,
      answer: displayAnswer,
      scores: scores.map((s) => ({ voter_name: s.voter_name, score: s.score })),
      total_score: totalScore,
      pdf_screenshot: pdfScreenshot || null,
    })
    // クリア処理
    setHands((prev) => prev.slice(1))
    setScores([])
    setDisplayAnswer('')
    await supabase.from('enkaku_hands').delete().eq('id', first.id)
    await supabase.from('enkaku_scores').delete().neq('id', 0)
    await supabase.from('pdf_settings').update({ current_answer: '' }).eq('id', 1)
  }

  // canvasのタッチ・マウス座標をcanvas内座標に変換
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const src = 'touches' in e ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY }
  }

  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    isDrawingRef.current = true
    lastPosRef.current = getCanvasPos(e)
  }

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawingRef.current || !lastPosRef.current) return
    const ctx = drawCanvasRef.current!.getContext('2d')!
    const pos = getCanvasPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPosRef.current = pos
  }

  const handleDrawEnd = () => {
    isDrawingRef.current = false
    lastPosRef.current = null
  }

  const clearCanvas = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

  // 回答者: テキストまたはcanvas画像をDBに保存して全員に公開
  const handlePublishAnswer = async () => {
    let value = answerInput
    if (inputMode === 'draw') {
      const canvas = drawCanvasRef.current
      if (!canvas) return
      value = canvas.toDataURL('image/png')
    }
    setDisplayAnswer(value)
    await supabase.from('pdf_settings').update({ current_answer: value }).eq('id', 1)
  }

  // 審査員: 選択中のスコアを送信（同名なら上書きupsert）
  const handleSendScore = async () => {
    if (score === null) return
    const val = parseInt(score)
    const { data } = await supabase
      .from('enkaku_scores')
      .upsert({ voter_name: voterName, score: val }, { onConflict: 'voter_name' })
      .select().single()
    if (data) setScores((prev) => {
      const exists = prev.find((s) => s.voter_name === voterName)
      return exists ? prev.map((s) => s.voter_name === voterName ? data as Score : s) : [...prev, data as Score]
    })
  }

  // answerInputの内容に応じてtextareaの高さを自動調整
  useEffect(() => {
    const el = answerTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [answerInput])

  // 挙手ボタン: DBに登録しつつローカルにも即時反映（楽観的更新）
  const handleRaiseHand = async () => {
    const { data, error } = await supabase
      .from('enkaku_hands')
      .insert({ voter_name: voterName })
      .select()
      .single()
    if (!error && data) {
      // Realtimeが届く前に自分の画面へ即時追加
      setHands((prev) => [...prev, data as Hand])
    }
  }

  return (
    <div className="min-h-screen" style={{ background: th.pageBg }}>
      {/* ヘッダー */}
      <header style={{ background: th.pageBg, borderBottom: '3px solid #000' }}>
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
          {/* 左: 戻るボタン + ロゴ + ラベル */}
          <div className="flex items-center gap-2" style={{ flex: '0 0 auto' }}>
            <Link href="/" className="font-black text-black hover:opacity-60 transition-opacity">←</Link>
            <Image src="/qol_logo.png" alt="QOL" width={80} height={27} style={{ objectFit: 'contain' }} priority />
            <span className="font-black text-black text-xs px-1.5 py-0.5" style={{ border: '2px solid #000' }}>遠隔加点</span>
          </div>

          {/* 右: ユーザー名 + 管理者ボタン */}
          <div className="flex items-center gap-2" style={{ flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {/* ユーザー名表示・編集 */}
            {editingName ? (
              <form onSubmit={handleNameEdit} className="flex items-center gap-1">
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="w-20 text-xs px-2 py-1 focus:outline-none"
                  style={{ border: '1px solid #000', background: 'rgba(0,0,0,0.08)' }}
                  placeholder="新しい名前"
                  autoFocus
                  maxLength={20}
                />
                <button type="submit" className="text-xs font-black px-2 py-1 hover:opacity-80" style={{ background: 'rgba(0,0,0,0.12)' }}>変更</button>
                <button type="button" onClick={() => setEditingName(false)} className="text-xs px-1 hover:opacity-80">✕</button>
              </form>
            ) : (
              voterName && (
                <button
                  onClick={() => { setEditNameInput(voterName); setEditingName(true) }}
                  className="flex items-center gap-1 text-xs px-2 py-1 hover:opacity-70 transition-opacity"
                  style={{ border: '1px solid #000', borderRadius: '999px' }}
                >
                  <span>👤</span><span className="font-black">{voterName}</span><span className="opacity-40">✎</span>
                </button>
              )
            )}

            {/* 管理者専用: PDF読み込み + 次の人ボタン */}
            {isAdmin && (
              <>
                <button
                  onClick={() => pdfFileInputRef.current?.click()}
                  disabled={pdfUploading}
                  className="font-black text-xs px-3 py-1.5 hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{ background: th.primaryBg, color: th.primaryText, border: '2px solid #000' }}
                >
                  {pdfUploading ? '読み込み中...' : '読み込み'}
                </button>
                <input ref={pdfFileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
                <button
                  onClick={handleNextPerson}
                  disabled={hands.length === 0}
                  className="font-black text-xs px-3 py-1.5 hover:opacity-80 transition-opacity disabled:opacity-40"
                  style={{ background: '#00aa44', color: '#fff', border: '2px solid #000' }}
                >
                  次の人 →
                </button>
              </>
            )}
            <Link
              href="/enkaku/results"
              className="font-black text-xs px-3 py-1.5 hover:opacity-80 transition-opacity"
              style={{ background: '#0033cc', color: '#fff', border: '2px solid #000' }}
            >
              結果一覧
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3" style={{ overflowX: 'hidden' }}>
        {/* 全体レイアウト: グリッド（左列=残り幅、右列=90px固定） */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '12px' }}>

          {/* 左列: ユーザー名カード + PDFビューア */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* 役割切り替え + ユーザー名カード */}
            <div
              className="flex flex-col"
              style={{ background: '#fff', border: '2.5px solid #000', borderBottom: 'none', padding: '6px 12px' }}
            >
              {/* 上段: 役割切り替えボタン */}
              <div className="flex gap-1 mb-1">
                {(['回答者', '審査員'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className="font-black transition-all hover:opacity-80"
                    style={{
                      background: role === r ? th.primaryBg : '#eee',
                      color: role === r ? th.primaryText : '#666',
                      border: `1.5px solid ${role === r ? '#000' : '#ccc'}`,
                      fontSize: '0.65rem',
                      padding: '2px 8px',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {/* 下段: 挙手リスト1番目のユーザー名 */}
              <span className="font-black" style={{ color: th.titleColor, fontSize: '0.75rem' }}>
                👤 {hands[0]?.voter_name ?? '—'}
              </span>
            </div>

            {/* PDFビューア */}
            {pdfLoading ? (
              <div className="flex items-center justify-center" style={{ height: PDF_HEIGHT, border: '2.5px solid #000', background: '#f5f5f5' }}>
                <p className="font-black" style={{ color: th.mutedColor }}>読み込み中...</p>
              </div>
            ) : pdfUrl ? (
              <div ref={pdfContainerCallback} style={{ border: '2.5px solid #000', position: 'relative', background: '#f5f5f5' }}>
                <PdfViewer
                  pdfUrl={pdfUrl}
                  currentPage={currentPage}
                  mutedColor={th.mutedColor}
                  containerWidth={pdfContainerWidth}
                />
                {/* PublishedAnswerBanner: PDF下部にオーバーレイ表示（z-index: 1） */}
                {displayAnswer !== '' && (
                  <div style={{
                    position: 'absolute', left: 0, right: 0,
                    // フリーハンド画像: PDF中央から下部まで / テキスト: 下端の帯
                    ...(displayAnswer.startsWith('data:image/')
                      ? { top: '50%', bottom: 0 }
                      : { bottom: 0 }),
                    zIndex: 1, pointerEvents: 'none',
                    background: 'rgba(255,255,255,0.92)', borderTop: '2.5px solid #000',
                    padding: displayAnswer.startsWith('data:image/') ? 0 : '10px 16px',
                    textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {displayAnswer.startsWith('data:image/') ? (
                      // フリーハンド画像: 4:3のバナー内に収める
                      <img src={displayAnswer} alt="回答" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    ) : (
                      <span style={{ fontWeight: 900, fontSize: '1.05rem', color: th.titleColor, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                        {displayAnswer}
                      </span>
                    )}
                  </div>
                )}

                {/* ScoreOverlay: PDF中央にオーバーレイ表示（z-index: 2、PublishedAnswerBannerの上） */}
                {scores.length > 0 && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none', zIndex: 2,
                  }}>
                    <span style={{
                      fontSize: '8rem', fontWeight: 900, lineHeight: 1,
                      color: '#ffe600',
                      textShadow: '0 0 12px #000, 0 0 4px #000',
                      WebkitTextStroke: '3px #000',
                    }}>
                      {scores.reduce((acc, s) => acc * s.score, 1)}
                    </span>
                  </div>
                )}

                {/* 管理者のみ: PDF上に重ねたページ送りボタン */}
                {isAdmin && (
                  <div className="flex items-center gap-2" style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <span className="font-black text-xs px-2 py-1" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                      {currentPage}p
                    </span>
                    {currentPage > 1 && (
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        className="font-black text-xs px-2 py-1 hover:opacity-80 transition-opacity"
                        style={{ background: 'rgba(255,255,255,0.9)', color: th.titleColor, border: '1.5px solid #000' }}
                      >
                        ←
                      </button>
                    )}
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      className="font-black text-xs px-2 py-1 hover:opacity-80 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.85)', color: '#ffe600', border: '1.5px solid #000' }}
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              isAdmin && (
                <p className="text-sm font-bold text-center py-4" style={{ color: th.mutedColor }}>
                  「読み込み」ボタンからPDFを設定してください
                </p>
              )
            )}
          </div>

          {/* 右列: 挙手リスト（グリッドで左列と同じ高さに自動揃え） */}
          <div style={{ border: '2.5px solid #000', background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div className="px-3 py-2 font-black text-xs" style={{ borderBottom: '2px solid #000', background: '#000', color: '#ffe600' }}>
              ✋ 挙手 {hands.length > 0 && `(${hands.length})`}
            </div>
            {/* 5行分の高さでスクロール表示 */}
            <div style={{ overflowY: 'auto', maxHeight: '150px', padding: '4px 0', WebkitOverflowScrolling: 'touch' }}>
              {hands.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: th.mutedColor }}>まだ挙手がありません</p>
              ) : (
                hands.map((h) => (
                  <div key={h.id} className="px-2 py-1.5" style={{ borderBottom: '1px solid #eee' }}>
                    <span className="font-black text-xs" style={{ color: th.titleColor, wordBreak: 'break-all' }}>{h.voter_name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 回答者のみ: テキスト入力ボックス + 挙手/公開ボタン（常に表示） */}
        {role === '回答者' && (
          <div className="space-y-3">
            {/* 入力モード切替ボタン */}
            <div className="flex gap-1">
              {(['text', 'draw'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className="font-black text-xs px-3 py-1.5 transition-all hover:opacity-80"
                  style={{
                    background: inputMode === mode ? '#000' : '#fff',
                    color: inputMode === mode ? '#ffe600' : '#000',
                    border: `2px solid #000`,
                  }}
                >
                  {mode === 'text' ? '✏️ テキスト' : '🖊 フリーハンド'}
                </button>
              ))}
            </div>

            {/* テキストモード */}
            {inputMode === 'text' && (
              <textarea
                ref={answerTextareaRef}
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="回答を入力してください"
                rows={1}
                className="w-full focus:outline-none resize-none overflow-hidden"
                style={{ border: '2.5px solid #000', padding: '14px 16px', fontSize: '1rem', background: '#fff', color: '#000', lineHeight: '1.5' }}
              />
            )}

            {/* フリーハンドモード */}
            {inputMode === 'draw' && (
              <div style={{ border: '2.5px solid #000', background: '#fff', position: 'relative' }}>
                <canvas
                  ref={drawCanvasRef}
                  width={600}
                  height={338}
                  style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
                  onMouseDown={handleDrawStart}
                  onMouseMove={handleDrawMove}
                  onMouseUp={handleDrawEnd}
                  onMouseLeave={handleDrawEnd}
                  onTouchStart={handleDrawStart}
                  onTouchMove={handleDrawMove}
                  onTouchEnd={handleDrawEnd}
                />
                <button
                  onClick={clearCanvas}
                  className="absolute top-2 right-2 font-black text-xs px-2 py-1 hover:opacity-80"
                  style={{ background: '#ff2200', color: '#fff', border: '1.5px solid #000' }}
                >
                  クリア
                </button>
              </div>
            )}
            <div className="flex gap-3">
              {/* すでに挙手済みの場合はボタンを無効化 */}
              <button
                onClick={handleRaiseHand}
                disabled={hands.some((h) => h.voter_name === voterName)}
                className="flex-1 font-black text-base py-3 hover:opacity-80 transition-opacity active:scale-95 disabled:opacity-30"
                style={{ background: '#fff', color: th.titleColor, border: '2.5px solid #000' }}
              >
                挙手
              </button>
              {/* 挙手リスト1番目のユーザーのみ公開可能 */}
              <button
                onClick={handlePublishAnswer}
                disabled={voterName !== hands[0]?.voter_name}
                className="flex-1 font-black text-base py-3 hover:opacity-80 transition-opacity active:scale-95 disabled:opacity-30"
                style={{ background: th.primaryBg, color: th.primaryText, border: '2.5px solid #000' }}
              >
                公開
              </button>
            </div>
          </div>
        )}

        {/* 審査員のみ: 採点ボタン + 送信ボタン */}
        {role === '審査員' && (
          <div className="space-y-3">
            <div className="flex gap-3">
              {['0', '1', '2', '3'].map((label) => (
                <button
                  key={label}
                  onClick={() => setScore((prev) => prev === label ? null : label)}
                  className="flex-1 font-black text-2xl py-4 hover:opacity-80 transition-opacity active:scale-95"
                  style={{
                    background: score === label ? th.primaryBg : '#fff',
                    color: score === label ? th.primaryText : th.titleColor,
                    border: '2.5px solid #000',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* スコア送信ボタン: 選択中の数字を全員に送信して掛け合わせ表示 */}
            <button
              onClick={handleSendScore}
              disabled={score === null}
              className="w-full font-black py-3 hover:opacity-80 transition-opacity disabled:opacity-40 active:scale-95"
              style={{ background: '#ff2200', color: '#fff', border: '2.5px solid #000', fontSize: '1.1rem' }}
            >
              {score ?? '?'}点を送る
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
