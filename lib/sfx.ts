// 結果発表の効果音。音声ファイルを使わず Web Audio API で合成する。
// ブラウザは操作（クリック）の中でないと音を出せないため、スタートボタンで unlock() を呼ぶこと。

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
  }
  return ctx
}

export function unlockSfx() {
  const c = getContext()
  if (c && c.state === 'suspended') c.resume()
}

function tone(c: AudioContext, { freq, start, duration, type = 'square', volume = 0.15 }: {
  freq: number; start: number; duration: number; type?: OscillatorType; volume?: number
}) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(c.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function noise(c: AudioContext, { start, duration, volume = 0.3 }: { start: number; duration: number; volume?: number }) {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buffer
  // シンバルっぽく高音だけ通す
  const filter = c.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 5000
  const gain = c.createGain()
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  src.connect(filter).connect(gain).connect(c.destination)
  src.start(start)
}

// グラフが伸縮するたびに鳴らす短いクリック音（progress: 0〜1 で少しずつ音程を上げて盛り上げる）
export function playTick(progress: number) {
  const c = getContext()
  if (!c) return
  const now = c.currentTime
  tone(c, { freq: 600 + 500 * progress, start: now, duration: 0.05, type: 'square', volume: 0.08 })
}

// 結果が出たときのファンファーレ（シンバル＋上昇する和音）
export function playReveal() {
  const c = getContext()
  if (!c) return
  const now = c.currentTime
  noise(c, { start: now, duration: 1.2, volume: 0.25 })
  const notes = [523.25, 659.25, 783.99, 1046.5] // ド・ミ・ソ・ド
  notes.forEach((freq, i) => tone(c, { freq, start: now + i * 0.09, duration: 0.25, type: 'triangle', volume: 0.2 }))
  // 最後に和音を伸ばす
  notes.forEach((freq) => tone(c, { freq, start: now + 0.4, duration: 1.3, type: 'triangle', volume: 0.12 }))
}
