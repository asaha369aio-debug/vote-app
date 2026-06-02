'use client'

import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF.jsワーカーをCDNから読み込み（モバイル含む全ブラウザ対応）
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type Props = {
  pdfUrl: string
  currentPage: number
  mutedColor: string
}

// ブラウザ専用コンポーネント（SSR無効で動的インポートされる）
export default function PdfViewer({ pdfUrl, currentPage, mutedColor }: Props) {
  return (
    // canvasをコンテナ幅に合わせて100%表示するCSSを注入
    <div style={{ width: '100%' }}>
      <style>{`
        .react-pdf__Page { width: 100% !important; }
        .react-pdf__Page canvas { width: 100% !important; height: auto !important; }
        .react-pdf__Page__canvas { width: 100% !important; height: auto !important; }
      `}</style>
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
        <Page
          pageNumber={currentPage}
          renderAnnotationLayer={false}
          renderTextLayer={false}
        />
      </Document>
    </div>
  )
}
