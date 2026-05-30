'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

export default function EnkakuPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)  // 全員に同期されるページ番号
  const pdfFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // 認証チェック
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    if (!localStorage.getItem('voterName')) { router.replace('/'); return }

    setIsAdmin(localStorage.getItem('isAdmin') === '1')

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

    // Realtimeでページ変更を即時反映
    const ch = supabase.channel('pdf-page')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pdf_settings' }, (payload) => {
        setCurrentPage(payload.new.current_page)
      }).subscribe()

    // Realtimeが途切れた場合のフォールバック: 2秒ごとにポーリング
    const poll = setInterval(async () => {
      const { data } = await supabase.from('pdf_settings').select('current_page').eq('id', 1).single()
      if (data) setCurrentPage(data.current_page)
    }, 2000)

    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [router])

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
    setCurrentPage(page)  // 楽観的更新（管理者画面は即座に切り替わる）
    await supabase.from('pdf_settings').update({ current_page: page }).eq('id', 1)
  }

  // PDFのiframe src: ページ番号・スクロールバー・ツールバーを制御するパラメータ付き
  const iframeSrc = pdfUrl
    ? `${pdfUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0&view=Fit`
    : ''

  return (
    <div className="min-h-screen" style={{ background: th.pageBg }}>
      {/* ヘッダー */}
      <header style={{ background: th.pageBg, borderBottom: '3px solid #000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-black text-black hover:opacity-60 transition-opacity text-lg">←</Link>
            <Image src="/qol_logo.png" alt="QOL" width={100} height={34} style={{ objectFit: 'contain' }} priority />
            <span className="font-black text-black text-sm px-2 py-0.5" style={{ border: '2px solid #000' }}>遠隔加点</span>
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

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        {pdfLoading ? (
          <div className="flex items-center justify-center py-16">
            <p className="font-black" style={{ color: th.mutedColor }}>読み込み中...</p>
          </div>
        ) : pdfUrl ? (
          <>
            {/* PDF表示エリア: overflow hidden + pointer-events none でスクロール完全無効 */}
            <div style={{ border: '2.5px solid #000', overflow: 'hidden', height: '220px', position: 'relative' }}>
              {/* key={currentPage} でページ変更時にiframeを強制再描画 */}
              {/* 非管理者: marginTop で上部ツールバーを隠す */}
              <iframe
                key={currentPage}
                src={iframeSrc}
                scrolling="no"
                style={{
                  width: '100%',
                  height: isAdmin ? '220px' : '265px',
                  marginTop: isAdmin ? '0' : '-45px',
                  border: 'none',
                  pointerEvents: 'none',
                  display: 'block',
                }}
                title={`PDF ${currentPage}ページ目`}
              />
            </div>

            {/* 管理者のみ: ページ番号表示 + ページ送りボタン */}
            {isAdmin && (
              <div className="flex items-center gap-4">
                <span className="font-black text-sm" style={{ color: th.mutedColor }}>
                  {currentPage} ページ
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  className="font-black px-6 py-2.5 hover:opacity-80 transition-opacity"
                  style={{ background: th.primaryBg, color: th.primaryText, border: '2px solid #000', fontSize: '1rem' }}
                >
                  次のページ →
                </button>
                {currentPage > 1 && (
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    className="font-black px-6 py-2.5 hover:opacity-80 transition-opacity"
                    style={{ background: '#fff', color: th.titleColor, border: '2px solid #000', fontSize: '1rem' }}
                  >
                    ← 前のページ
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          // PDF未設定時のプレースホルダー
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="text-5xl">📡</p>
            <p className="font-black text-lg" style={{ color: th.titleColor }}>遠隔加点</p>
            {isAdmin && (
              <p className="text-sm font-bold" style={{ color: th.mutedColor }}>「読み込み」ボタンからPDFを設定してください</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
