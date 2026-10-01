'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type QuickWord } from '@/lib/supabase'
import { inshoQuestionCategory, questionsOrSelf } from '@/lib/insho'

const KEYBOARD_OFF_KEY = 'keyboardOff'

// F デザイン カラーブロック用アクセントカラー
const ACCENTS = ['#ff2200', '#0033cc', '#00aa44', '#ff6600']

type OptionItem = { id: string | null; text: string }
type QuestionItem = { id: string; question: string; options: OptionItem[]; removedOptionIds: string[] }

export default function EditInsho() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [title, setTitle] = useState('')
  // 質問を持たない古い項目は、項目自身が質問なのでタイトル欄を出さない
  const [isLegacy, setIsLegacy] = useState(false)
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [quickWords, setQuickWords] = useState<QuickWord[]>([])
  const [newWord, setNewWord] = useState('')
  const [showAddWord, setShowAddWord] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [keyboardOff, setKeyboardOff] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const questionRefs = useRef<(HTMLInputElement | null)[]>([])
  const optionRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== '1') { router.replace('/'); return }
    setKeyboardOff(localStorage.getItem(KEYBOARD_OFF_KEY) === '1')
    supabase.from('quick_words').select('*').order('created_at').then(({ data }) => setQuickWords(data ?? []))

    const load = async () => {
      const [{ data: item }, { data: questionData }] = await Promise.all([
        supabase.from('polls').select('*').eq('id', id).single(),
        supabase.from('polls').select('*').eq('category', inshoQuestionCategory(id)).order('created_at'),
      ])
      if (!item) { router.replace('/insho'); return }
      const qs = questionsOrSelf(item, questionData ?? [])
      const { data: opts } = await supabase.from('poll_options').select('*').in('poll_id', qs.map((q) => q.id))
      setTitle(item.question)
      setIsLegacy((questionData ?? []).length === 0)
      setQuestions(qs.map((q) => ({
        id: q.id,
        question: q.question,
        options: (opts ?? []).filter((o) => o.poll_id === q.id).map((o) => ({ id: o.id, text: o.text })),
        removedOptionIds: [],
      })))
      setInitialLoading(false)
    }
    load()

    const channel = supabase.channel('quick-words')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quick_words' }, (payload) => {
        setQuickWords((prev) => prev.some((w) => w.id === payload.new.id) ? prev : [...prev, payload.new as QuickWord])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'quick_words' }, (payload) => {
        setQuickWords((prev) => prev.filter((w) => w.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  const updateQuestionItem = (qi: number, update: (q: QuestionItem) => QuestionItem) =>
    setQuestions((prev) => prev.map((q, i) => (i === qi ? update(q) : q)))
  const updateQuestion = (qi: number, question: string) => updateQuestionItem(qi, (q) => ({ ...q, question }))
  const updateOption = (qi: number, index: number, text: string) =>
    updateQuestionItem(qi, (q) => ({ ...q, options: q.options.map((o, i) => (i === index ? { ...o, text } : o)) }))
  const removeOption = (qi: number, index: number) =>
    updateQuestionItem(qi, (q) => {
      const target = q.options[index]
      return {
        ...q,
        options: q.options.filter((_, i) => i !== index),
        removedOptionIds: target.id ? [...q.removedOptionIds, target.id] : q.removedOptionIds,
      }
    })
  const addOption = (qi: number) => updateQuestionItem(qi, (q) => ({ ...q, options: [...q.options, { id: null, text: '' }] }))

  const insertWord = (word: string) => {
    if (!focusedField) return
    const insertInto = (el: HTMLInputElement, current: string, apply: (next: string) => void) => {
      const start = el.selectionStart ?? current.length
      const end = el.selectionEnd ?? current.length
      apply(current.slice(0, start) + word + current.slice(end))
      setTimeout(() => el.setSelectionRange(start + word.length, start + word.length), 0)
    }
    if (focusedField === 'title') {
      const el = titleRef.current; if (!el) return
      insertInto(el, title, setTitle)
    } else if (focusedField.startsWith('question-')) {
      const qi = parseInt(focusedField.replace('question-', ''), 10)
      const el = questionRefs.current[qi]; if (!el) return
      insertInto(el, questions[qi].question, (next) => updateQuestion(qi, next))
    } else if (focusedField.startsWith('option-')) {
      const [qi, index] = focusedField.replace('option-', '').split('-').map(Number)
      const el = optionRefs.current[`${qi}-${index}`]; if (!el) return
      insertInto(el, questions[qi].options[index].text, (next) => updateOption(qi, index, next))
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

  const deleteWord = async (wordId: string) => {
    const res = await fetch(`/api/admin/quick-words/${wordId}`, { method: 'DELETE' })
    if (res.ok) {
      setQuickWords((prev) => prev.filter((w) => w.id !== wordId))
    } else if (res.status === 401) {
      alert('管理者セッションが切れています。管理者ログインをやり直してください。')
    } else {
      alert('ワードの削除に失敗しました。')
    }
  }

  const toggleKeyboardOff = () => {
    const next = !keyboardOff
    setKeyboardOff(next)
    localStorage.setItem(KEYBOARD_OFF_KEY, next ? '1' : '0')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLegacy && !title.trim()) { alert('タイトルを入力してください'); return }
    const payload = questions.map((q) => ({ ...q, question: q.question.trim(), options: q.options.filter((o) => o.text.trim() !== '') }))
    const invalid = payload.findIndex((q) => !q.question || q.options.length < 2)
    if (invalid >= 0) { alert(`質問${invalid + 1}の質問文と、選択肢を2つ以上入力してください`); return }
    setLoading(true)
    const res = await fetch(`/api/admin/insho/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: isLegacy ? undefined : title.trim(), questions: payload }),
    })
    if (!res.ok) {
      alert(res.status === 401 ? '管理者セッションが切れています。管理者ログインをやり直してください。' : '保存に失敗しました。')
      setLoading(false)
      return
    }
    router.push('/insho')
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#ffe600' }}>
        <p className="font-black text-black text-lg animate-pulse">読み込み中...</p>
      </div>
    )
  }

  const hasRemovedOptions = questions.some((q) => q.removedOptionIds.length > 0)

  return (
    <div className="min-h-screen" style={{ background: '#ffe600' }}>
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000000' }}>
        <div className="max-w-2xl mx-auto px-3 py-2 flex items-center gap-3">
          <Link href="/insho" className="font-black text-black hover:opacity-60 transition-opacity text-sm">← 戻る</Link>
          <span className="text-black/40 font-bold">|</span>
          <h1 className="text-xl font-black text-black">分割印象投票を編集</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3 py-4">
        <div style={{ background: '#ffffff', border: '2.5px solid #000000' }} className="p-4 space-y-4">

          {/* クイック入力パレット */}
          <div style={{ background: '#ffe600', border: '2px solid #000000' }} className="p-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-sm font-black text-black whitespace-nowrap">⚡ クイック入力</p>
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={toggleKeyboardOff}
                  style={{ background: keyboardOff ? '#ff2200' : '#ffffff', color: keyboardOff ? '#ffffff' : '#000000', border: '1.5px solid #000000' }}
                  className="text-xs font-black px-1.5 py-0.5 whitespace-nowrap transition-opacity hover:opacity-80"
                  title="キーボード: ONで端末のキーボードを表示、OFFで出さない"
                >
                  ⌨️ {keyboardOff ? 'OFF' : 'ON'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteMode((v) => !v)}
                  style={{ background: deleteMode ? '#ff2200' : '#ffffff', color: deleteMode ? '#ffffff' : '#000000', border: '1.5px solid #000000' }}
                  className="text-xs font-black px-1.5 py-0.5 whitespace-nowrap transition-opacity hover:opacity-80"
                  title="削除モード: ONの間はワードを押すと削除されます"
                >
                  🗑️ {deleteMode ? 'ON' : 'OFF'}
                </button>
                <button type="button" onClick={() => setShowAddWord((v) => !v)}
                  title="ワードを追加" style={{ color: '#0033cc' }} className="text-xs font-black whitespace-nowrap hover:opacity-60 transition-opacity">
                  {showAddWord ? 'キャンセル' : '＋ 追加'}
                </button>
              </div>
            </div>

            {showAddWord && (
              <div className="flex gap-2 mb-2">
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
              <div className="flex flex-wrap gap-1.5">
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
                    className="text-sm px-2 py-0.5 font-bold transition-all"
                  >
                    {deleteMode ? '🗑️ ' : ''}{w.word}
                  </button>
                ))}
              </div>
            )}
            {deleteMode ? (
              <p className="text-xs font-bold mt-2" style={{ color: '#ff2200' }}>削除モード中: ワードを押すと削除されます</p>
            ) : !focusedField && (
              <p className="text-black/40 mt-1 leading-none" style={{ fontSize: '9px' }}>入力欄をクリックしてからワードを押すと入力されます</p>
            )}
          </div>

          {/* 編集フォーム */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLegacy && (
              <div>
                <label className="block text-sm font-black text-black mb-1">🏷️ タイトル（一覧に表示されます）</label>
                <div className="flex gap-2">
                  <input
                    ref={titleRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onFocus={() => setFocusedField('title')}
                    style={{ border: '2px solid #000000', background: '#ffffff', color: '#000000' }}
                    className="flex-1 px-3 py-2 focus:outline-none"
                    readOnly={keyboardOff}
                    inputMode={keyboardOff ? 'none' : 'text'}
                    required
                  />
                  {keyboardOff && title && (
                    <button type="button" onClick={() => setTitle('')} style={{ border: '2px solid #000000', background: '#ffffff', color: '#ff2200' }} className="px-3 font-black hover:opacity-60 transition-opacity" title="クリア">✕</button>
                  )}
                </div>
              </div>
            )}

            {hasRemovedOptions && (
              <p className="text-xs font-bold" style={{ color: '#ff6600' }}>⚠️ 削除した選択肢の投票記録も保存時に削除されます</p>
            )}

            {questions.map((q, qi) => (
              <div key={q.id} className="p-3 space-y-3" style={{ background: '#ffffff', border: '2px solid #000000' }}>
                <div>
                  <label className="block text-sm font-black text-black mb-1">📝 質問{questions.length > 1 ? qi + 1 : ''}</label>
                  <div className="flex gap-2">
                    <input
                      ref={(el) => { questionRefs.current[qi] = el }}
                      type="text"
                      value={q.question}
                      onChange={(e) => updateQuestion(qi, e.target.value)}
                      onFocus={() => setFocusedField(`question-${qi}`)}
                      style={{ border: '2px solid #000000', background: '#ffffff', color: '#000000' }}
                      className="flex-1 px-3 py-2 focus:outline-none"
                      readOnly={keyboardOff}
                      inputMode={keyboardOff ? 'none' : 'text'}
                      required
                    />
                    {keyboardOff && q.question && (
                      <button type="button" onClick={() => updateQuestion(qi, '')} style={{ border: '2px solid #000000', background: '#ffffff', color: '#ff2200' }} className="px-3 font-black hover:opacity-60 transition-opacity" title="クリア">✕</button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-black mb-1">🎯 選択肢</label>
                  <div className="space-y-2">
                    {q.options.map((opt, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <span className="w-5 h-5 flex-shrink-0" style={{ background: ACCENTS[i % 4] }} />
                        <input
                          ref={(el) => { optionRefs.current[`${qi}-${i}`] = el }}
                          type="text"
                          value={opt.text}
                          onChange={(e) => updateOption(qi, i, e.target.value)}
                          onFocus={() => setFocusedField(`option-${qi}-${i}`)}
                          placeholder={`選択肢 ${i + 1}`}
                          style={{ border: `2px solid ${ACCENTS[i % 4]}`, background: '#ffffff', color: '#000000' }}
                          className="flex-1 px-3 py-1.5 focus:outline-none"
                          readOnly={keyboardOff}
                          inputMode={keyboardOff ? 'none' : 'text'}
                        />
                        {keyboardOff && opt.text && (
                          <button type="button" onClick={() => updateOption(qi, i, '')} style={{ color: '#ff2200' }} className="text-lg font-black leading-none hover:opacity-60 transition-opacity" title="クリア">✕</button>
                        )}
                        {q.options.length > 2 && (
                          <button type="button" onClick={() => removeOption(qi, i)} style={{ color: '#ff2200' }} className="text-xl font-black leading-none hover:opacity-60 transition-opacity">×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addOption(qi)} style={{ color: '#0033cc' }} className="mt-2 text-sm font-black hover:opacity-60 transition-opacity">＋ 選択肢を追加</button>
                </div>
              </div>
            ))}

            <button type="submit" disabled={loading} style={{ background: '#000000', color: '#ffe600' }} className="w-full font-black py-2.5 hover:opacity-80 transition-opacity disabled:opacity-50 text-lg">
              {loading ? '保存中...' : '💾 変更を保存する'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
