'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'

// SSRを無効にしてブラウザ専用のPDFビューアを動的インポート
const PdfViewer = dynamic(() => import('./PdfViewer'), { ssr: false })

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
  const [pdfContainerWidth, setPdfContainerWidth] = useState(0)  // PDFの描画幅（レスポンシブ対応）
  const pdfFileInputRef = useRef<HTMLInputElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)

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

    // DBから現在のページ番号を取得
    supabase.from('pdf_settings').select('current_page').eq('id', 1).single()
      .then(({ data }) => { if (data) setCurrentPage(data.current_page) })

    // 挙手リストの初期取得（raised_at昇順）
    supabase.from('enkaku_hands').select('*').order('raised_at', { ascending: true })
      .then(({ data }) => { if (data) setHands(data as Hand[]) })

    // Realtimeでページ変更を即時反映
    const pageCh = supabase.channel('pdf-page')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pdf_settings' }, (payload) => {
        setCurrentPage(payload.new.current_page)
      }).subscribe()

    // Realtimeで挙手を即時反映（INSERT）: 重複を除いて追加
    const handsCh = supabase.channel('enkaku-hands')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'enkaku_hands' }, (payload) => {
        setHands((prev) => prev.some((h) => h.id === payload.new.id) ? prev : [...prev, payload.new as Hand])
      }).subscribe()

    // Realtimeが途切れた場合のフォールバック: 2秒ごとにポーリング
    const poll = setInterval(async () => {
      const { data } = await supabase.from('pdf_settings').select('current_page').eq('id', 1).single()
      if (data) setCurrentPage(data.current_page)
    }, 2000)

    // コンテナ幅を取得してPDF描画幅を設定（リサイズにも対応）
    const updateWidth = () => {
      if (pdfContainerRef.current) setPdfContainerWidth(pdfContainerRef.current.clientWidth)
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)

    return () => {
      supabase.removeChannel(pageCh)
      supabase.removeChannel(handsCh)
      clearInterval(poll)
      window.removeEventListener('resize', updateWidth)
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
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-black text-black hover:opacity-60 transition-opacity text-lg">←</Link>
            <Image src="/qol_logo.png" alt="QOL" width={100} height={34} style={{ objectFit: 'contain' }} priority />
            <span className="font-black text-black text-sm px-2 py-0.5" style={{ border: '2px solid #000' }}>遠隔加点</span>
          </div>

          {/* ユーザー名表示・編集 */}
          <div className="flex items-center gap-2">
            {editingName ? (
              <form onSubmit={handleNameEdit} className="flex items-center gap-1">
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="w-24 text-sm px-2 py-1 focus:outline-none"
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
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 hover:opacity-70 transition-opacity"
                  style={{ border: '1px solid #000', borderRadius: '999px' }}
                >
                  <span>👤</span><span className="font-black">{voterName}</span><span className="text-xs opacity-40">✎</span>
                </button>
              )
            )}
          </div>

          {/* 管理者専用: PDF読み込みボタン */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => pdfFileInputRef.current?.click()}
                disabled={pdfUploading}
                className="font-black text-xs px-4 py-1.5 hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ background: th.primaryBg, color: th.primaryText, border: '2px solid #000' }}
              >
                {pdfUploading ? '読み込み中...' : '読み込み'}
              </button>
              <input
                ref={pdfFileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handlePdfUpload}
              />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {/* ユーザー名 + 役割切り替えカード（常に表示） */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: '#fff', border: '2.5px solid #000' }}
        >
          <span className="font-black text-sm" style={{ color: th.titleColor }}>
            👤 {voterName}
          </span>
          <div className="flex items-center gap-1">
            {(['回答者', '審査員'] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleRoleChange(r)}
                className="font-black text-xs px-3 py-1.5 transition-all hover:opacity-80"
                style={{
                  background: role === r ? th.primaryBg : '#eee',
                  color: role === r ? th.primaryText : '#666',
                  border: `2px solid ${role === r ? '#000' : '#ccc'}`,
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* PDFエリア + 挙手リスト（横並び） */}
        <div className="flex gap-3 items-start">
          {/* 左: PDFビューア */}
          <div style={{ flex: 3, minWidth: 0 }}>
            {pdfLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="font-black" style={{ color: th.mutedColor }}>読み込み中...</p>
              </div>
            ) : pdfUrl ? (
              <div ref={pdfContainerRef} style={{ border: '2.5px solid #000', overflow: 'hidden', height: '220px', position: 'relative', background: '#f5f5f5' }}>
                {/* SSR無効の動的インポートコンポーネントでCanvasレンダリング（モバイル対応） */}
                <PdfViewer
                  pdfUrl={pdfUrl}
                  currentPage={currentPage}
                  containerWidth={pdfContainerWidth}
                  mutedColor={th.mutedColor}
                />

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

          {/* 右: 挙手リスト */}
          <div style={{ flex: 2, minWidth: 0, border: '2.5px solid #000', background: '#fff', height: '220px', display: 'flex', flexDirection: 'column' }}>
            <div className="px-3 py-2 font-black text-xs" style={{ borderBottom: '2px solid #000', background: '#000', color: '#ffe600' }}>
              ✋ 挙手 {hands.length > 0 && `(${hands.length})`}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {hands.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: th.mutedColor }}>まだ挙手がありません</p>
              ) : (
                hands.map((h, i) => (
                  <div key={h.id} className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #eee' }}>
                    <span className="font-black text-xs" style={{ color: th.mutedColor, minWidth: '18px' }}>{i + 1}</span>
                    <span className="font-black text-sm" style={{ color: th.titleColor }}>{h.voter_name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 回答者のみ: テキスト入力ボックス + 挙手/公開ボタン（常に表示） */}
        {role === '回答者' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="回答を入力してください"
              className="w-full focus:outline-none"
              style={{ border: '2.5px solid #000', padding: '14px 16px', fontSize: '1rem', background: '#fff', color: '#000' }}
            />
            <div className="flex gap-3">
              <button
                onClick={handleRaiseHand}
                className="flex-1 font-black text-base py-3 hover:opacity-80 transition-opacity active:scale-95"
                style={{ background: '#fff', color: th.titleColor, border: '2.5px solid #000' }}
              >
                挙手
              </button>
              <button
                className="flex-1 font-black text-base py-3 hover:opacity-80 transition-opacity active:scale-95"
                style={{ background: th.primaryBg, color: th.primaryText, border: '2.5px solid #000' }}
              >
                公開
              </button>
            </div>
          </div>
        )}

        {/* 審査員のみ: 採点ボタン（常に表示） */}
        {role === '審査員' && (
          <div className="flex gap-3">
            {['0', '1', '2', '3'].map((label) => (
              <button
                key={label}
                className="flex-1 font-black text-2xl py-4 hover:opacity-80 transition-opacity active:scale-95"
                style={{ background: '#fff', color: th.titleColor, border: '2.5px solid #000' }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
