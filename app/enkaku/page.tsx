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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)   // 表示中のPDF公開URL
  const [pdfLoading, setPdfLoading] = useState(true)
  const [pdfUploading, setPdfUploading] = useState(false)
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
  }, [router])

  // 管理者のみ: PDFをStorageにアップロード（upsertで上書き）
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfUploading(true)
    await supabase.storage.from(PDF_BUCKET).upload(PDF_FILE, file, { upsert: true })
    const { data } = supabase.storage.from(PDF_BUCKET).getPublicUrl(PDF_FILE)
    // キャッシュバスティング用タイムスタンプをクエリに付与
    setPdfUrl(data.publicUrl + '?t=' + Date.now())
    e.target.value = ''
    setPdfUploading(false)
  }

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

          {/* 管理者専用ボタン群 */}
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

      {/* PDFビューア */}
      <main style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 67px)' }}>
        {pdfLoading ? (
          // 読み込み中
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="font-black" style={{ color: th.mutedColor }}>読み込み中...</p>
          </div>
        ) : pdfUrl ? (
          // pointer-events: none でスクロール・操作を無効化し、管理者ボタンを下に配置
          <>
            <iframe
              src={pdfUrl}
              style={{ width: '100%', height: '300px', border: 'none', pointerEvents: 'none' }}
              title="PDF表示"
            />
            {/* 管理者のみ: フルスクリーンページへの遷移ボタン */}
            {isAdmin && (
              <div className="px-6 py-4">
                <Link
                  href="/pdf"
                  className="inline-block font-black px-6 py-2.5 hover:opacity-80 transition-opacity"
                  style={{ background: '#00aa44', color: '#fff', border: '2px solid #00aa44' }}
                >
                  フルスクリーンで開く →
                </Link>
              </div>
            )}
          </>
        ) : (
          // PDF未設定時のプレースホルダー
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <p className="text-5xl">📡</p>
            <p className="font-black text-lg" style={{ color: th.titleColor }}>遠隔加点</p>
            {isAdmin ? (
              <p className="text-sm font-bold" style={{ color: th.mutedColor }}>「読み込み」ボタンからPDFを設定してください</p>
            ) : (
              <p className="text-sm font-bold" style={{ color: th.mutedColor }}>PDFがまだ設定されていません</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
