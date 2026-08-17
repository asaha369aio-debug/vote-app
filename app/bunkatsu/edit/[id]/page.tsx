'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const QUICK_WORDS_KEY = 'quickWords'
const DEFAULT_QUICK_WORDS = ['はい', 'いいえ', 'どちらでもない', '賛成', '反対', 'その他']
const KEYBOARD_OFF_KEY = 'keyboardOff'

const ACCENTS = ['#ff2200', '#0033cc', '#00aa44', '#ff6600']

type OptionItem = { id: string | null; text: string }

export default function EditBunkatsu() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<OptionItem[]>([])
  const [removedOptionIds, setRemovedOptionIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [quickWords, setQuickWords] = useState<string[]>([])
  const [newWord, setNewWord] = useState('')
  const [showAddWord, setShowAddWord] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [keyboardOff, setKeyboardOff] = useState(false)

  const questionRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== '1') { router.replace('/'); return }
    const saved = localStorage.getItem(QUICK_WORDS_KEY)
    setQuickWords(saved ? JSON.parse(saved) : DEFAULT_QUICK_WORDS)
    setKeyboardOff(localStorage.getItem(KEYBOARD_OFF_KEY) === '1')
    const load = async () => {
      const [{ data: poll }, { data: opts }] = await Promise.all([
        supabase.from('polls').select('*').eq('id', id).single(),
        supabase.from('poll_options').select('*').eq('poll_id', id),
      ])
      if (!poll) { router.replace('/'); return }
      setQuestion(poll.question)
      setOptions((opts ?? []).map((o) => ({ id: o.id, text: o.text })))
      setInitialLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (quickWords.length > 0) localStorage.setItem(QUICK_WORDS_KEY, JSON.stringify(quickWords))
  }, [quickWords])

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
      const current = options[index].text
      const start = el.selectionStart ?? current.length
      const end = el.selectionEnd ?? current.length
      const next = current.slice(0, start) + word + current.slice(end)
      updateOption(index, next)
      setTimeout(() => el.setSelectionRange(start + word.length, start + word.length), 0)
    }
  }

  const handleAddWord = () => {
    const trimmed = newWord.trim()
    if (!trimmed || quickWords.includes(trimmed)) return
    setQuickWords([...quickWords, trimmed]); setNewWord(''); setShowAddWord(false)
  }

  const removeWord = (word: string) => setQuickWords(quickWords.filter((w) => w !== word))
  const toggleKeyboardOff = () => {
    const next = !keyboardOff
    setKeyboardOff(next)
    localStorage.setItem(KEYBOARD_OFF_KEY, next ? '1' : '0')
  }
  const updateOption = (index: number, text: string) => setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text } : o)))
  const removeOption = (index: number) => {
    const target = options[index]
    if (target.id) setRemovedOptionIds((prev) => [...prev, target.id!])
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }
  const addOption = () => setOptions((prev) => [...prev, { id: null, text: '' }])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validOptions = options.filter((o) => o.text.trim() !== '')
    if (!question.trim() || validOptions.length < 2) return
    setLoading(true)
    const res = await fetch(`/api/admin/polls/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), options: validOptions, removedOptionIds }),
    })
    if (!res.ok) { setLoading(false); return }
    router.push('/bunkatsu')
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#ffe600' }}>
        <p className="font-black text-black text-lg animate-pulse">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#ffe600' }}>
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/bunkatsu" className="font-black text-black hover:opacity-60 transition-opacity text-sm">← 戻る</Link>
          <span className="text-black/40 font-bold">|</span>
          <h1 className="text-xl font-black text-black">分割一覧を編集</h1>
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
                <button type="button" onClick={() => setShowAddWord((v) => !v)} style={{ color: '#0033cc' }} className="text-xs font-black hover:opacity-60 transition-opacity">
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
                <button type="button" onClick={handleAddWord} style={{ background: '#000000', color: '#ffe600' }} className="text-sm font-black px-3 py-1.5 hover:opacity-80 transition-opacity">追加</button>
              </div>
            )}

            {quickWords.length === 0 ? (
              <p className="text-sm text-black/50">ワードがありません。追加してください。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {quickWords.map((word) => (
                  <div key={word} className="flex items-center">
                    <button type="button" onClick={() => insertWord(word)} style={{ border: '2px solid #000000', borderRight: 'none', background: focusedField ? '#000000' : '#ffffff', color: focusedField ? '#ffe600' : '#000000' }} className="text-sm px-3 py-1 font-bold transition-all">{word}</button>
                    <button type="button" onClick={() => removeWord(word)} style={{ border: '2px solid #000000', background: '#ffffff', color: '#ff2200' }} className="text-xs px-1.5 py-1 font-black hover:opacity-60 transition-opacity" title="削除">×</button>
                  </div>
                ))}
              </div>
            )}
            {!focusedField && <p className="text-xs text-black/40 mt-2">入力欄をクリックしてからワードを押すと入力されます</p>}
          </div>

          {/* 編集フォーム */}
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
              {removedOptionIds.length > 0 && (
                <p className="text-xs font-bold mb-2" style={{ color: '#ff6600' }}>⚠️ 削除した選択肢の投票記録も保存時に削除されます</p>
              )}
              <div className="space-y-3">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="w-5 h-5 flex-shrink-0" style={{ background: ACCENTS[i % 4] }} />
                    <input
                      ref={(el) => { optionRefs.current[i] = el }}
                      type="text"
                      value={opt.text}
                      onChange={(e) => updateOption(i, e.target.value)}
                      onFocus={() => setFocusedField(`option-${i}`)}
                      placeholder={`選択肢 ${i + 1}`}
                      style={{ border: `2px solid ${ACCENTS[i % 4]}`, background: '#ffffff', color: '#000000' }}
                      className="flex-1 px-4 py-2 focus:outline-none"
                      readOnly={keyboardOff}
                      inputMode={keyboardOff ? 'none' : 'text'}
                    />
                    {keyboardOff && opt.text && (
                      <button type="button" onClick={() => updateOption(i, '')} style={{ color: '#ff2200' }} className="text-lg font-black leading-none hover:opacity-60 transition-opacity" title="クリア">✕</button>
                    )}
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} style={{ color: '#ff2200' }} className="text-xl font-black leading-none hover:opacity-60 transition-opacity">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addOption} style={{ color: '#0033cc' }} className="mt-3 text-sm font-black hover:opacity-60 transition-opacity">＋ 選択肢を追加</button>
            </div>

            <button type="submit" disabled={loading} style={{ background: '#000000', color: '#ffe600' }} className="w-full font-black py-3 hover:opacity-80 transition-opacity disabled:opacity-50 text-lg">
              {loading ? '保存中...' : '💾 変更を保存する'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
