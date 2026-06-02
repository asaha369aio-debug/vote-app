'use client'

import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF.jsワーカーをCDNから読み込み（モバイル含む全ブラウザ対応）
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type Props = {
  pdfUrl: string
  currentPage: number
  containerWidth: number
  mutedColor: string
}

// ブラウザ専用コンポーネント（SSR無効で動的インポートされる）
export default function PdfViewer({ pdfUrl, currentPage, containerWidth, mutedColor }: Props) {
  return (
    <Document
      file={pdfUrl}
      loading={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
          <p className="font-black text-sm" style={{ color: mutedColor }}>読み込み中...</p>
        </div>
      }
      error={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
          <p className="font-black text-sm" style={{ color: '#ff2200' }}>PDF読み込みエラー</p>
        </div>
      }
    >
      <Page
        pageNumber={currentPage}
        width={containerWidth || undefined}
        renderAnnotationLayer={false}
        renderTextLayer={false}
      />
    </Document>
  )
}
