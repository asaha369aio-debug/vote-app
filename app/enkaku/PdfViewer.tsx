'use client'

import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF.jsワーカーをCDNから読み込み（モバイル含む全ブラウザ対応）
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

// PDF表示の固定縦幅（全デバイス共通）
export const PDF_HEIGHT = 300

type Props = {
  pdfUrl: string
  currentPage: number
  mutedColor: string
}

// ブラウザ専用コンポーネント（SSR無効で動的インポートされる）
export default function PdfViewer({ pdfUrl, currentPage, mutedColor }: Props) {
  return (
    <Document
      file={pdfUrl}
      loading={
        <div style={{ height: PDF_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="font-black text-sm" style={{ color: mutedColor }}>読み込み中...</p>
        </div>
      }
      error={
        <div style={{ height: PDF_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="font-black text-sm" style={{ color: '#ff2200' }}>PDF読み込みエラー</p>
        </div>
      }
    >
      {/* height指定で全ページを縦幅内に収める（幅は自動スケール） */}
      <Page
        pageNumber={currentPage}
        height={PDF_HEIGHT}
        renderAnnotationLayer={false}
        renderTextLayer={false}
      />
    </Document>
  )
}
