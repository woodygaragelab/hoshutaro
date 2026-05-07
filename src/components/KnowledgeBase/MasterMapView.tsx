/**
 * MasterMapView — master_map（フェーズ3 のマッピング蓄積）の一覧と確認操作。
 */

import * as React from 'react'
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import {
  EmptyState,
  InlineError,
  SectionHeader,
  TableSkeleton,
  sxLineClamp,
  sxTabularNum,
  sxTextPretty,
} from './common'
import { useConfirmMapping, useMappings } from './hooks'

interface Props {
  organization?: string
}

export function MasterMapView({ organization }: Props) {
  const [confirmedOnly, setConfirmedOnly] = React.useState(false)
  const [filter, setFilter] = React.useState('')
  const params = React.useMemo(
    () => ({ organization, confirmed_only: confirmedOnly, limit: 200 }),
    [organization, confirmedOnly],
  )
  const mappingsQuery = useMappings(params)
  const confirmMutation = useConfirmMapping()

  const data = mappingsQuery.data
  const filtered = React.useMemo(() => {
    if (!data) return []
    if (!filter.trim()) return data
    const q = filter.trim().toLowerCase()
    return data.filter(
      (m) =>
        m.raw_name.toLowerCase().includes(q) ||
        (m.standard_name ?? '').toLowerCase().includes(q) ||
        (m.category_id ?? '').toLowerCase().includes(q) ||
        (m.location_path ?? '').toLowerCase().includes(q),
    )
  }, [data, filter])

  return (
    <Box>
      <SectionHeader
        title="マスターマッピング"
        description="フェーズ3 の確定マッピング一覧。raw_name から標準名 / 分類 / 階層へのマッピング履歴。"
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="検索（raw / standard / category / location）"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          fullWidth
        />
        <Stack direction="row" alignItems="center" spacing={1}>
          <Switch
            checked={confirmedOnly}
            onChange={(_, v) => setConfirmedOnly(v)}
            inputProps={{ 'aria-label': '確認済のみ表示' }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
            確認済のみ
          </Typography>
        </Stack>
      </Stack>

      {mappingsQuery.error && <InlineError error={mappingsQuery.error} />}
      {confirmMutation.error && <InlineError error={confirmMutation.error} />}

      {mappingsQuery.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="マッピングがまだ登録されていません"
          description="Excel をアップロードしてフェーズ3（意味補完）を実行すると、ユーザー確認後にマッピングが蓄積されます。"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="検索条件に一致するマッピングがありません"
          actionLabel="検索条件をクリア"
          onAction={() => setFilter('')}
        />
      ) : (
        <TableContainer>
          <Table size="small" aria-label="マスターマッピング">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 56 }}>ID</TableCell>
                <TableCell>raw_name</TableCell>
                <TableCell>standard_name</TableCell>
                <TableCell sx={{ width: 120 }}>category_id</TableCell>
                <TableCell>location_path</TableCell>
                <TableCell sx={{ width: 80 }}>conf.</TableCell>
                <TableCell sx={{ width: 90, textAlign: 'center' }}>確認</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell sx={sxTabularNum}>{m.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ ...sxLineClamp(1), ...sxTextPretty }}>
                      {m.raw_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={sxLineClamp(1)}>
                      {m.standard_name ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {m.category_id ? <Chip label={m.category_id} size="small" /> : '—'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={sxLineClamp(1)}>
                      {m.location_path ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={sxTabularNum}>
                    {m.confidence != null ? m.confidence.toFixed(2) : '—'}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <IconButton
                      size="small"
                      aria-label={
                        m.user_confirmed
                          ? `マッピング ${m.id} は確認済`
                          : `マッピング ${m.id} を確認済にする`
                      }
                      disabled={m.user_confirmed || confirmMutation.isPending}
                      onClick={() =>
                        confirmMutation.mutate({
                          id: m.id,
                          body: {
                            standard_name: m.standard_name ?? undefined,
                            category_id: m.category_id ?? undefined,
                            location_path: m.location_path ?? undefined,
                            confidence: 1.0,
                          },
                        })
                      }
                    >
                      {m.user_confirmed ? (
                        <CheckCircleIcon fontSize="small" color="success" />
                      ) : (
                        <CheckCircleOutlineIcon fontSize="small" />
                      )}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
