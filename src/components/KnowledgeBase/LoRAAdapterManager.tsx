/**
 * LoRAAdapterManager — Project Mu 学習層の LoRA アダプター管理。
 *
 * 機能:
 *  - 一覧（base_model / training_examples_count / metrics / created_at / active）
 *  - active 切替（Radio 風 single-active）
 *  - 全アダプター無効化（ベースモデルへ戻す、ConfirmDialog）
 */

import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import {
  ConfirmDialog,
  EmptyState,
  InlineError,
  SectionHeader,
  TableSkeleton,
  sxLineClamp,
  sxTabularNum,
  sxTextPretty,
} from './common'
import {
  useActivateLora,
  useDeactivateAllLoras,
  useLoraAdapters,
} from './hooks'
import type { MuLoraAdapter } from '../../services/muApi'

interface Props {
  organization?: string
}

export function LoRAAdapterManager({ organization }: Props) {
  const adaptersQuery = useLoraAdapters(organization)
  const activateMutation = useActivateLora()
  const deactivateMutation = useDeactivateAllLoras()
  const [confirmingDeactivate, setConfirmingDeactivate] = React.useState(false)
  const [confirmingActivate, setConfirmingActivate] = React.useState<string | null>(null)

  const adapters = adaptersQuery.data ?? []
  const activeVersion = adapters.find((a) => a.active)?.version

  return (
    <Box>
      <SectionHeader
        title="LoRA アダプター管理"
        description="Project Mu 学習層が生成した LoRA を一覧表示し、適用バージョンを切替えます。切替時は紐づく KV キャッシュが invalidate されます。"
        action={
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            disabled={!activeVersion || deactivateMutation.isPending}
            onClick={() => setConfirmingDeactivate(true)}
          >
            ベースに戻す
          </Button>
        }
      />

      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        現在 active: <strong>{activeVersion ?? '(なし、ベースモデル使用)'}</strong>
      </Alert>

      {adaptersQuery.error && <InlineError error={adaptersQuery.error} />}
      {(activateMutation.error || deactivateMutation.error) && (
        <InlineError error={activateMutation.error ?? deactivateMutation.error} />
      )}

      {adaptersQuery.isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : adapters.length === 0 ? (
        <EmptyState
          title="まだ学習済 LoRA がありません"
          description="フェーズ3 で確認済の学習データが 100件以上溜まると、自動的に LoRA トレーニングが走ります。"
        />
      ) : (
        <TableContainer>
          <Table size="small" aria-label="LoRA アダプター一覧">
            <TableHead>
              <TableRow>
                <TableCell>version</TableCell>
                <TableCell>base_model</TableCell>
                <TableCell>task_types</TableCell>
                <TableCell sx={{ width: 100 }}>examples</TableCell>
                <TableCell>metrics</TableCell>
                <TableCell sx={{ width: 120, textAlign: 'right' }}>action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {adapters.map((a) => (
                <LoRARow
                  key={a.version}
                  adapter={a}
                  isActive={a.active}
                  onActivate={() => setConfirmingActivate(a.version)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDialog
        open={confirmingActivate != null}
        title={`LoRA "${confirmingActivate ?? ''}" を有効化しますか？`}
        description="切替後、現在の active アダプターは無効化されます。紐づくプロンプトキャッシュは invalidate され、次回呼び出し時に再構築されます。"
        confirmLabel="有効化"
        cancelLabel="キャンセル"
        onConfirm={() => {
          if (confirmingActivate) {
            activateMutation.mutate(confirmingActivate, {
              onSuccess: () => setConfirmingActivate(null),
            })
          }
        }}
        onCancel={() => setConfirmingActivate(null)}
        loading={activateMutation.isPending}
      />

      <ConfirmDialog
        open={confirmingDeactivate}
        title="すべての LoRA を無効化しますか？"
        description="ベースモデル（fine-tune 適用前）に戻ります。次回 LoRA を再有効化するまで、推論精度は base モデルの水準になります。"
        confirmLabel="ベースに戻す"
        cancelLabel="キャンセル"
        destructive
        onConfirm={() =>
          deactivateMutation.mutate(organization, {
            onSuccess: () => setConfirmingDeactivate(false),
          })
        }
        onCancel={() => setConfirmingDeactivate(false)}
        loading={deactivateMutation.isPending}
      />
    </Box>
  )
}

interface LoRARowProps {
  adapter: MuLoraAdapter
  isActive: boolean
  onActivate: () => void
}

function LoRARow({ adapter, isActive, onActivate }: LoRARowProps) {
  const metricsText = React.useMemo(() => {
    const entries = Object.entries(adapter.metrics ?? {})
    if (entries.length === 0) return '—'
    return entries
      .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : String(v)}`)
      .join(' / ')
  }, [adapter.metrics])

  return (
    <TableRow hover>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {adapter.version}
          </Typography>
          {isActive && <Chip label="active" size="small" color="success" />}
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={sxLineClamp(1)}>
          {adapter.base_model ?? '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {(adapter.task_types ?? []).map((t) => (
            <Chip key={t} label={t} size="small" variant="outlined" />
          ))}
        </Stack>
      </TableCell>
      <TableCell sx={sxTabularNum}>{adapter.training_examples_count.toLocaleString()}</TableCell>
      <TableCell>
        <Typography variant="caption" sx={{ ...sxLineClamp(2), ...sxTextPretty }}>
          {metricsText}
        </Typography>
      </TableCell>
      <TableCell sx={{ textAlign: 'right' }}>
        <Button
          size="small"
          variant={isActive ? 'outlined' : 'contained'}
          disabled={isActive}
          onClick={onActivate}
        >
          {isActive ? '有効' : '有効化'}
        </Button>
      </TableCell>
    </TableRow>
  )
}
