'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Poll, type PollOption } from '@/lib/supabase'

// スプラトゥーン風インクカラー
const INK_COLORS = [
  '#f5a623',
  '#7b2fbe',
  '#1ec4a8',
  '#e8365d',
  '#4caf50',
  '#2196f3',
]

// 得票数の集計型
type VoteCount = { option_id: string; count: number }

// 個別の投票データ型（管理者の投票者一覧表示に使う）
type VoteRecord = { option_id: string; voter_name: string | null }

// n個の要素が合計100になるランダムな整数配列を生成する
// minValue で各要素の最低値を保証し、視覚的に面白くする
function randomPercents(count: number, minValue = 5): number[] {
  if (count === 0) return []
  if (count === 1) return [100]

  const base = minValue
  let remaining = 100 - base * count
  const values = Array(count).fill(base)

  for (let i = 0; i < count - 1; i++) {
    const max = remaining - base * (count - i - 1)
    const take = Math.floor(Math.random() * (max + 1))
    values[i] += take
    remaining -= take
  }
  values[count - 1] += remaining

  return values.sort(() => Math.random() - 0.5)
}

export default function PollPage() {
  const { id } = useParams<{ id: string }>()

  const [poll, setPoll] = useState<Poll | null>(null)
  const [options, setOptions] = useState<PollOption[]>([])
  const [voteCounts, setVoteCounts] = useState<VoteCount[]>([])

  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // 全投票データ（option_id と voter_name の組み合わせ）
  // 管理者の投票者一覧表示に使う
  const [allVotes, setAllVotes] = useState<VoteRecord[]>([])

  // 結果表示フェーズ
  // 'hidden'   → 通常の投票画面
  // 'ready'    → グラフ画面に遷移済みだがアニメーション待機中
  // 'suspense' → ランダムにバタバタ変動中
  // 'revealed' → 本当の結果を表示
  const [phase, setPhase] = useState<'hidden' | 'ready' | 'suspense' | 'revealed'>('hidden')

  // バーに表示するパーセント配列（suspense中はランダム値、revealed後は実値）
  const [displayPercents, setDisplayPercents] = useState<number[]>([])

  // setIntervalのIDをrefで保持（クリーンアップのため）
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const storageKey = `voted-${id}`
  const totalVotes = voteCounts.reduce((sum, v) => sum + v.count, 0)

  // 実際の得票パーセント配列（optionsの並び順に合わせる）
  const realPercents = options.map((opt) => {
    const count = voteCounts.find((v) => v.option_id === opt.id)?.count ?? 0
    return totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
  })

  // Supabaseから最新の得票数と投票者一覧を取得する
  const fetchVotes = async () => {
    // voter_nameを含むクエリを試みる
    const { data, error } = await supabase
      .from('votes')
      .select('option_id, voter_name')
      .eq('poll_id', id)

    // voter_nameカラムが未作成などでエラーになった場合、option_idのみで再取得する
    // これにより、Supabaseのスキーマ変更前でも票数表示が壊れない
    const rows: { option_id: string; voter_name?: string | null }[] = (() => {
      if (!error && data) return data
      return [] // フォールバック失敗時は空を返す（後段で別途リトライする必要があれば拡張可）
    })()

    if (error) {
      // voter_nameなしで再取得してせめて票数だけ表示する
      const { data: fallback } = await supabase
        .from('votes')
        .select('option_id')
        .eq('poll_id', id)
      if (!fallback) return
      const counts: Record<string, number> = {}
      for (const v of fallback) {
        counts[v.option_id] = (counts[v.option_id] ?? 0) + 1
      }
      setVoteCounts(Object.entries(counts).map(([option_id, count]) => ({ option_id, count })))
      return
    }

    // 全投票データ（投票者一覧の表示に使う）
    setAllVotes(rows as VoteRecord[])
    // 選択肢ごとの票数を集計する
    const counts: Record<string, number> = {}
    for (const v of rows) {
      counts[v.option_id] = (counts[v.option_id] ?? 0) + 1
    }
    setVoteCounts(
      Object.entries(counts).map(([option_id, count]) => ({ option_id, count }))
    )
  }

  useEffect(() => {
    supabase.from('polls').select('*').eq('id', id).single().then(({ data }) => setPoll(data))
    supabase.from('poll_options').select('*').eq('poll_id', id).then(({ data }) => setOptions(data ?? []))
    fetchVotes()
    if (localStorage.getItem(storageKey)) setVoted(true)
    setIsAdmin(localStorage.getItem('isAdmin') === '1')

    // リアルタイムでvotesのINSERTを監視して票数を自動更新する
    const channel = supabase
      .channel('votes-' + id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `poll_id=eq.${id}` },
        () => fetchVotes()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  // アンマウント時にインターバルを確実にクリアする
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // 投票ボタンを押したときの処理
  const handleVote = async (optionId: string) => {
    setLoading(true)
    setSelectedId(optionId)
    const voterName = localStorage.getItem('voterName') ?? '名無し'

    // voter_nameを含めてINSERTを試みる
    const { error } = await supabase
      .from('votes')
      .insert({ poll_id: id, option_id: optionId, voter_name: voterName })

    if (error) {
      // voter_nameカラム未作成などのエラーの場合、カラムなしで再試行する
      const { error: retryError } = await supabase
        .from('votes')
        .insert({ poll_id: id, option_id: optionId })

      if (retryError) {
        // 再試行も失敗した場合は投票をキャンセルする
        console.error('投票INSERT失敗:', retryError)
        alert('投票に失敗しました。もう一度お試しください。')
        setSelectedId(null)
        setLoading(false)
        return
      }
    }

    // INSERTが成功したときだけ投票済みとして記録する
    localStorage.setItem(storageKey, '1')
    setVoted(true)
    setLoading(false)
  }

  // 「結果を見る」ボタンを押したときの処理
  // hiddenフェーズ → readyフェーズ（グラフ画面へ遷移・アニメーション待機）
  // ready/revealedフェーズ → hiddenフェーズ（投票画面へ戻る）
  const handleReveal = () => {
    if (phase === 'ready' || phase === 'revealed') {
      // グラフ画面から投票画面に戻す
      if (intervalRef.current) clearInterval(intervalRef.current)
      setPhase('hidden')
      return
    }
    // 投票画面からグラフ待機画面へ遷移
    setPhase('ready')
  }

  // 「スタート！」ボタンを押したときの処理
  // readyフェーズ → suspenseフェーズ（ランダムアニメーション開始）→ revealedフェーズ（本当の結果）
  const handleStart = () => {
    const count = options.length
    if (count === 0) return

    // suspenseフェーズ開始：ランダムな比率でバーを変動させる
    setPhase('suspense')
    setDisplayPercents(randomPercents(count))

    let elapsed = 0
    const TOTAL_DURATION = 7000  // サスペンス全体の時間（ミリ秒）
    const INTERVAL_MS = 300      // バーの更新間隔（ミリ秒）

    intervalRef.current = setInterval(() => {
      elapsed += INTERVAL_MS

      // 残り1500msで更新頻度を落として「落ち着いてきた感」を演出する
      const slowingDown = elapsed > TOTAL_DURATION - 1500
      if (slowingDown && elapsed % (INTERVAL_MS * 2) !== 0) return

      if (elapsed >= TOTAL_DURATION) {
        // revealedフェーズへ移行して本当の結果を表示する
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setDisplayPercents(realPercents)
        setPhase('revealed')
      } else {
        setDisplayPercents(randomPercents(count))
      }
    }, INTERVAL_MS)
  }

  if (!poll) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">読み込み中...</p>
      </div>
    )
  }

  // ===== グラフ表示モード（ready / suspense / revealed）=====
  // 画面全体をグラフが占める全画面レイアウト
  if (isAdmin && phase !== 'hidden') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        {/* タイトルバー */}
        <div className="px-8 py-5 flex items-center justify-between">
          <h1 className="text-white text-xl font-extrabold">{poll.question}</h1>
          {phase === 'ready' && (
            <span className="text-gray-400 font-bold text-lg">⏳ 準備完了</span>
          )}
          {phase === 'suspense' && (
            <span className="text-pink-400 font-black text-lg animate-pulse tracking-widest">🎰 集計中...</span>
          )}
          {phase === 'revealed' && (
            <span className="text-yellow-300 font-black text-lg tracking-wide">🎉 結果発表！</span>
          )}
        </div>

        {/* グラフ：画面の大半を占める縦長の横バー */}
        <div className="flex-1 flex flex-col justify-center px-8 py-4">
          <div
            className={`flex w-full rounded-3xl overflow-hidden shadow-2xl bg-gray-800 ${phase === 'revealed' ? 'reveal-glow' : ''}`}
            style={{ height: 'clamp(180px, 55vh, 480px)' }}
          >
            {phase === 'ready' ? (
              // readyフェーズ：各選択肢を等分で薄く表示して色の割り当てを予告する
              options.map((opt, i) => {
                const color = INK_COLORS[i % INK_COLORS.length]
                const percent = 100 / options.length
                const isFirst = i === 0
                const isLast = i === options.length - 1
                return (
                  <div
                    key={opt.id}
                    className="relative h-full overflow-hidden"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: color,
                      // 透過させて「待機中」感を出す
                      opacity: 0.3,
                      borderRadius: isFirst ? '24px 0 0 24px' : isLast ? '0 24px 24px 0' : '0',
                      transition: 'width 0.5s ease',
                    }}
                  />
                )
              })
            ) : phase === 'suspense' ? (
              // suspenseフェーズ：液体エフェクト付きのアニメーションバー
              options.map((opt, i) => {
                const percent = displayPercents[i] ?? 0
                if (percent === 0) return null
                const color = INK_COLORS[i % INK_COLORS.length]
                const isFirst = i === 0
                const isLast = i === options.length - 1
                // 各バーのアニメーション開始タイミングをずらして有機的な揺れを演出する
                const bobDelay = `${i * 0.18}s`
                const pulseDelay = `${i * 0.3 + 0.2}s`
                const shimmerDelay = `${i * 0.5}s`

                return (
                  <div
                    key={opt.id}
                    className="relative h-full overflow-hidden"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: color,
                      // 幅はゆっくり変化しつつ、上下のbobと輝度パルスで液体感を出す
                      transition: 'width 0.25s ease-in-out',
                      borderRadius: isFirst ? '24px 0 0 24px' : isLast ? '0 24px 24px 0' : '0',
                      // 上下の揺れと輝度パルスを同時に適用する（液体がグラスで揺れるイメージ）
                      animation: `liquid-bob 2.0s ease-in-out ${bobDelay} infinite, liquid-glow-pulse 2.8s ease-in-out ${pulseDelay} infinite`,
                      // バー間の境界を半透明の白線で区切り、液体の仕切りを表現する
                      borderLeft: i > 0 ? '2px solid rgba(255,255,255,0.25)' : 'none',
                    }}
                  >
                    {/* 液体内部の光の反射帯：遅延をずらして各バーが独立した輝き方をする */}
                    <div className="liquid-shimmer-overlay" style={{ animationDelay: shimmerDelay }} />
                  </div>
                )
              })
            ) : (
              // revealedフェーズ：弾む動きで本当の結果を表示する
              options.map((opt, i) => {
                const percent = displayPercents[i] ?? 0
                if (percent === 0) return null
                const color = INK_COLORS[i % INK_COLORS.length]
                const isFirst = i === 0
                const isLast = i === options.length - 1

                return (
                  <div
                    key={opt.id}
                    className="relative h-full overflow-hidden"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: color,
                      // 弾む動きで最終的な幅へ遷移する（overshootで「ドン！」と決まる感じ）
                      transition: 'width 2.2s cubic-bezier(0.34, 1.6, 0.64, 1)',
                      borderRadius: isFirst ? '24px 0 0 24px' : isLast ? '0 24px 24px 0' : '0',
                      borderLeft: i > 0 ? '2px solid rgba(255,255,255,0.25)' : 'none',
                    }}
                  >
                    {/* 結果確定時に光の帯を走らせる */}
                    <div className="shine-overlay" />
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 下部：凡例とボタン */}
        <div className="px-8 pb-8">
          {/* 凡例：全フェーズで常時表示（色と選択肢名、revealedのみ%と票数も表示） */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6 justify-center">
            {options.map((opt, i) => {
              const count = voteCounts.find((v) => v.option_id === opt.id)?.count ?? 0
              const percent = displayPercents[i] ?? 0
              const color = INK_COLORS[i % INK_COLORS.length]
              return (
                <div key={opt.id} className="flex items-center gap-2 text-white">
                  {/* カラードット：どの色がどの選択肢かを示す */}
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-bold">{opt.text}</span>
                  {/* パーセントと票数はrevealed後のみ表示（suspense中の値はランダムなので非表示） */}
                  {phase === 'revealed' && (
                    <>
                      <span className="font-black text-lg" style={{ color }}>{percent}%</span>
                      <span className="text-gray-400 text-sm">({count}票)</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* 合計票数とアクションボタン */}
          <div className="flex items-center justify-center gap-6">
            <span className="text-gray-400 text-sm">
              合計 <span className="text-pink-400 font-bold">{totalVotes}</span> 票
            </span>

            {/* readyフェーズ：スタートボタンを大きく表示する */}
            {phase === 'ready' && (
              <button
                onClick={handleStart}
                className="bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 text-white font-black px-10 py-4 rounded-full shadow-lg hover:shadow-xl transition text-xl tracking-wide"
              >
                🎰 スタート！
              </button>
            )}

            {/* suspenseフェーズ：アニメーション中は操作不可 */}
            {phase === 'suspense' && (
              <button
                disabled
                className="bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 text-white font-bold px-8 py-3 rounded-full shadow-lg opacity-60 cursor-not-allowed text-lg"
              >
                🎰 集計中...
              </button>
            )}

            {/* revealedフェーズ：結果を隠すボタン */}
            {phase === 'revealed' && (
              <button
                onClick={handleReveal}
                className="bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 text-white font-bold px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition"
              >
                🙈 結果を隠す
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ===== 通常の投票画面モード（phase === 'hidden'）=====
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 shadow-lg">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-3">
          <Link href="/" className="text-white/80 hover:text-white transition text-sm">← 一覧</Link>
          <span className="text-white/40">|</span>
          <span className="text-white font-bold truncate">{poll.question}</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-extrabold text-gray-800 mb-6">{poll.question}</h1>

          {/* 選択肢一覧と投票ボタン */}
          <div className="space-y-3 mb-8">
            {options.map((opt, i) => {
              const color = INK_COLORS[i % INK_COLORS.length]
              const isSelected = selectedId === opt.id
              return (
                <div key={opt.id} className="flex items-center gap-3">
                  {/* 選択肢のカラードット */}
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-gray-700 font-medium flex-1">{opt.text}</span>

                  {/* 未投票のみ投票ボタンを表示 */}
                  {!voted && (
                    <button
                      onClick={() => handleVote(opt.id)}
                      disabled={loading}
                      className="text-white text-sm font-bold px-4 py-1.5 rounded-full shadow hover:opacity-90 transition disabled:opacity-50"
                      style={{ backgroundColor: color }}
                    >
                      投票する
                    </button>
                  )}

                  {/* 自分が投票した選択肢にチェックマークを表示 */}
                  {voted && isSelected && (
                    <span className="text-sm font-bold" style={{ color }}>✓ あなたの票</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* 投票完了メッセージ */}
          {voted && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
              <p className="text-green-600 font-bold text-lg">🎉 投票ありがとうございました！</p>
              <p className="text-green-500 text-sm mt-1">
                {isAdmin
                  ? '結果はリアルタイムで更新されます'
                  : '結果は管理者が公開するまでお待ちください'}
              </p>
            </div>
          )}

          {/* 投票者一覧（管理者のみ表示・リアルタイム更新） */}
          {isAdmin && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm font-bold text-gray-600 mb-3">
                📋 投票者一覧
                <span className="ml-2 text-pink-500 font-black">{allVotes.length}</span>
                <span className="text-gray-400 font-normal">名が投票済み</span>
              </p>
              {allVotes.length === 0 ? (
                <p className="text-sm text-gray-400">まだ誰も投票していません</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {allVotes.map((vote, i) => {
                    // 投票先の選択肢インデックスを取得して色を決める
                    const optIndex = options.findIndex((o) => o.id === vote.option_id)
                    const option = options[optIndex]
                    const color = optIndex >= 0 ? INK_COLORS[optIndex % INK_COLORS.length] : '#aaa'
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-50 rounded-lg"
                      >
                        {/* 投票者名 */}
                        <span className="font-medium text-gray-700 flex-1 truncate">
                          {vote.voter_name ?? '名無し'}
                        </span>
                        <span className="text-gray-300 text-xs">→</span>
                        {/* 投票先の選択肢（色付きドット＋テキスト） */}
                        <span className="flex items-center gap-1.5 font-bold" style={{ color }}>
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          {option?.text ?? '不明'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 結果を見るボタン */}
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-400 mb-3">
                  合計 <span className="font-bold text-pink-500">{totalVotes}</span> 票
                </p>
                <button
                  onClick={handleReveal}
                  className="bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 text-white font-bold px-6 py-2 rounded-full shadow hover:shadow-lg transition"
                >
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
