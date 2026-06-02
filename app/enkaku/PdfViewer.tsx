'use client'

import { Component, type ReactNode } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF.jsワーカーをCDNから読み込み（モバイル含む全ブラウザ対応）
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export const PDF_HEIGHT = 300

// react-pdf内部エラーをキャッチするエラー境界
class PdfErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p className="font-black text-sm" style={{ color: '#ff2200' }}>PDF表示エラー</p>
        </div>
      )
    }
    return this.props.children
  }
}

type Props = {
  pdfUrl: string
  currentPage: number
  mutedColor: string
  containerWidth: number
}

// ブラウザ専用コンポーネント（SSR無効で動的インポートされる）
export default function PdfViewer({ pdfUrl, currentPage, mutedColor, containerWidth }: Props) {
  // コンテナ幅が確定していない間はレンダリングしない（react-pdfのクラッシュ防止）
  if (!containerWidth || containerWidth < 20) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p className="font-black text-sm" style={{ color: mutedColor }}>読み込み中...</p>
      </div>
    )
  }

  return (
    <PdfErrorBoundary>
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
        {/* widthをコンテナ幅に固定してPDFを全幅表示（高さは比率で自動） */}
        <Page
          pageNumber={currentPage}
          width={containerWidth}
          renderAnnotationLayer={false}
          renderTextLayer={false}
        />
      </Document>
    </PdfErrorBoundary>
  )
}
