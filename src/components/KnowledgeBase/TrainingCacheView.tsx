/**
 * TrainingCacheView — Project Mu 学習データの蓄積状況と手動学習トリガー。
 *
 * 機能:
 *  - training_cache 統計（total / confirmed / used / pending）
 *  - 学習スケジューラ状態（state / pending / threshold / last_lora_version / last_error）
 *  - 「今すぐ学習」ボタン（ConfirmDialog で確認、destructive ではないが時間がかかる旨説明）
 */

import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import {
  ConfirmDialog,
  InlineError,
  SectionHeader,
  StatCard,
  sxTabularNum,
  sxTextPretty,
} from './common'
import { useTrainingStats, useTrainingStatus, useTriggerTraining } from './hooks'

interface Props {
  organization?: string
}

export function TrainingCacheView({ organization }: Props) {
  const stats = useTrainingStats(organization)
  const status = useTrainingStatus(organization)
  const trigger = useTriggerTraining()
  const [confirming, setConfirming] = React.useState(false)

  const pending = stats.data?.pending ?? 0
  const total = stats.data?.total ?? 0
  const used = stats.data?.used ?? 0
  const confirmed = stats.data?.confirmed ?? 0
  const threshold = status.data?.threshold ?? 100
  const progressPct = Math.min(100, Math.round((pending / Math.max(1, threshold)) * 100))

  const isRunning = status.data?.state === 'running'

  return (
    <Box>
      <SectionHeader
        title="学習データ蓄積"
        description="フェーズ3 のユーザー確認結果が training_cache に蓄積され、閾値到達で自動学習が起動します。"
        action={
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            disabled={isRunning || pending === 0 || trigger.isPending}
            onClick={() => setConfirming(true)}
          >
            {isRunning ? '学習中…' : '今すぐ学習'}
          </Button>
        }
      />

      {(stats.error || status.error) && <InlineError error={stats.error ?? status.error} />}
      {trigger.error && <InlineError error={trigger.error} />}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="蓄積済み（合計）" value={total} loading={stats.isLoading} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="ユーザー確認済"
            value={confirmed}
            caption={`${total > 0 ? Math.round((confirmed / total) * 100) : 0}% 確認済`}
            loading={stats.isLoading}
            tone="positive"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="学習に使用済"
            value={used}
            caption={used > 0 ? `${Math.round((used / Math.max(1, confirmed)) * 100)}% 消化` : undefined}
            loading={stats.isLoading}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="学習待ち（pending）"
            value={pending}
            caption={
              pending >= threshold ? '閾値到達 — 自動学習対象' : `閾値 ${threshold} まで残り ${threshold - pending}`
            }
            loading={stats.isLoading}
            tone={pending >= threshold ? 'positive' : 'neutral'}
          />
        </Grid>
      </Grid>

      <Box sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', ...sxTextPretty }}>
            学習トリガーまでの進捗
          </Typography>
          <Typography variant="caption" sx={sxTabularNum}>
            {pending.toLocaleString()} / {threshold.toLocaleString()}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progressPct}
          aria-label="学習トリガー閾値までの進捗"
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      <SectionHeader title="学習ジョブステータス" />
      {status.isLoading ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          読み込み中…
        </Typography>
      ) : status.data ? (
        <Stack spacing={1}>
          <Row label="state" value={status.data.state} valueAccent={status.data.state === 'failed' ? 'error' : status.data.state === 'running' ? 'success' : undefined} />
          <Row label="started_at" value={status.data.started_at ?? '—'} />
          <Row label="finished_at" value={status.data.finished_at ?? '—'} />
          <Row label="last_lora_version" value={status.data.last_lora_version ?? '—'} />
          {status.data.last_error && (
            <Alert severity="error" variant="outlined" sx={{ mt: 1 }}>
              {status.data.last_error}
            </Alert>
          )}
        </Stack>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="LoRA 学習を今すぐ実行しますか？"
        description={`保留中 ${pending.toLocaleString()} 件のデータで LoRA トレーニングを起動します。Intel Arc GPU で 15-30 分程度かかります（マシンに応じて変動）。完了後、評価指標を確認のうえ手動で active 化してください。`}
        confirmLabel="学習開始"
        cancelLabel="キャンセル"
        onConfirm={() =>
          trigger.mutate(
            { organization, manual: true },
            {
              onSuccess: () => setConfirming(false),
            },
          )
        }
        onCancel={() => setConfirming(false)}
        loading={trigger.isPending}
      />
    </Box>
  )
}

interface RowProps {
  label: string
  value: string
  valueAccent?: 'success' | 'error'
}

function Row({ label, value, valueAccent }: RowProps) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="baseline"
      sx={{ px: 1.5, py: 0.75, borderRadius: 1, bgcolor: 'action.hover' }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', ...sxTextPretty }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: label === 'last_lora_version' ? 'monospace' : undefined,
          color: valueAccent === 'error' ? 'error.main' : valueAccent === 'success' ? 'success.main' : 'text.primary',
          ...sxTabularNum,
        }}
      >
        {value}
      </Typography>
    </Stack>
  )
}
