'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, type QuickWord } from '@/lib/supabase'

const KEYBOARD_OFF_KEY = 'keyboardOff'

// F デザイン カラーブロック用アクセントカラー
const ACCENTS = ['#ff2200', '#0033cc', '#00aa44', '#ff6600']

export default function CreateBunkatsu() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [loading, setLoading] = useState(false)
  const [quickWords, setQuickWords] = useState<QuickWord[]>([])
  const [newWord, setNewWord] = useState('')
  const [showAddWord, setShowAddWord] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [keyboardOff, setKeyboardOff] = useState(false)

  const questionRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== '1') { router.replace('/'); return }
    setKeyboardOff(localStorage.getItem(KEYBOARD_OFF_KEY) === '1')
    supabase.from('quick_words').select('*').order('created_at').then(({ data }) => setQuickWords(data ?? []))

    const channel = supabase.channel('quick-words')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quick_words' }, (payload) => {
        setQuickWords((prev) => prev.some((w) => w.id === payload.new.id) ? prev : [...prev, payload.new as QuickWord])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'quick_words' }, (payload) => {
        setQuickWords((prev) => prev.filter((w) => w.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const toggleKeyboardOff = () => {
    const next = !keyboardOff
    setKeyboardOff(next)
    localStorage.setItem(KEYBOARD_OFF_KEY, next ? '1' : '0')
  }

  const insertWord = (word: string) => {
    if (!focusedField) return
    if (focusedField === 'question') {
      const el = questionRef.current; if (!el) return
      const start = el.selectionStart ?? question.length
      const end = el.selectionEnd ?? question.length
      const next = question.slice(0, start) + word + question.slice(end)
      setQuestion(next)
      setTimeout(() => el.setSelectionRange(start + word.length, start + word.length), 0)
    } else if (focusedField.startsWith('option-')) {
      const index = parseInt(focusedField.replace('option-', ''), 10)
      const el = optionRefs.current[index]; if (!el) return
      const current = options[index]
      const start = el.selectionStart ?? current.length
      const end = el.selectionEnd ?? current.length
      const next = current.slice(0, start) + word + current.slice(end)
      updateOption(index, next)
      setTimeout(() => el.setSelectionRange(start + word.length, start + word.length), 0)
    }
  }

  const handleAddWord = async () => {
    const trimmed = newWord.trim()
    if (!trimmed || quickWords.some((w) => w.word === trimmed)) return
    setNewWord(''); setShowAddWord(false)
    const res = await fetch('/api/admin/quick-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: trimmed }),
    })
    if (res.ok) {
      const { word } = await res.json()
      setQuickWords((prev) => prev.some((w) => w.id === word.id) ? prev : [...prev, word])
    } else if (res.status === 401) {
      alert('管理者セッションが切れています。管理者ログインをやり直してください。')
    } else {
      alert('ワードの追加に失敗しました。')
    }
  }

  const deleteWord = async (id: string) => {
    const res = await fetch(`/api/admin/quick-words/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setQuickWords((prev) => prev.filter((w) => w.id !== id))
    } else if (res.status === 401) {
      alert('管理者セッションが切れています。管理者ログインをやり直してください。')
    } else {
      alert('ワードの削除に失敗しました。')
    }
  }

  const addOption = () => setOptions([...options, ''])
  const updateOption = (index: number, value: string) => {
    const updated = [...options]; updated[index] = value; setOptions(updated)
  }
  const removeOption = (index: number) => setOptions(options.filter((_, i) => i !== index))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validOptions = options.filter((o) => o.trim() !== '')
    if (!question.trim() || validOptions.length < 2) return
    setLoading(true)
    const res = await fetch('/api/admin/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), options: validOptions, category: 'bunkatsu' }),
    })
    if (!res.ok) { setLoading(false); return }
    router.push(`/bunkatsu`)
  }

  return (
    <div className="min-h-screen" style={{ background: '#ffe600' }}>
      {/* ヘッダー */}
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/bunkatsu" className="font-black text-black hover:opacity-60 transition-opacity text-sm">← 戻る</Link>
          <span className="text-black/40 font-bold">|</span>
          <h1 className="text-xl font-black text-black">新しい分割一覧を作成</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div style={{ background: '#ffffff', border: '2.5px solid #000000' }} className="p-6 space-y-6">

          {/* クイック入力パレット */}
          <div style={{ background: '#ffe600', border: '2px solid #000000' }} className="p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <p className="text-sm font-black text-black">⚡ クイック入力</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleKeyboardOff}
                  style={{ background: keyboardOff ? '#ff2200' : '#ffffff', color: keyboardOff ? '#ffffff' : '#000000', border: '1.5px solid #000000' }}
                  className="text-xs font-black px-2 py-1 transition-opacity hover:opacity-80"
                  title="端末のキーボードが出ないようにします"
                >
                  ⌨️ キーボード: {keyboardOff ? 'OFF' : 'ON'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteMode((v) => !v)}
                  style={{ background: deleteMode ? '#ff2200' : '#ffffff', color: deleteMode ? '#ffffff' : '#000000', border: '1.5px solid #000000' }}
                  className="text-xs font-black px-2 py-1 transition-opacity hover:opacity-80"
                  title="ONの間はワードを押すと削除されます"
                >
                  🗑️ 削除モード: {deleteMode ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddWord((v) => !v)}
                  className="text-xs font-black transition-opacity hover:opacity-60"
                  style={{ color: '#0033cc' }}
                >
                  {showAddWord ? 'キャンセル' : '＋ ワードを追加'}
                </button>
              </div>
            </div>

            {showAddWord && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddWord())}
                  placeholder="追加するワードを入力"
                  style={{ border: '2px solid #000000', background: '#ffffff', color: '#000000' }}
                  className="flex-1 px-3 py-1.5 text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddWord}
                  style={{ background: '#000000', color: '#ffe600' }}
                  className="text-sm font-black px-3 py-1.5 transition-opacity hover:opacity-80"
                >
                  追加
                </button>
              </div>
            )}

            {quickWords.length === 0 ? (
              <p className="text-sm text-black/50">ワードがありません。追加してください。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {quickWords.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => deleteMode ? deleteWord(w.id) : insertWord(w.word)}
                    style={{
                      border: `2px solid ${deleteMode ? '#ff2200' : '#000000'}`,
                      background: deleteMode ? '#ffffff' : (focusedField ? '#000000' : '#ffffff'),
                      color: deleteMode ? '#ff2200' : (focusedField ? '#ffe600' : '#000000'),
                    }}
                    className="text-sm px-3 py-1 font-bold transition-all"
                  >
                    {deleteMode ? '🗑️ ' : ''}{w.word}
                  </button>
                ))}
              </div>
            )}
            {deleteMode ? (
              <p className="text-xs font-bold mt-2" style={{ color: '#ff2200' }}>削除モード中: ワードを押すと削除されます</p>
            ) : !focusedField && (
              <p className="text-xs text-black/40 mt-2">入力欄をクリックしてからワードを押すと入力されます</p>
            )}
          </div>

          {/* 作成フォーム */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-black text-black mb-2">📝 質問</label>
              <div className="flex gap-2">
                <input
                  ref={questionRef}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onFocus={() => setFocusedField('question')}
                  placeholder="例: 好きなプログラミング言語は？"
                  style={{ border: '2px solid #000000', background: '#ffffff', color: '#000000' }}
                  className="flex-1 px-4 py-3 focus:outline-none"
                  readOnly={keyboardOff}
                  inputMode={keyboardOff ? 'none' : 'text'}
                  required
                />
                {keyboardOff && question && (
                  <button type="button" onClick={() => setQuestion('')} style={{ border: '2px solid #000000', background: '#ffffff', color: '#ff2200' }} className="px-3 font-black hover:opacity-60 transition-opacity" title="クリア">✕</button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-black text-black mb-2">🎯 選択肢</label>
              <div className="space-y-3">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="w-5 h-5 flex-shrink-0" style={{ background: ACCENTS[i % 4] }} />
                    <input
                      ref={(el) => { optionRefs.current[i] = el }}
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      onFocus={() => setFocusedField(`option-${i}`)}
                      placeholder={`選択肢 ${i + 1}`}
                      style={{ border: `2px solid ${ACCENTS[i % 4]}`, background: '#ffffff', color: '#000000' }}
                      className="flex-1 px-4 py-2 focus:outline-none"
                      readOnly={keyboardOff}
                      inputMode={keyboardOff ? 'none' : 'text'}
                    />
                    {keyboardOff && opt && (
                      <button type="button" onClick={() => updateOption(i, '')} style={{ color: '#ff2200' }} className="text-lg font-black leading-none hover:opacity-60 transition-opacity" title="クリア">✕</button>
                    )}
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} style={{ color: '#ff2200' }} className="text-xl font-black leading-none hover:opacity-60 transition-opacity">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addOption} style={{ color: '#0033cc' }} className="mt-3 text-sm font-black hover:opacity-60 transition-opacity">
                ＋ 選択肢を追加
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ background: '#000000', color: '#ffe600' }}
              className="w-full font-black py-3 transition-opacity hover:opacity-80 disabled:opacity-50 text-lg"
            >
              {loading ? '作成中...' : '🚀 分割一覧を作成する'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
