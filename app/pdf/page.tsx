'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// TAPページと同じバケット・ファイル名定数
const PDF_BUCKET = 'pdf-display'
const PDF_FILE = 'current.pdf'

// PDFをフルスクリーンで表示する専用ページ
export default function PdfPage() {
  const router = useRouter()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 認証チェック（サイトパスワード・名前未入力はトップへ戻す）
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    if (!localStorage.getItem('voterName')) { router.replace('/'); return }

    // Storageにcurrent.pdfが存在すればURLを取得
    supabase.storage.from(PDF_BUCKET).list('').then(({ data }) => {
      if (data?.some((f) => f.name === PDF_FILE)) {
        const { data: urlData } = supabase.storage.from(PDF_BUCKET).getPublicUrl(PDF_FILE)
        setPdfUrl(urlData.publicUrl)
      }
      setLoading(false)
    })
  }, [router])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      {/* ヘッダー */}
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000', flexShrink: 0 }}>
        <div className="px-6 py-3 flex items-center gap-3">
          <Link href="/" className="font-black text-black hover:opacity-60 transition-opacity text-lg">←</Link>
          <span className="font-black text-black text-sm">📄 PDF</span>
        </div>
      </header>

      {/* メインコンテンツ: iframeでPDFをフルスクリーン表示 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="font-black" style={{ color: '#fff' }}>読み込み中...</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            style={{ width: '100%', flex: 1, border: 'none' }}
            title="PDF全画面表示"
          />
        ) : (
          // PDFが未設定の場合
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <p className="text-4xl">📄</p>
            <p className="font-black" style={{ color: '#fff' }}>PDFがまだ設定されていません</p>
            <Link href="/" className="font-black px-6 py-2.5 hover:opacity-80 transition-opacity" style={{ background: '#ffe600', color: '#000' }}>
              ← トップへ戻る
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
