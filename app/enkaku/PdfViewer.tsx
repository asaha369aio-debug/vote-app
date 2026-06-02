'use client'

import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF.jsワーカーをCDNから読み込み（モバイル含む全ブラウザ対応）
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export const PDF_HEIGHT = 300

type Props = {
  pdfUrl: string
  currentPage: number
  mutedColor: string
  containerWidth: number
}

// ブラウザ専用コンポーネント（SSR無効で動的インポートされる）
export default function PdfViewer({ pdfUrl, currentPage, mutedColor, containerWidth }: Props) {
  return (
    <Document
      file={pdfUrl}
      loading={
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p className="font-black text-sm" style={{ color: mutedColor }}>読み込み中...</p>
        </div>
      }
      error={
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p className="font-black text-sm" style={{ color: '#ff2200' }}>PDF読み込みエラー</p>
        </div>
      }
    >
      {/* heightを固定してPDF全ページを縦幅内に収める（幅は比率に応じて自動） */}
      <Page
        pageNumber={currentPage}
        height={PDF_HEIGHT}
        renderAnnotationLayer={false}
        renderTextLayer={false}
      />
    </Document>
  )
}
