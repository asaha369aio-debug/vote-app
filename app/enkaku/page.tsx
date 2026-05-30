'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 遠隔加点ページ（準備中）
export default function EnkakuPage() {
  const router = useRouter()

  useEffect(() => {
    if (sessionStorage.getItem('siteAuth') !== '1') { router.replace('/'); return }
    if (!localStorage.getItem('voterName')) { router.replace('/'); return }
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#ffe600' }}>
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="font-black text-black hover:opacity-60 transition-opacity text-lg">←</Link>
          <Image src="/qol_logo.png" alt="QOL" width={100} height={34} style={{ objectFit: 'contain' }} priority />
          <span className="font-black text-black text-sm px-2 py-0.5" style={{ border: '2px solid #000' }}>遠隔加点</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 flex flex-col items-center gap-6">
        <p className="text-6xl">📡</p>
        <h1 className="text-3xl font-black text-center" style={{ color: '#000' }}>遠隔加点</h1>
        <p className="text-base font-bold text-center" style={{ color: '#444' }}>このページは現在準備中です</p>
        <Link href="/" className="font-black px-8 py-3 hover:opacity-80 transition-opacity" style={{ background: '#000', color: '#ffe600', fontSize: '1rem' }}>
          ← トップへ戻る
        </Link>
      </main>
    </div>
  )
}
