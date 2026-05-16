'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLogin() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      localStorage.setItem('isAdmin', '1')
      router.push('/')
    } else {
      setError(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#ffe600' }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🔐</p>
          <h1 className="text-2xl font-black text-black">管理者ログイン</h1>
        </div>
        <div style={{ background: '#ffffff', border: '2.5px solid #000000' }} className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-black text-black mb-2">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ border: '2px solid #000000', background: '#ffffff', color: '#000000' }}
                className="w-full px-4 py-3 focus:outline-none"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-center font-bold" style={{ color: '#ff2200' }}>✗ パスワードが間違っています</p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{ background: '#000000', color: '#ffe600' }}
              className="w-full font-black py-3 transition-opacity hover:opacity-80 disabled:opacity-50 text-lg"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>
        <div className="text-center mt-4">
          <Link href="/" className="text-sm font-bold text-black hover:opacity-60 transition-opacity">← 投票一覧に戻る</Link>
        </div>
      </div>
    </div>
  )
}
