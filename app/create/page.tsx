'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// クイック入力ワードのlocalStorageキー
const QUICK_WORDS_KEY = 'quickWords'

// デフォルトのクイック入力ワード（初回起動時に使用）
const DEFAULT_QUICK_WORDS = ['はい', 'いいえ', 'どちらでもない', '賛成', '反対', 'その他']

export default function CreatePoll() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [loading, setLoading] = useState(false)

  // クイック入力ワードの一覧
  const [quickWords, setQuickWords] = useState<string[]>([])

  // 新しいワードを追加するための入力値
  const [newWord, setNewWord] = useState('')

  // ワード追加フォームの表示・非表示
  const [showAddWord, setShowAddWord] = useState(false)

  // 現在フォーカスされている入力欄を記録する
  // 'question' または 'option-0', 'option-1' ... の形式
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // 各inputのrefを保持（カーソル位置への挿入に使う）
  const questionRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // 管理者でなければトップに戻す
    if (localStorage.getItem('isAdmin') !== '1') {
      router.replace('/')
      return
    }
    // localStorageからクイック入力ワードを読み込む（なければデフォルト値を使う）
    const saved = localStorage.getItem(QUICK_WORDS_KEY)
    setQuickWords(saved ? JSON.parse(saved) : DEFAULT_QUICK_WORDS)
  }, [])

  // クイック入力ワードが変わるたびにlocalStorageへ保存する
  useEffect(() => {
    if (quickWords.length > 0) {
      localStorage.setItem(QUICK_WORDS_KEY, JSON.stringify(quickWords))
    }
  }, [quickWords])

  // ワードボタンを押したときに、フォーカス中の入力欄のカーソル位置にワードを挿入する
  const insertWord = (word: string) => {
    if (!focusedField) return

    if (focusedField === 'question') {
      const el = questionRef.current
      if (!el) return
      const start = el.selectionStart ?? question.length
      const end = el.selectionEnd ?? question.length
      // カーソル位置にワードを差し込む
      const next = question.slice(0, start) + word + question.slice(end)
      setQuestion(next)
      // 挿入後にカーソルをワードの末尾へ移動する
      setTimeout(() => el.setSelectionRange(start + word.length, start + word.length), 0)

    } else if (focusedField.startsWith('option-')) {
      const index = parseInt(focusedField.replace('option-', ''), 10)
      const el = optionRefs.current[index]
      if (!el) return
      const current = options[index]
      const start = el.selectionStart ?? current.length
      const end = el.selectionEnd ?? current.length
      const next = current.slice(0, start) + word + current.slice(end)
      updateOption(index, next)
      setTimeout(() => el.setSelectionRange(start + word.length, start + word.length), 0)
    }
  }

  // 新しいクイック入力ワードを追加する
  const handleAddWord = () => {
    const trimmed = newWord.trim()
    if (!trimmed || quickWords.includes(trimmed)) return
    setQuickWords([...quickWords, trimmed])
    setNewWord('')
    setShowAddWord(false)
  }

  // クイック入力ワードを削除する
  const removeWord = (word: string) => {
    setQuickWords(quickWords.filter((w) => w !== word))
  }

  const addOption = () => setOptions([...options, ''])

  const updateOption = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validOptions = options.filter((o) => o.trim() !== '')
    if (!question.trim() || validOptions.length < 2) return

    setLoading(true)

    const { data: poll, error } = await supabase
      .from('polls')
      .insert({ question: question.trim() })
      .select()
      .single()

    if (error || !poll) {
      setLoading(false)
      return
    }

    await supabase.from('poll_options').insert(
      validOptions.map((text) => ({ poll_id: poll.id, text }))
    )

    router.push(`/poll/${poll.id}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <header className="bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 shadow-lg">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-3">
          <Link href="/" className="text-white/80 hover:text-white transition text-sm">← 戻る</Link>
          <span className="text-white/40">|</span>
          <h1 className="text-xl font-extrabold text-white">新しい投票を作成</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">

          {/* ===== クイック入力パレット ===== */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-600">⚡ クイック入力</p>
              <button
                type="button"
                onClick={() => setShowAddWord((v) => !v)}
                className="text-xs text-pink-500 hover:text-pink-700 font-bold"
              >
                {showAddWord ? 'キャンセル' : '＋ ワードを追加'}
              </button>
            </div>

            {/* ワード追加フォーム */}
            {showAddWord && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddWord())}
                  placeholder="追加するワードを入力"
                  className="flex-1 border-2 border-pink-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pink-400 transition"
                />
                <button
                  type="button"
                  onClick={handleAddWord}
                  className="bg-pink-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-pink-600 transition"
                >
                  追加
                </button>
              </div>
            )}

            {/* クイック入力ワードのボタン一覧 */}
            {quickWords.length === 0 ? (
              <p className="text-sm text-gray-400">ワードがありません。追加してください。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {quickWords.map((word) => (
                  <div key={word} className="flex items-center group">
                    {/* ワードボタン：押すとフォーカス中の入力欄にワードを挿入する */}
                    <button
                      type="button"
                      onClick={() => insertWord(word)}
                      className={`text-sm px-3 py-1 rounded-l-full border-2 font-medium transition
                        ${focusedField
                          ? 'border-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-pink-300 hover:text-pink-600'
                        }`}
                    >
                      {word}
                    </button>
                    {/* ×ボタン：ワードを削除する */}
                    <button
                      type="button"
                      onClick={() => removeWord(word)}
                      className="text-xs px-1.5 py-1 rounded-r-full border-2 border-l-0 border-gray-200 bg-white text-gray-300 hover:text-red-400 hover:border-red-300 transition"
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* フォーカス中の入力欄がないときのヒント */}
            {!focusedField && (
              <p className="text-xs text-gray-400 mt-2">入力欄をクリックしてからワードを押すと入力されます</p>
            )}
          </div>

          {/* ===== 投票作成フォーム ===== */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">📝 質問</label>
              <input
                ref={questionRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onFocus={() => setFocusedField('question')}
                placeholder="例: 好きなプログラミング言語は？"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-400 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">🎯 選択肢</label>
              <div className="space-y-3">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-lg">{['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'][i] ?? '▪️'}</span>
                    <input
                      ref={(el) => { optionRefs.current[i] = el }}
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      onFocus={() => setFocusedField(`option-${i}`)}
                      placeholder={`選択肢 ${i + 1}`}
                      className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-pink-400 transition"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="text-red-400 hover:text-red-600 text-xl leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="mt-3 text-pink-500 hover:text-pink-700 text-sm font-bold"
              >
                ＋ 選択肢を追加
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 text-white font-bold py-3 rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
            >
              {loading ? '作成中...' : '🚀 投票を作成する'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
