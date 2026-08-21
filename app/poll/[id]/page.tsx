'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Poll, type PollOption } from '@/lib/supabase'

// F デザイン カラーブロック用カラー（結果バーに使用）
const BAR_COLORS = ['#ff2200', '#0033cc', '#00aa44', '#ff6600', '#7700cc', '#007799']

type VoteCount = { option_id: string; count: number }
type VoteRecord = { option_id: string; voter_name: string | null }

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

export default function PollPage() {
  const { id } = useParams<{ id: string }>()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [options, setOptions] = useState<PollOption[]>([])
  const [voteCounts, setVoteCounts] = useState<VoteCount[]>([])
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allVotes, setAllVotes] = useState<VoteRecord[]>([])
  const [phase, setPhase] = useState<'hidden' | 'ready' | 'suspense' | 'revealed'>('hidden')
  const [displayPercents, setDisplayPercents] = useState<number[]>([])
  const [showVoterList, setShowVoterList] = useState(false)
  const [animSeconds, setAnimSeconds] = useState(5)
  const [fontKey, setFontKey] = useState<'system' | 'anton' | 'bebas' | 'noto' | 'mplus'>('system')
  // 0票バーを消して票ありバーで100%を埋める「再配置」フェーズ中はtransitionをなしにする
  const [collapsing, setCollapsing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const FONTS = [
    { key: 'system', label: 'System',  family: 'system-ui, sans-serif' },
    { key: 'anton',  label: 'Anton',   family: 'var(--font-anton), sans-serif' },
    { key: 'bebas',  label: 'Bebas',   family: 'var(--font-bebas), sans-serif' },
    { key: 'noto',   label: 'Noto JP', family: 'var(--font-noto), sans-serif' },
    { key: 'mplus',  label: 'M PLUS',  family: 'var(--font-mplus), sans-serif' },
  ] as const
  const graphFont = FONTS.find(f => f.key === fontKey)?.family ?? 'system-ui'

  const storageKey = `voted-${id}`
  const totalVotes = voteCounts.reduce((sum, v) => sum + v.count, 0)
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

  const fetchVotes = async () => {
    const { data, error } = await supabase.from('votes').select('option_id, voter_name').eq('poll_id', id)
    const rows: { option_id: string; voter_name?: string | null }[] = (() => {
      if (!error && data) return data
      return []
    })()
    if (error) {
      const { data: fallback } = await supabase.from('votes').select('option_id').eq('poll_id', id)
      if (!fallback) return
      const counts: Record<string, number> = {}
      for (const v of fallback) counts[v.option_id] = (counts[v.option_id] ?? 0) + 1
      setVoteCounts(Object.entries(counts).map(([option_id, count]) => ({ option_id, count })))
      return
    }
    setAllVotes(rows as VoteRecord[])
    const counts: Record<string, number> = {}
    for (const v of rows) counts[v.option_id] = (counts[v.option_id] ?? 0) + 1
    setVoteCounts(Object.entries(counts).map(([option_id, count]) => ({ option_id, count })))
  }

  useEffect(() => {
    supabase.from('polls').select('*').eq('id', id).single().then(({ data }) => setPoll(data))
    supabase.from('poll_options').select('*').eq('poll_id', id).then(({ data }) => setOptions(data ?? []))
    fetchVotes()
    if (localStorage.getItem(storageKey)) setVoted(true)
    setIsAdmin(localStorage.getItem('isAdmin') === '1')
    const channel = supabase.channel('votes-' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `poll_id=eq.${id}` }, () => fetchVotes())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => {
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current) }
  }, [])

  const handleVote = async (optionId: string) => {
    setLoading(true); setSelectedId(optionId)
    const voterName = localStorage.getItem('voterName') ?? '名無し'
    const { error } = await supabase.from('votes').insert({ poll_id: id, option_id: optionId, voter_name: voterName })
    if (error) {
      const { error: retryError } = await supabase.from('votes').insert({ poll_id: id, option_id: optionId })
      if (retryError) { alert('投票に失敗しました。もう一度お試しください。'); setSelectedId(null); setLoading(false); return }
    }
    localStorage.setItem(storageKey, '1'); setVoted(true); setLoading(false); setPendingId(null)
  }

  const handleReveal = () => {
    if (phase === 'ready' || phase === 'revealed') { if (intervalRef.current) clearTimeout(intervalRef.current); setPhase('hidden'); return }
    setPhase('ready')
  }

  const handleStart = () => {
    const count = options.length; if (count === 0) return
    setPhase('suspense')
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
          }))
        } else {
          lastPercents = patternPercents(frame, count)
          setDisplayPercents(lastPercents)
          tick()
        }
      }, interval)
    }
    tick()
  }

  if (!poll) {
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
      </div>
      </>
    )
  }

  // ===== 通常の投票画面 =====
  return (
    <div className="min-h-screen" style={{ background: '#ffe600' }}>
      <header style={{ background: '#ffe600', borderBottom: '3px solid #000000' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="font-black text-black hover:opacity-60 transition-opacity text-sm">← 一覧</Link>
          <span className="text-black/40 font-bold">|</span>
          <span className="font-black text-black truncate">{poll.question}</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div style={{ background: '#ffffff', border: '2.5px solid #000000' }} className="p-6">
          <h1 className="text-2xl font-black text-black mb-6">{poll.question}</h1>

          {/* 選択肢（1段階目：選択） */}
          <div className="space-y-3 mb-6">
            {options.map((opt, i) => {
              const color = BAR_COLORS[i % BAR_COLORS.length]
              const isVotedSelection = selectedId === opt.id
              const isPending = pendingId === opt.id
              return (
                <div key={opt.id}>
                  {!voted ? (
                    <button
                      onClick={() => setPendingId(opt.id)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{ background: isPending ? color : '#ffffff', border: `2.5px solid ${color}` }}
                    >
                      <span className="w-4 h-4 flex-shrink-0" style={{ background: isPending ? '#ffffff' : color }} />
                      <span className="font-bold flex-1" style={{ color: isPending ? '#ffffff' : '#000000' }}>{opt.text}</span>
                      {isPending && <span className="text-lg font-black" style={{ color: '#ffffff' }}>✓</span>}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 flex-shrink-0" style={{ background: color }} />
                      <span className="text-black font-bold flex-1">{opt.text}</span>
                      {isVotedSelection && <span className="text-sm font-black" style={{ color }}>✓ あなたの票</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 確認（2段階目） */}
          {!voted && pendingId && (
            <div className="mb-8 p-4 text-center" style={{ background: '#f5f5f5', border: '2.5px solid #000000' }}>
              <p className="text-black font-bold mb-3">
                「{options.find((o) => o.id === pendingId)?.text}」に投票します。よろしいですか？
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleVote(pendingId)}
                  disabled={loading}
                  style={{ background: '#000000', color: '#ffe600' }}
                  className="font-black px-6 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {loading ? '投票中...' : 'この内容で投票する'}
                </button>
                <button
                  onClick={() => setPendingId(null)}
                  disabled={loading}
                  style={{ background: '#ffe600', color: '#000000', border: '2px solid #000000' }}
                  className="font-black px-6 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  選び直す
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

          {/* 管理者向け投票者一覧・結果ボタン */}
          {isAdmin && (
            <div className="mt-6 pt-6" style={{ borderTop: '2px solid #000000' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-black">
                  📋 投票者一覧
                  <span className="ml-2" style={{ color: '#ff2200' }}>{allVotes.length}</span>
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
                allVotes.length === 0 ? (
                  <p className="text-sm text-black/50 mb-3">まだ誰も投票していません</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 mb-3">
                    {allVotes.map((vote, i) => {
                      const optIndex = options.findIndex((o) => o.id === vote.option_id)
                      const option = options[optIndex]
                      const color = optIndex >= 0 ? BAR_COLORS[optIndex % BAR_COLORS.length] : '#888888'
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm px-3 py-2" style={{ border: '1.5px solid #000000', background: '#ffe600' }}>
                          <span className="font-bold text-black flex-1 truncate">{vote.voter_name ?? '名無し'}</span>
                          <span className="text-black/40 text-xs font-black">→</span>
                          <span className="flex items-center gap-1.5 font-black" style={{ color }}>
                            <span className="w-2.5 h-2.5 flex-shrink-0" style={{ background: color }} />
                            {option?.text ?? '不明'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
              <div className="mt-4 text-center">
                <p className="text-sm text-black/50 mb-3">合計 <span className="font-black text-black">{totalVotes}</span> 票</p>
                <button onClick={handleReveal} style={{ background: '#000000', color: '#ffe600' }} className="font-black px-6 py-2 transition-opacity hover:opacity-80">
                  📊 結果を見る
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
