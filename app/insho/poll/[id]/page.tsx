'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { playReveal, playTick, unlockSfx } from '@/lib/sfx'
import { supabase, type Poll, type PollOption } from '@/lib/supabase'
import { inshoQuestionCategory, questionsOrSelf } from '@/lib/insho'
import { downloadCsv, fetchAllVotes } from '@/lib/resultsCsv'
import { POINTS_DEFAULTS, fetchItemPoints } from '@/lib/pointsSettings'

// F デザイン カラーブロック用カラー（結果バーに使用）
const BAR_COLORS = ['#ff2200', '#0033cc', '#00aa44', '#ff6600', '#7700cc', '#007799']

type VoteCount = { option_id: string; count: number }
type VoteRecord = { poll_id: string; option_id: string; voter_name: string | null }

// 1:1 → 2:1 → 3:1 → 2:1 のパターンで dominant オプションの幅を変化させる
const RATIO_PATTERN = [1, 2, 3, 2]

function patternPercents(frame: number, count: number): number[] {
  if (count === 0) return []
  if (count === 1) return [100]
  const stepsPerOption = RATIO_PATTERN.length
  const totalSteps = stepsPerOption * count
  const step = frame % totalSteps
  const dominantIdx = Math.floor(step / stepsPerOption)
  const ratio = RATIO_PATTERN[step % stepsPerOption]
  // dominant: ratio、それ以外: 1 ずつ
  const total = ratio + (count - 1)
  const percents = Array(count).fill(Math.round(100 / total))
  percents[dominantIdx] = 100 - percents[0] * (count - 1)
  return percents
}

