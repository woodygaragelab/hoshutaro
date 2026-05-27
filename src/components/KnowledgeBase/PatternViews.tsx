/**
 * LocationPatternView + ClassificationPatternView。
 *
 * dashboard API の top_locations / top_categories を、独立タブとして見やすく表示。
 * 同じ集計ロジックなので 1 ファイルに 2 コンポーネントを同居。
 */

import * as React from 'react'
import { Box, LinearProgress, Stack, Typography } from '@mui/material'
import {
  EmptyState,
  InlineError,
  SectionHeader,
  TableSkeleton,
  sxTabularNum,
  sxTextPretty,
} from './common'
import { useMuDashboard } from './hooks'

interface Props {
  organization?: string
}

interface PatternListProps {
  rows: [string, number][] | undefined
  loading: boolean
  emptyTitle: string
  emptyDescription: string
}

function PatternList({ rows, loading, emptyTitle, emptyDescription }: PatternListProps) {
  if (loading) return <TableSkeleton rows={6} columns={2} />
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }
  const max = Math.max(1, ...rows.map(([, n]) => n))
  return (
    <Stack spacing={1}>
      {rows.map(([key, count]) => (
        <Box key={key} sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={sxTextPretty}>
              {key}
            </Typography>
            <Typography variant="caption" sx={sxTabularNum}>
              {count.toLocaleString()}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.round((count / max) * 100)}
            aria-label={`${key} の利用件数 ${count}`}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      ))}
    </Stack>
  )
}

export function LocationPatternView({ organization }: Props) {
  const q = useMuDashboard(organization)
  return (
    <Box>
      <SectionHeader
        title="Location 階層パターン"
        description="master_map に登録された location_path の利用頻度上位。階層テンプレートの傾向を確認。"
      />
      {q.error && <InlineError error={q.error} />}
      <PatternList
        rows={q.data?.master_map.top_locations}
        loading={q.isLoading}
        emptyTitle="まだ十分なデータがありません"
        emptyDescription="フェーズ3 で確認済みマッピングを蓄積すると、よく使われる階層パターンが集計されます。"
      />
    </Box>
  )
}

export function ClassificationPatternView({ organization }: Props) {
  const q = useMuDashboard(organization)
  return (
    <Box>
      <SectionHeader
        title="Classification 集計"
        description="category_id 別マッピング件数。マスター分類の偏りやカバレッジ確認に。"
      />
      {q.error && <InlineError error={q.error} />}
      <PatternList
        rows={q.data?.master_map.top_categories}
        loading={q.isLoading}
        emptyTitle="まだ十分なデータがありません"
        emptyDescription="フェーズ3 で category_id を含むマッピングを蓄積すると、カテゴリ集計が表示されます。"
      />
    </Box>
  )
}
