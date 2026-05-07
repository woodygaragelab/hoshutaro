/**
 * MappingSimilaritySearch — 入力した機器名に「似た過去マッピング」をベクトル検索で表示。
 *
 * 注: 現状 API はベクトル検索専用エンドポイントが無いため、master_map 一覧をクライアント側で
 *     簡易ファジー検索（substring + 前方一致重み）してプレビュー。Track A 後半で
 *     `/api/mu/master_map/similarity` 等のサーバ側ベクトル検索 API を追加予定。
 */

import * as React from 'react'
import {
  Box,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Button,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import {
  EmptyState,
  InlineError,
  SectionHeader,
  TableSkeleton,
  sxLineClamp,
  sxTabularNum,
  sxTextPretty,
} from './common'
import { useCacheStats, useMappings } from './hooks'

interface Props {
  organization?: string
}

/** 簡易類似度: substring と prefix のヒット長から疑似スコア化 (0-1)。 */
function pseudoSimilarity(query: string, target: string): number {
  if (!query || !target) return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t === q) return 1.0
  if (t.startsWith(q)) return 0.85
  if (t.includes(q)) return 0.7
  // 共通最長プレフィックス
  let i = 0
  while (i < q.length && i < t.length && q[i] === t[i]) i++
  if (i >= 3) return 0.4 + (i / Math.max(q.length, t.length)) * 0.3
  return 0
}

export function MappingSimilaritySearch({ organization }: Props) {
  const [query, setQuery] = React.useState('')
  const mappingsQuery = useMappings({ organization, confirmed_only: true, limit: 1000 })
  const cacheQuery = useCacheStats()

  const results = React.useMemo(() => {
    if (!mappingsQuery.data || !query.trim()) return []
    const q = query.trim()
    return mappingsQuery.data
      .map((m) => ({ mapping: m, score: pseudoSimilarity(q, m.raw_name) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
  }, [mappingsQuery.data, query])

  const vectorAvailable = cacheQuery.data?.vector_search_available

  return (
    <Box>
      <SectionHeader
        title="マッピング類似検索"
        description={
          vectorAvailable
            ? '機器名を入力すると、確認済マッピングから意味的に近いものを返します。'
            : 'sqlite-vec 拡張が無効のため、現在は文字列ベースの簡易検索で代替しています。'
        }
      />

      <TextField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="small"
        fullWidth
        placeholder="例: P-101 給水ポンプ A"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="検索クリア" onClick={() => setQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />

      <Box sx={{ mt: 2 }}>
        {mappingsQuery.error && <InlineError error={mappingsQuery.error} />}
        {mappingsQuery.isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : !query.trim() ? (
          <EmptyState
            title="検索キーワードを入力してください"
            description="機器名を入力すると、過去のマッピングから類似候補を提示します。"
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="一致する候補が見つかりません"
            description="表記を変えて再検索するか、フェーズ3 を実行して新規マッピングを蓄積してください。"
            actionLabel="検索クリア"
            onAction={() => setQuery('')}
          />
        ) : (
          <List dense>
            {results.map(({ mapping, score }) => (
              <ListItem
                key={mapping.id}
                sx={{
                  px: 1.5,
                  py: 1,
                  mb: 1,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  alignItems: 'flex-start',
                }}
                secondaryAction={
                  <Chip
                    label={`score ${score.toFixed(2)}`}
                    size="small"
                    variant="outlined"
                    sx={sxTabularNum}
                  />
                }
              >
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600, ...sxTextPretty }}>
                      {mapping.raw_name}
                    </Typography>
                  }
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                      {mapping.standard_name && (
                        <Typography variant="caption" sx={sxLineClamp(1)}>
                          → {mapping.standard_name}
                        </Typography>
                      )}
                      {mapping.category_id && <Chip size="small" label={mapping.category_id} />}
                      {mapping.location_path && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', ...sxLineClamp(1) }}>
                          {mapping.location_path}
                        </Typography>
                      )}
                    </Stack>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  )
}
