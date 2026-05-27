/**
 * LearningHistoryView — Project Mu 学習層の履歴ビュー。
 *
 * 現状の API では純粋な「履歴ストリーム」エンドポイントは未提供のため、
 * lora_adapters のレコードを「学習イベント」と見なし時系列で表示する。
 * 蒸留や手動承認の履歴は将来的に専用テーブル `learning_events` を追加して拡張予定。
 */

import * as React from 'react'
import {
  Box,
  Chip,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import {
  EmptyState,
  InlineError,
  SectionHeader,
  TableSkeleton,
  sxLineClamp,
  sxTabularNum,
  sxTextPretty,
} from './common'
import { useLoraAdapters, useTrainingStatus } from './hooks'

interface Props {
  organization?: string
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function LearningHistoryView({ organization }: Props) {
  const adapters = useLoraAdapters(organization)
  const status = useTrainingStatus(organization)

  const sortedAdapters = React.useMemo(() => {
    if (!adapters.data) return []
    return [...adapters.data].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })
  }, [adapters.data])

  return (
    <Box>
      <SectionHeader
        title="学習履歴"
        description="LoRA トレーニングジョブの履歴と評価指標。最新ジョブが上に表示されます。"
      />

      {(adapters.error || status.error) && <InlineError error={adapters.error ?? status.error} />}

      {status.data && (
        <Box
          sx={{
            mb: 3,
            px: 2,
            py: 1.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              現在のジョブ:
            </Typography>
            <Chip
              size="small"
              label={status.data.state}
              color={
                status.data.state === 'failed'
                  ? 'error'
                  : status.data.state === 'running'
                    ? 'success'
                    : 'default'
              }
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ...sxTextPretty }}>
              開始: {formatDateTime(status.data.started_at)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', ...sxTextPretty }}>
              終了: {formatDateTime(status.data.finished_at)}
            </Typography>
            {status.data.last_lora_version && (
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                last: {status.data.last_lora_version}
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {adapters.isLoading ? (
        <TableSkeleton rows={4} columns={2} />
      ) : sortedAdapters.length === 0 ? (
        <EmptyState
          title="学習履歴がまだありません"
          description="フェーズ3 で学習データを蓄積すると、自動 / 手動の LoRA トレーニング結果がここに記録されます。"
        />
      ) : (
        <Stepper orientation="vertical" nonLinear activeStep={-1}>
          {sortedAdapters.map((a) => (
            <Step key={a.version} expanded>
              <StepLabel
                StepIconComponent={() => (
                  <Box
                    aria-hidden
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: a.active ? 'success.main' : 'text.disabled',
                      mt: 1,
                    }}
                  />
                )}
              >
                <Stack direction="row" spacing={1.5} alignItems="baseline" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {a.version}
                  </Typography>
                  {a.active && <Chip label="active" size="small" color="success" />}
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatDateTime(a.created_at as unknown as string | null)}
                  </Typography>
                </Stack>
              </StepLabel>
              <StepContent>
                <Stack spacing={0.5} sx={{ pl: 0 }}>
                  <Typography variant="caption" sx={{ ...sxTextPretty, color: 'text.secondary' }}>
                    base_model: {a.base_model ?? '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    learned examples: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{a.training_examples_count.toLocaleString()}</span>
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {(a.task_types ?? []).map((t) => (
                      <Chip key={t} size="small" variant="outlined" label={t} />
                    ))}
                  </Stack>
                  {Object.keys(a.metrics ?? {}).length > 0 && (
                    <Typography variant="caption" sx={[sxLineClamp(2), sxTextPretty, sxTabularNum]}>
                      metrics: {Object.entries(a.metrics)
                        .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : String(v)}`)
                        .join(' / ')}
                    </Typography>
                  )}
                </Stack>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      )}
    </Box>
  )
}
