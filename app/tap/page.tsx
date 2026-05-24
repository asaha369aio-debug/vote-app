'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Supabase Storageのバケット名
const BUCKET = 'tap-sounds'

// 1行あたりのパッド数（MPCスタイルの5列固定）
const COLS = 5

// テーマカラー（メインページと統一）
const th = {
  pageBg: '#ffe600',
  cardBg: '#ffffff',
  cardBorder: '#000000',
  titleColor: '#000000',
  mutedColor: '#444444',
  primaryBg: '#000000',
  primaryText: '#ffe600',
  playingBg: '#cc00ff',
  playingBorder: '#9900cc',
  dangerBg: '#ff2200',
}

// パッドの型定義
type Pad = {
  name: string      // 表示用ファイル名（日本語など元の文字列）
  path: string      // Storage上のパス（URLエンコード済み、キーとして使用）
  url: string
  size: number
  playing: boolean
}

// シークバー用の再生位置情報
type TimeInfo = {
  current: number   // 現在の再生位置（秒）
  duration: number  // 総再生時間（秒）
}

export default function TapPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [pads, setPads] = useState<Pad[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  // パッド名をキーに再生位置を管理（シークバー描画用）
  const [times, setTimes] = useState<Map<string, TimeInfo>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)
  // ファイル名をキーにHTMLAudioElementを管理
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  useEffect(() => {
    setIsAdmin(localStorage.getItem('isAdmin') === '1')
    loadPads()
  }, [])

  // Supabase Storageからファイル一覧と公開URLを取得
  const loadPads = async () => {
    setLoading(true)
    const { data: files, error } = await supabase.storage.from(BUCKET).list('', {
      sortBy: { column: 'created_at', order: 'asc' },
    })
    if (error || !files) { setLoading(false); return }

    const newPads: Pad[] = files
      .filter((f) => f.name !== '.emptyFolderPlaceholder')
      .map((f) => {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(f.name)
        return {
          name: decodeURIComponent(f.name),  // 表示用に日本語へ戻す
          path: f.name,                       // Storage上のエンコード済みパス
          url: data.publicUrl,
          size: f.metadata?.size ?? 0,
          playing: false,
        }
      })

    setPads(newPads)
    setLoading(false)
  }

  // 管理者のみ: 音声ファイルをSupabase Storageにアップロード
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    setUploadError('')

    for (const file of files) {
      // 日本語などのマルチバイト文字をURLセーフなパスに変換してアップロード
      const safePath = encodeURIComponent(file.name)
      const { error } = await supabase.storage.from(BUCKET).upload(safePath, file, {
        upsert: false,
      })
      if (error) { setUploadError(`アップロード失敗: ${file.name}（${error.message}）`); break }
    }

    e.target.value = ''
    await loadPads()
    setUploading(false)
  }

  // AudioElementを生成してイベントを登録（初回のみ）
  const getOrCreateAudio = (pad: Pad): HTMLAudioElement => {
    let audio = audioRefs.current.get(pad.path)
    if (audio) return audio

    audio = new Audio(pad.url)

    // メタデータ読み込み完了時に総再生時間を記録
    audio.onloadedmetadata = () => {
      setTimes((prev) => {
        const next = new Map(prev)
        next.set(pad.path, { current: 0, duration: audio!.duration })
        return next
      })
    }

    // 再生位置が変わるたびにシークバーを更新
    audio.ontimeupdate = () => {
      setTimes((prev) => {
        const next = new Map(prev)
        next.set(pad.path, { current: audio!.currentTime, duration: audio!.duration || 0 })
        return next
      })
    }

    // 再生終了時に状態をリセット
    audio.onended = () => {
      setPads((prev) => prev.map((p) => (p.path === pad.path ? { ...p, playing: false } : p)))
      setTimes((prev) => {
        const next = new Map(prev)
        next.set(pad.path, { current: 0, duration: audio!.duration || 0 })
        return next
      })
    }

    audioRefs.current.set(pad.path, audio)
    return audio
  }

  // パッドをタップ: 再生/停止切り替え
  const handlePadTap = (pad: Pad) => {
    const audio = getOrCreateAudio(pad)

    if (pad.playing) {
      audio.pause()
      audio.currentTime = 0
      setPads((prev) => prev.map((p) => (p.path === pad.path ? { ...p, playing: false } : p)))
    } else {
      audio.currentTime = 0
      audio.play()
      setPads((prev) => prev.map((p) => (p.path === pad.path ? { ...p, playing: true } : p)))
    }
  }

  // シークバー操作: ドラッグで再生位置を変更
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>, pad: Pad) => {
    const audio = getOrCreateAudio(pad)
    const newTime = Number(e.target.value)
    audio.currentTime = newTime
    setTimes((prev) => {
      const next = new Map(prev)
      next.set(pad.path, { current: newTime, duration: audio.duration || 0 })
      return next
    })
  }

  // 合計使用容量をGB/MB表示に変換
  const totalBytes = pads.reduce((sum, p) => sum + p.size, 0)
  const storageLabel =
    totalBytes >= 1024 ** 3
      ? `${(totalBytes / 1024 ** 3).toFixed(3)} GB`
      : `${(totalBytes / 1024 ** 2).toFixed(3)} MB`

  // グリッドを5の倍数に揃えて空セルで埋める
  const totalCells = Math.max(COLS, Math.ceil(pads.length / COLS) * COLS)
  const cells: (Pad | null)[] = [
    ...pads,
    ...Array<null>(totalCells - pads.length).fill(null),
  ]

  return (
    <div className="min-h-screen" style={{ background: th.pageBg }}>
      {/* ヘッダー */}
      <header style={{ background: th.pageBg, borderBottom: '3px solid #000000' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-black text-sm hover:opacity-70 transition-opacity" style={{ color: th.titleColor }}>
              ← 戻る
            </Link>
            <h1 className="text-2xl font-black" style={{ color: th.titleColor }}>🎹 TAP</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* ストレージ使用量 */}
            {!loading && (
              <span className="text-xs font-black px-3 py-1.5" style={{ background: 'rgba(0,0,0,0.1)', color: th.titleColor }}>
                💾 {storageLabel} / 1 GB
              </span>
            )}

            {/* アップロードボタン（管理者のみ） */}
            {isAdmin && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="font-black px-5 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{ background: th.primaryBg, color: th.primaryText, fontSize: '0.95rem', border: '2px solid #000' }}
                >
                  {uploading ? 'アップロード中...' : '＋ 読み込む'}
                </button>
                <input ref={fileInputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
              </>
            )}
          </div>
        </div>

        {uploadError && (
          <div className="max-w-4xl mx-auto px-6 pb-3">
            <p className="text-xs font-black" style={{ color: th.dangerBg }}>✗ {uploadError}</p>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-center font-black" style={{ color: th.mutedColor }}>読み込み中...</p>
        ) : (
          <>
            {/* パッドグリッド */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: '12px' }}>
              {cells.map((pad, idx) =>
                pad ? (
                  <div
                    key={pad.path}
                    style={{
                      background: pad.playing ? th.playingBg : th.cardBg,
                      border: `3px solid ${pad.playing ? th.playingBorder : th.cardBorder}`,
                      minHeight: '130px',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: pad.playing ? '0 0 16px rgba(204,0,255,0.5)' : 'none',
                    }}
                  >
                    {/* タップ領域: アイコン＋ファイル名 */}
                    <button
                      onClick={() => handlePadTap(pad)}
                      className="active:scale-95 transition-all flex-1"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '14px 8px 8px',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: 'none',
                        width: '100%',
                      }}
                    >
                      {/* 再生/停止アイコン */}
                      <span style={{ fontSize: '1.8rem' }}>{pad.playing ? '⏹' : '▶'}</span>
                      {/* ファイル名（倍サイズ） */}
                      <span
                        style={{
                          fontSize: '1.36rem',
                          fontWeight: 900,
                          color: pad.playing ? '#fff' : th.titleColor,
                          wordBreak: 'break-all',
                          textAlign: 'center',
                          lineHeight: 1.3,
                          maxWidth: '100%',
                        }}
                      >
                        {pad.name}
                      </span>
                    </button>

                    {/* シークバー（パッド下部に配置） */}
                    <div
                      style={{ padding: '0 8px 8px' }}
                      onClick={(e) => e.stopPropagation()}  // パッドタップと干渉しないよう伝播を止める
                    >
                      <input
                        type="range"
                        min={0}
                        max={times.get(pad.path)?.duration || 0}
                        step={0.01}
                        value={times.get(pad.path)?.current || 0}
                        onChange={(e) => handleSeek(e, pad)}
                        style={{
                          width: '100%',
                          height: '4px',
                          accentColor: pad.playing ? '#fff' : th.playingBg,
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  // 未割り当ての空スロット
                  <div
                    key={`empty-${idx}`}
                    style={{
                      background: 'rgba(0,0,0,0.05)',
                      border: '3px dashed rgba(0,0,0,0.18)',
                      minHeight: '130px',
                    }}
                  />
                )
              )}
            </div>

            {pads.length === 0 && (
              <p className="text-center mt-8 font-black text-sm" style={{ color: th.mutedColor }}>
                {isAdmin ? '「読み込む」ボタンから音声ファイルを追加してください' : '音声ファイルがまだありません'}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
