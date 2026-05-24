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

// パッドの型定義（Supabase Storageのファイル情報を元に構成）
type Pad = {
  name: string      // Supabase上のファイル名（パス）
  url: string       // 公開URL（再生に使用）
  size: number      // ファイルサイズ（バイト）
  playing: boolean  // 再生中かどうか
}

export default function TapPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [pads, setPads] = useState<Pad[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  // ファイル名をキーにHTMLAudioElementを管理
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  useEffect(() => {
    // 管理者フラグをlocalStorageから取得（他ページと統一）
    setIsAdmin(localStorage.getItem('isAdmin') === '1')
    loadPads()
  }, [])

  // Supabase Storageからファイル一覧と公開URLを取得してパッドに変換
  const loadPads = async () => {
    setLoading(true)

    const { data: files, error } = await supabase.storage.from(BUCKET).list('', {
      sortBy: { column: 'created_at', order: 'asc' },
    })

    if (error || !files) {
      setLoading(false)
      return
    }

    const newPads: Pad[] = files
      // Supabaseが自動生成する空フォルダプレースホルダーを除外
      .filter((f) => f.name !== '.emptyFolderPlaceholder')
      .map((f) => {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(f.name)
        return {
          name: f.name,
          url: data.publicUrl,
          size: f.metadata?.size ?? 0,
          playing: false,
        }
      })

    setPads(newPads)
    setLoading(false)
  }

  // 管理者のみ: 選択された音声ファイルをSupabase Storageにアップロード
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    setUploadError('')

    for (const file of files) {
      const { error } = await supabase.storage.from(BUCKET).upload(file.name, file, {
        upsert: false,  // 同名ファイルは上書きせずエラーにする
      })
      if (error) {
        setUploadError(`アップロード失敗: ${file.name}（${error.message}）`)
        break
      }
    }

    e.target.value = ''
    await loadPads()  // アップロード後にパッド一覧を再取得
    setUploading(false)
  }

  // パッドをタップ: 再生中なら停止、停止中なら再生
  const handlePadTap = (pad: Pad) => {
    const existingAudio = audioRefs.current.get(pad.name)

    if (pad.playing) {
      // 停止して先頭に戻す
      existingAudio?.pause()
      if (existingAudio) existingAudio.currentTime = 0
      setPads((prev) => prev.map((p) => (p.name === pad.name ? { ...p, playing: false } : p)))
    } else {
      // AudioElementを生成または再利用して再生
      let audio = existingAudio
      if (!audio) {
        audio = new Audio(pad.url)
        // 再生終了時に状態を自動リセット
        audio.onended = () => {
          setPads((prev) => prev.map((p) => (p.name === pad.name ? { ...p, playing: false } : p)))
        }
        audioRefs.current.set(pad.name, audio)
      }
      audio.currentTime = 0
      audio.play()
      setPads((prev) => prev.map((p) => (p.name === pad.name ? { ...p, playing: true } : p)))
    }
  }

  // 全ファイルの合計バイト数を計算してGB/MB表示に変換
  const totalBytes = pads.reduce((sum, p) => sum + p.size, 0)
  const storageLabel =
    totalBytes >= 1024 ** 3
      ? `${(totalBytes / 1024 ** 3).toFixed(3)} GB`
      : `${(totalBytes / 1024 ** 2).toFixed(3)} MB`

  // グリッドを5の倍数に揃えて空セルで埋める（最低1行 = 5マス）
  const totalCells = Math.max(COLS, Math.ceil(pads.length / COLS) * COLS)
  const cells: (Pad | null)[] = [
    ...pads,
    ...Array<null>(totalCells - pads.length).fill(null),
  ]

  return (
    <div className="min-h-screen" style={{ background: th.pageBg }}>
      {/* ヘッダー: 戻るリンク・タイトル・使用量・読み込みボタン */}
      <header style={{ background: th.pageBg, borderBottom: '3px solid #000000' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-black text-sm hover:opacity-70 transition-opacity"
              style={{ color: th.titleColor }}
            >
              ← 戻る
            </Link>
            <h1 className="text-2xl font-black" style={{ color: th.titleColor }}>
              🎹 TAP
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* ストレージ使用量（ファイル取得後に表示） */}
            {!loading && (
              <span
                className="text-xs font-black px-3 py-1.5"
                style={{ background: 'rgba(0,0,0,0.1)', color: th.titleColor }}
              >
                💾 {storageLabel} / 1 GB
              </span>
            )}

            {/* アップロードボタン（管理者のみ表示） */}
            {isAdmin && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="font-black px-5 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{
                    background: th.primaryBg,
                    color: th.primaryText,
                    fontSize: '0.95rem',
                    border: '2px solid #000',
                  }}
                >
                  {uploading ? 'アップロード中...' : '＋ 読み込む'}
                </button>
                {/* 非表示のファイル入力（audio/*のみ、複数ファイル対応） */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>
        </div>

        {/* アップロードエラーメッセージ */}
        {uploadError && (
          <div className="max-w-4xl mx-auto px-6 pb-3">
            <p className="text-xs font-black" style={{ color: th.dangerBg }}>
              ✗ {uploadError}
            </p>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          // ファイル取得中のローディング表示
          <p className="text-center font-black" style={{ color: th.mutedColor }}>
            読み込み中...
          </p>
        ) : (
          <>
            {/* パッドグリッド: 5列 × データ数に応じた行数 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                gap: '12px',
              }}
            >
              {cells.map((pad, idx) =>
                pad ? (
                  // 音声が割り当てられたアクティブパッド
                  <button
                    key={pad.name}
                    onClick={() => handlePadTap(pad)}
                    className="active:scale-95 transition-all"
                    style={{
                      background: pad.playing ? th.playingBg : th.cardBg,
                      border: `3px solid ${pad.playing ? th.playingBorder : th.cardBorder}`,
                      padding: '16px 8px',
                      minHeight: '110px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: pad.playing ? '0 0 16px rgba(204,0,255,0.5)' : 'none',
                    }}
                  >
                    {/* 再生/停止アイコン */}
                    <span style={{ fontSize: '1.8rem' }}>
                      {pad.playing ? '⏹' : '▶'}
                    </span>
                    {/* ファイル名（長い場合は折り返し表示） */}
                    <span
                      style={{
                        fontSize: '0.68rem',
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
                ) : (
                  // 未割り当ての空スロット
                  <div
                    key={`empty-${idx}`}
                    style={{
                      background: 'rgba(0,0,0,0.05)',
                      border: '3px dashed rgba(0,0,0,0.18)',
                      minHeight: '110px',
                    }}
                  />
                )
              )}
            </div>

            {/* ファイルが0件のときの案内メッセージ */}
            {pads.length === 0 && (
              <p
                className="text-center mt-8 font-black text-sm"
                style={{ color: th.mutedColor }}
              >
                {isAdmin
                  ? '「読み込む」ボタンから音声ファイルを追加してください'
                  : '音声ファイルがまだありません'}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
