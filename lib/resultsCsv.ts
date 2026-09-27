import { supabase, type Poll, type PollOption } from '@/lib/supabase'

export type VoteRow = { poll_id: string; option_id: string; voter_name: string | null }

const PAGE_SIZE = 1000

// Supabase は1回の取得が最大1000行なので、票はページングして全件取得する
export async function fetchAllVotes(pollIds: string[]): Promise<VoteRow[]> {
  if (pollIds.length === 0) return []
  const rows: VoteRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('votes')
      .select('poll_id, option_id, voter_name')
      .in('poll_id', pollIds)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data as VoteRow[]))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

export type ResultItem = { title: string; questions: Poll[] }

// 1行 = 項目・質問・選択肢、列 = 合計・割合・投票者ごとの票数
export function buildResultsCsv(items: ResultItem[], options: PollOption[], votes: VoteRow[]): string {
  const voterNames = [...new Set(votes.map((v) => v.voter_name ?? '名無し'))]
  const rows: (string | number)[][] = [['項目', '質問', '選択肢', '合計', '割合(%)', ...voterNames]]

  for (const item of items) {
    for (const q of item.questions) {
      const questionVotes = votes.filter((v) => v.poll_id === q.id)
      for (const opt of options.filter((o) => o.poll_id === q.id)) {
        const optionVotes = questionVotes.filter((v) => v.option_id === opt.id)
        const percent = questionVotes.length > 0 ? Math.round((optionVotes.length / questionVotes.length) * 1000) / 10 : 0
        const perVoter = voterNames.map((name) => optionVotes.filter((v) => (v.voter_name ?? '名無し') === name).length)
        rows.push([item.title, q.question, opt.text, optionVotes.length, percent, ...perVoter])
      }
    }
  }

  const escape = (value: string | number) => {
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return rows.map((row) => row.map(escape).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  // Excelで文字化けしないようBOMを付ける
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace(/[\\/:*?"<>|]/g, '_')
  a.click()
  URL.revokeObjectURL(url)
}