export default function InshoPollPage() {
  const { id } = useParams<{ id: string }>()
  // 一覧に出る項目（タイトル）と、その下の質問
  const [item, setItem] = useState<Poll | null>(null)
  const [questions, setQuestions] = useState<Poll[]>([])
  const [optionsByQuestion, setOptionsByQuestion] = useState<Record<string, PollOption[]>>({})
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)
  // 質問ごと・選択肢ごとの配分票数（投票後は自分の配分として表示に使う）
  const [allocation, setAllocation] = useState<Record<string, Record<string, number>>>({})
  // 1人が質問ごとに配分できる持ち票の数（管理者が一覧画面で設定）
  const [totalPoints, setTotalPoints] = useState(POINTS_DEFAULTS.insho)
  const [confirming, setConfirming] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allVotes, setAllVotes] = useState<VoteRecord[]>([])
  // 管理者が投票者一覧・結果発表で見ている質問
  const [selectedQ, setSelectedQ] = useState(0)
  const [phase, setPhase] = useState<'hidden' | 'ready' | 'suspense' | 'revealed'>('hidden')
  const [displayPercents, setDisplayPercents] = useState<number[]>([])
  const [showVoterList, setShowVoterList] = useState(false)
  const [animSeconds, setAnimSeconds] = useState(5)
  const [fontKey, setFontKey] = useState<'system' | 'anton' | 'bebas' | 'noto' | 'mplus'>('system')
  // 0票バーを消して票ありバーで100%を埋める「再配置」フェーズ中はtransitionをなしにする
  const [collapsing, setCollapsing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 結果発表の効果音のオン/オフ（アニメーション中に切り替えても反映されるよう ref でも持つ）
  const [soundOn, setSoundOn] = useState(true)
  const soundOnRef = useRef(true)
  const toggleSound = () => {
    const next = !soundOnRef.current
    soundOnRef.current = next
    setSoundOn(next)
    try { localStorage.setItem('sfxOn', next ? '1' : '0') } catch {}
  }

  const FONTS = [
    { key: 'system', label: 'System',  family: 'system-ui, sans-serif' },
    { key: 'anton',  label: 'Anton',   family: 'var(--font-anton), sans-serif' },
    { key: 'bebas',  label: 'Bebas',   family: 'var(--font-bebas), sans-serif' },
    { key: 'noto',   label: 'Noto JP', family: 'var(--font-noto), sans-serif' },
    { key: 'mplus',  label: 'M PLUS',  family: 'var(--font-mplus), sans-serif' },
  ] as const
  const graphFont = FONTS.find(f => f.key === fontKey)?.family ?? 'system-ui'

  const storageKey = `voted-${id}`
  const remainingOf = (questionId: string) =>
    totalPoints - Object.values(allocation[questionId] ?? {}).reduce((sum, n) => sum + n, 0)
  const allAllocated = questions.length > 0 && questions.every((q) => remainingOf(q.id) === 0)

  // ここから下は管理者が選択中の質問についての集計（結果発表・投票者一覧で使う）
  const poll = questions[selectedQ] ?? null
  const options = poll ? optionsByQuestion[poll.id] ?? [] : []
  const pollVotes = poll ? allVotes.filter((v) => v.poll_id === poll.id) : []
  const voteCounts: VoteCount[] = Object.entries(
    pollVotes.reduce<Record<string, number>>((acc, v) => { acc[v.option_id] = (acc[v.option_id] ?? 0) + 1; return acc }, {})
  ).map(([option_id, count]) => ({ option_id, count }))
  const totalVotes = pollVotes.length
  // 1票=1行で保存しているため、投票者ごとに配分をまとめる
  const voterAllocations = Object.entries(
    pollVotes.reduce<Record<string, Record<string, number>>>((acc, v) => {
      const name = v.voter_name ?? '名無し'
      acc[name] ??= {}
      acc[name][v.option_id] = (acc[name][v.option_id] ?? 0) + 1
      return acc
    }, {})
  )
  // 表示テキスト用（Math.round: 33/33/33のように自然な数値を表示）
  const realPercents = options.map((opt) => {
    const count = voteCounts.find((v) => v.option_id === opt.id)?.count ?? 0
    return totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
  })
  // バー幅用（端数なしの正確な値: 合計が必ず100%になりグラフに黒い余白が生まれない）
  const exactPercents = options.map((opt) => {
    const count = voteCounts.find((v) => v.option_id === opt.id)?.count ?? 0
    return totalVotes > 0 ? (count / totalVotes) * 100 : 0
  })

  const fetchVotes = async (questionIds: string[]) => {
    try { setAllVotes(await fetchAllVotes(questionIds)) } catch {}
  }

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      setVoted(true)
      try {
        const parsed = JSON.parse(saved)
        // 古い項目は { 選択肢ID: 票数 } 形式で保存していたので、項目自身の質問の配分として読む
        const isLegacy = Object.values(parsed).some((v) => typeof v === 'number')
        setAllocation(isLegacy ? { [id]: parsed } : parsed)
      } catch {}
    }
    setIsAdmin(localStorage.getItem('isAdmin') === '1')

    let refetchTimer: ReturnType<typeof setTimeout> | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null
    const load = async () => {
      const [{ data: itemData }, { data: questionData }, points] = await Promise.all([
        supabase.from('polls').select('*').eq('id', id).single(),
        supabase.from('polls').select('*').eq('category', inshoQuestionCategory(id)).order('created_at'),
        fetchItemPoints('insho', id),
      ])
      setTotalPoints(points)
      if (!itemData) return
      const qs = questionsOrSelf(itemData, questionData ?? [])
      const questionIds = qs.map((q) => q.id)
      const { data: optionData } = await supabase.from('poll_options').select('*').in('poll_id', questionIds)
      const grouped: Record<string, PollOption[]> = {}
      for (const o of optionData ?? []) (grouped[o.poll_id] ??= []).push(o)
      setOptionsByQuestion(grouped)
      setQuestions(qs)
      setItem(itemData)
      fetchVotes(questionIds)

      // 1人の投票で複数行INSERTされるため、再取得はまとめて1回にする
      channel = supabase.channel('votes-' + id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `poll_id=in.(${questionIds.join(',')})` }, () => {
          if (refetchTimer) clearTimeout(refetchTimer)
          refetchTimer = setTimeout(() => fetchVotes(questionIds), 300)
        })
        .subscribe()
    }
    load()
    return () => {
      if (refetchTimer) clearTimeout(refetchTimer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [id])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sfxOn') !== '0'
      soundOnRef.current = saved
      setSoundOn(saved)
    } catch {}
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current) }
  }, [])

  const changeAllocation = (questionId: string, optionId: string, delta: number) => {
    setAllocation((prev) => {
      const current = prev[questionId] ?? {}
      const next = (current[optionId] ?? 0) + delta
      const used = Object.values(current).reduce((sum, n) => sum + n, 0)
      if (next < 0 || (delta > 0 && used >= totalPoints)) return prev
      return { ...prev, [questionId]: { ...current, [optionId]: next } }
    })
  }

  const handleVote = async () => {
    if (!allAllocated) return
    setLoading(true)
    const voterName = localStorage.getItem('voterName') ?? '名無し'
    // 1票=1行で保存する（既存の集計・結果発表がそのまま票数で動く）。全質問分をまとめて1回で保存
    const rows = questions.flatMap((q) =>
      Object.entries(allocation[q.id] ?? {}).flatMap(([option_id, n]) =>
        Array.from({ length: n }, () => ({ poll_id: q.id, option_id, voter_name: voterName }))
      )
    )
    const { error } = await supabase.from('votes').insert(rows)
    if (error) { alert('投票に失敗しました。もう一度お試しください。'); setLoading(false); return }
    localStorage.setItem(storageKey, JSON.stringify(allocation)); setVoted(true); setLoading(false); setConfirming(false)
  }

  // 全質問の結果をCSVで出力する（列: 質問ごと×選択肢、行: 投票者ごと＋合計）
  const handleExportCsv = () => {
    if (!item) return
    const columns = questions.flatMap((q, qi) =>
      (optionsByQuestion[q.id] ?? []).map((opt) => ({
        questionId: q.id,
        optionId: opt.id,
        label: questions.length > 1 ? `質問${qi + 1} ${q.question}: ${opt.text}` : `${q.question}: ${opt.text}`,
      }))
    )
    const byVoter: Record<string, Record<string, number>> = {}
    for (const v of allVotes) {
      const name = v.voter_name ?? '名無し'
      byVoter[name] ??= {}
      byVoter[name][v.option_id] = (byVoter[name][v.option_id] ?? 0) + 1
    }
    const totals = columns.map((c) => allVotes.filter((v) => v.option_id === c.optionId).length)
    const escape = (value: string | number) => {
      const text = String(value)
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const rows = [
      ['投票者', ...columns.map((c) => c.label)],
      ...Object.entries(byVoter).map(([name, counts]) => [name, ...columns.map((c) => counts[c.optionId] ?? 0)]),
      ['合計', ...totals],
    ]
    downloadCsv(`${item.question}_結果.csv`, rows.map((row) => row.map(escape).join(',')).join('\r\n'))
  }

  const handleReveal = () => {
    if (phase === 'ready' || phase === 'revealed') { if (intervalRef.current) clearTimeout(intervalRef.current); setPhase('hidden'); return }
    setPhase('ready')
  }

  const handleStart = () => {
    const count = options.length; if (count === 0) return
    setPhase('suspense')
    if (soundOnRef.current) unlockSfx()
    let frame = 0
    let lastPercents = patternPercents(frame, count)
    setDisplayPercents(lastPercents)
    const TOTAL_MS = animSeconds * 1000
    let elapsed = 0

    const tick = () => {
      const progress = elapsed / TOTAL_MS
      const interval = progress < 0.8
        ? 100 + 100 * Math.abs(Math.sin(progress * Math.PI * 5))
        : 100 - (100 - 30) * ((progress - 0.8) / 0.2)

      intervalRef.current = setTimeout(() => {
        elapsed += interval
        frame++
        if (elapsed >= TOTAL_MS) {
          intervalRef.current = null

          // Step1: 0票バーを0にして票ありバーの幅を100%に再配置（transitionなし・黒余白を防ぐ）
          const votedSum = lastPercents.reduce((s, w, i) => s + (exactPercents[i] > 0 ? w : 0), 0)
          const redistributed = lastPercents.map((w, i) =>
            exactPercents[i] === 0 ? 0 : votedSum > 0 ? (w / votedSum) * 100 : 0
          )
          setCollapsing(true)
          setDisplayPercents(redistributed)

          // Step2: 1フレーム後にtransitionを有効にして最終値へアニメーション
          requestAnimationFrame(() => requestAnimationFrame(() => {
            setCollapsing(false)
            setDisplayPercents(exactPercents)
            setPhase('revealed')
            if (soundOnRef.current) playReveal()
          }))
        } else {
          lastPercents = patternPercents(frame, count)
          setDisplayPercents(lastPercents)
          if (soundOnRef.current) playTick(Math.min(1, elapsed / TOTAL_MS))
          tick()
        }
      }, interval)
    }
    tick()
  }

  if (!item || !poll) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#ffe600' }}>
        <p className="font-black text-black text-lg animate-pulse">読み込み中...</p>
      </div>
    )
  }

  // ===== グラフ表示モード（結果発表）=====
  if (isAdmin && phase !== 'hidden') {
    return (
      <>
      <div className="min-h-screen flex flex-col" style={{ background: '#111111' }}>
        <div className="px-8 py-5 flex items-center justify-between" style={{ borderBottom: '3px solid #ffe600' }}>
          <h1 className="text-xl font-black" style={{ color: '#ffe600' }}>{poll.question}</h1>
          {phase === 'ready' && <span className="font-black text-lg" style={{ color: '#888888' }}>⏳ 準備完了</span>}
          {phase === 'suspense' && <span className="font-black text-lg animate-pulse" style={{ color: '#ff2200' }}>🎰 集計中...</span>}
          {phase === 'revealed' && <span className="font-black text-lg" style={{ color: '#ffe600' }}>🎉 結果発表！</span>}
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 py-4">
          <div className="flex w-full overflow-hidden" style={{ height: 'clamp(180px, 55vh, 480px)', border: '3px solid #ffe600' }}>
            {options.map((opt, i) => {
              const color = BAR_COLORS[i % BAR_COLORS.length]
              const percent = phase === 'ready'
                ? 100 / options.length
                : displayPercents[i] ?? 0
              const isRevealed = phase === 'revealed'

              // collapsing以降は0票バーをDOMから除去（opacity:0でも場所を占めて黒くなるため）
              if ((collapsing || isRevealed) && exactPercents[i] === 0) return null

              return (
                <div
                  key={opt.id}
                  className="relative h-full flex flex-col justify-end pb-4 px-2 overflow-hidden"
                  style={{
                    width: `${percent}%`,
                    minWidth: 0,
                    background: color,
                    opacity: phase === 'ready' ? 0.3 : percent === 0 ? 0 : 1,
                    pointerEvents: percent === 0 ? 'none' : undefined,
                    // collapsing中はtransitionなしで即座に再配置し、その後1.2sでアニメーション
                    transition: collapsing
                      ? 'none'
                      : isRevealed
                        ? percent === 0
                          ? 'width 1.2s ease-out, opacity 0s'
                          : 'width 1.2s ease-out, opacity 0.3s ease'
                        : 'width 0.12s ease-in-out, opacity 0.3s ease',
                    borderLeft: i > 0 && percent > 0 ? '3px solid #111111' : 'none',
                  }}
                >
                  {phase !== 'ready' && (
                    <>
                      {isRevealed && <div className="shine-overlay" />}
                      <p className="relative font-black text-white leading-tight truncate" style={{ fontSize: '2.2rem', textShadow: '0 1px 3px rgba(0,0,0,0.5)', fontFamily: graphFont }}>{opt.text}</p>
                      <p className="relative font-black text-white" style={{ fontSize: '3.15rem', textShadow: '0 1px 3px rgba(0,0,0,0.5)', lineHeight: 1, fontFamily: graphFont }}>{Math.round(percent)}%</p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-8 pb-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6 justify-center">
            {options.map((opt, i) => {
              const count = voteCounts.find((v) => v.option_id === opt.id)?.count ?? 0
              const percent = displayPercents[i] ?? 0
              const color = BAR_COLORS[i % BAR_COLORS.length]
              return (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="w-4 h-4 flex-shrink-0" style={{ background: color }} />
                  <span className="font-black" style={{ color: '#ffffff' }}>{opt.text}</span>
                  {phase === 'revealed' && (
                    <><span className="font-black text-lg" style={{ color }}>{realPercents[i]}%</span><span className="text-sm" style={{ color: '#888888' }}>({count}票)</span></>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-6">
            <span className="text-sm" style={{ color: '#888888' }}>合計 <span className="font-black" style={{ color: '#ffe600' }}>{totalVotes}</span> 票</span>
            {phase === 'ready' && (
              <button onClick={handleStart} style={{ background: '#ffe600', color: '#000000' }} className="font-black px-10 py-4 text-xl transition-opacity hover:opacity-80">
                🎰 スタート！
              </button>
            )}
            {phase === 'suspense' && (
              <button disabled style={{ background: '#ffe600', color: '#000000', opacity: 0.5 }} className="font-black px-8 py-3 text-lg cursor-not-allowed">
                🎰 集計中...
              </button>
            )}
            {phase === 'revealed' && (
              <button onClick={handleReveal} style={{ background: '#ffe600', color: '#000000' }} className="font-black px-8 py-3 transition-opacity hover:opacity-80">
                🙈 結果を隠す
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 右下：フォント切替 */}
      <div className="fixed bottom-24 right-6 flex flex-col items-end gap-1">
        <span className="text-xs font-black" style={{ color: '#ffe600' }}>フォント</span>
        <div className="flex gap-1">
          {FONTS.map(f => (
            <button
              key={f.key}
              onClick={() => setFontKey(f.key)}
              style={{
                background: fontKey === f.key ? '#ffe600' : '#333333',
                color: fontKey === f.key ? '#000000' : '#ffe600',
                border: '1.5px solid #ffe600',
                fontFamily: f.family,
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 右下：アニメーション秒数入力 */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2" style={{ background: '#111111', border: '2px solid #ffe600', padding: '8px 12px' }}>
        <label className="text-xs font-black" style={{ color: '#ffe600' }}>秒数</label>
        <input
          type="number"
          min={1}
          max={60}
          value={animSeconds}
          onChange={(e) => setAnimSeconds(Math.max(1, Number(e.target.value)))}
          style={{ background: '#000000', color: '#ffe600', border: '1px solid #ffe600', width: '52px', textAlign: 'center' }}
          className="text-sm font-black px-1 py-0.5 focus:outline-none"
        />
        <span className="text-xs font-black" style={{ color: '#ffe600' }}>秒</span>
        <button
          onClick={toggleSound}
          title="効果音のオン/オフ"
          className="ml-2 text-xs font-black px-2 py-0.5"
          style={{ background: soundOn ? '#ffe600' : '#333333', color: soundOn ? '#000000' : '#ffe600', border: '1px solid #ffe600' }}
        >
          {soundOn ? '🔊 SE ON' : '🔇 SE OFF'}
        </button>
      </div>
      </>
    )
  }

  // ===== 通常の投票画面（質問ごとに持ち票を配分） =====
  return (
    <div className="min-h-screen" style={{ background: '#ffe600' }}>
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/insho" className="font-black text-black hover:opacity-60 transition-opacity text-sm">← 一覧</Link>
          <span className="text-black/40 font-bold">|</span>
          <span className="font-black text-black truncate">{item.question}</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div style={{ background: '#ffffff', border: '2.5px solid #000000' }} className="p-6">
          <h1 className="text-2xl font-black text-black mb-2">{item.question}</h1>
          {!voted && (
            <p className="text-sm font-bold text-black/60 mb-6">質問ごとに持ち票 {totalPoints} 票を配分してください</p>
          )}

          {/* 質問ごとの配分（1段階目） */}
          <div className="space-y-6 mb-6">
            {questions.map((q, qi) => {
              const remaining = remainingOf(q.id)
              return (
                <section key={q.id}>
                  <h2 className="font-black text-black mb-2">
                    {questions.length > 1 && <span className="mr-2" style={{ color: '#ff2200' }}>質問{qi + 1}</span>}
                    {q.question}
                  </h2>
                  {!voted && (
                    <div className="mb-3 flex items-center justify-end px-4 py-1.5" style={{ background: remaining === 0 ? '#00aa44' : '#000000' }}>
                      <span className="font-black" style={{ color: remaining === 0 ? '#ffffff' : '#ffe600' }}>
                        {remaining === 0 ? '✓ 配分完了' : `残り ${remaining} 票`}
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {(optionsByQuestion[q.id] ?? []).map((opt, i) => {
                      const color = BAR_COLORS[i % BAR_COLORS.length]
                      const n = allocation[q.id]?.[opt.id] ?? 0
                      return (
                        <div key={opt.id} className="flex items-center gap-3 px-4 py-3" style={{ border: `2.5px solid ${color}`, background: n > 0 ? `${color}1a` : '#ffffff' }}>
                          <span className="w-4 h-4 flex-shrink-0" style={{ background: color }} />
                          <span className="text-black font-bold flex-1">{opt.text}</span>
                          {!voted && !confirming ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => changeAllocation(q.id, opt.id, -1)}
                                disabled={n === 0}
                                className="w-9 h-9 font-black text-xl transition-opacity hover:opacity-80 disabled:opacity-30"
                                style={{ background: '#ffffff', color: '#000000', border: '2px solid #000000' }}
                              >
                                −
                              </button>
                              <span className="w-8 text-center font-black text-xl" style={{ color }}>{n}</span>
                              <button
                                onClick={() => changeAllocation(q.id, opt.id, 1)}
                                disabled={remaining === 0}
                                className="w-9 h-9 font-black text-xl transition-opacity hover:opacity-80 disabled:opacity-30"
                                style={{ background: color, color: '#ffffff', border: '2px solid #000000' }}
                              >
                                ＋
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm font-black flex-shrink-0" style={{ color }}>{n} 票</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          {/* 配分を確定へ進むボタン */}
          {!voted && !confirming && (
            <div className="mb-8 text-center">
              <button
                onClick={() => setConfirming(true)}
                disabled={!allAllocated}
                style={{ background: '#000000', color: '#ffe600' }}
                className="font-black px-6 py-2 transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                {allAllocated ? 'この配分で進む' : 'すべての質問で配分してください'}
              </button>
            </div>
          )}

          {/* 確認（2段階目） */}
          {!voted && confirming && (
            <div className="mb-8 p-4 text-center" style={{ background: '#f5f5f5', border: '2.5px solid #000000' }}>
              <p className="text-black font-bold mb-3">この配分で投票します。よろしいですか？</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleVote}
                  disabled={loading}
                  style={{ background: '#000000', color: '#ffe600' }}
                  className="font-black px-6 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {loading ? '投票中...' : 'この内容で投票する'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={loading}
                  style={{ background: '#ffe600', color: '#000000', border: '2px solid #000000' }}
                  className="font-black px-6 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  配分し直す
                </button>
              </div>
            </div>
          )}

          {/* 投票完了メッセージ */}
          {voted && (
            <div className="p-4 text-center" style={{ background: '#00aa44', border: '2.5px solid #000000' }}>
              <p className="text-white font-black text-lg">🎉 投票ありがとうございました！</p>
              <p className="text-white/80 text-sm mt-1">
                {isAdmin ? '結果はリアルタイムで更新されます' : '結果は管理者が公開するまでお待ちください'}
              </p>
            </div>
          )}

          {/* 管理者向け投票者一覧・結果ボタン（選択中の質問について表示） */}
          {isAdmin && (
            <div className="mt-6 pt-6" style={{ borderTop: '2px solid #000000' }}>
              {questions.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {questions.map((q, qi) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQ(qi)}
                      style={{
                        background: selectedQ === qi ? '#000000' : '#ffffff',
                        color: selectedQ === qi ? '#ffe600' : '#000000',
                        border: '2px solid #000000',
                      }}
                      className="text-xs font-black px-3 py-1.5 transition-opacity hover:opacity-80"
                    >
                      質問{qi + 1}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-black">
                  📋 投票者一覧
                  <span className="ml-2" style={{ color: '#ff2200' }}>{voterAllocations.length}</span>
                  <span className="text-black/50 font-normal">名が投票済み</span>
                </p>
                <button
                  onClick={() => setShowVoterList((v) => !v)}
                  style={{ background: '#000000', color: '#ffe600' }}
                  className="text-xs font-black px-3 py-1 transition-opacity hover:opacity-80"
                >
                  {showVoterList ? '▲ 閉じる' : '▼ 一覧を見る'}
                </button>
              </div>
              {showVoterList && (
                voterAllocations.length === 0 ? (
                  <p className="text-sm text-black/50 mb-3">まだ誰も投票していません</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 mb-3">
                    {voterAllocations.map(([name, counts]) => (
                      <div key={name} className="flex items-start gap-2 text-sm px-3 py-2" style={{ border: '1.5px solid #000000', background: '#ffe600' }}>
                        <span className="font-bold text-black truncate" style={{ maxWidth: '40%' }}>{name}</span>
                        <span className="text-black/40 text-xs font-black mt-0.5">→</span>
                        <span className="flex flex-wrap gap-x-3 gap-y-1 flex-1 justify-end">
                          {options.map((opt, optIndex) => {
                            const n = counts[opt.id] ?? 0
                            if (n === 0) return null
                            const color = BAR_COLORS[optIndex % BAR_COLORS.length]
                            return (
                              <span key={opt.id} className="flex items-center gap-1 font-black" style={{ color }}>
                                <span className="w-2.5 h-2.5 flex-shrink-0" style={{ background: color }} />
                                {opt.text} {n}
                              </span>
                            )
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
              <div className="mt-4 text-center">
                <p className="text-sm text-black/50 mb-3">合計 <span className="font-black text-black">{totalVotes}</span> 票</p>
                <button onClick={handleReveal} style={{ background: '#000000', color: '#ffe600' }} className="font-black px-6 py-2 transition-opacity hover:opacity-80">
                  📊 {questions.length > 1 ? `質問${selectedQ + 1}の結果を見る` : '結果を見る'}
                </button>
                <div className="mt-3">
                  <button onClick={handleExportCsv} style={{ background: '#ffffff', color: '#000000', border: '2px solid #000000' }} className="text-sm font-black px-4 py-1.5 transition-opacity hover:opacity-80">
                    📥 結果をCSVで出力{questions.length > 1 ? '（全質問）' : ''}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
