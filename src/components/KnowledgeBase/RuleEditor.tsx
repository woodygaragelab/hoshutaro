/**
 * RuleEditor — rules テーブル CRUD UI（Project Mu フェーズ1 蒸留結果の手動補正）。
 *
 * 機能:
 *  - task_type フィルタ
 *  - 一覧表示（usage / success / confidence / source 表示）
 *  - 新規追加ダイアログ
 *  - active トグル（即時反映）
 *  - 削除確認 ConfirmDialog（不可逆 → AlertDialog）
 */

import * as React from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
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
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  ConfirmDialog,
  EmptyState,
  InlineError,
  SectionHeader,
  TableSkeleton,
  sxTabularNum,
  sxLineClamp,
  sxTextPretty,
} from './common'
import {
  useCreateRule,
  useDeleteRule,
  useRules,
  useUpdateRule,
} from './hooks'

const TASK_TYPES = [
  'all',
  'id_normalization',
  'character_conversion',
  'header_pattern',
  'classification_inference',
  'location_hierarchy',
  'enrichment_classification_location',
] as const
type TaskTypeFilter = (typeof TASK_TYPES)[number]

interface Props {
  organization?: string
}

export function RuleEditor({ organization }: Props) {
  const [taskFilter, setTaskFilter] = React.useState<TaskTypeFilter>('all')
  const [includeInactive, setIncludeInactive] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [confirmId, setConfirmId] = React.useState<number | null>(null)

  const params = React.useMemo(
    () => ({
      task_type: taskFilter === 'all' ? undefined : taskFilter,
      organization,
      include_inactive: includeInactive,
      limit: 200,
    }),
    [taskFilter, includeInactive, organization],
  )

  const rulesQuery = useRules(params)
  const updateMutation = useUpdateRule()
  const deleteMutation = useDeleteRule()
  const createMutation = useCreateRule()

  const handleToggleActive = (id: number, active: boolean) => {
    updateMutation.mutate({ id, body: { active } })
  }

  const handleDelete = () => {
    if (confirmId == null) return
    deleteMutation.mutate(confirmId, {
      onSuccess: () => setConfirmId(null),
    })
  }

  return (
    <Box>
      <SectionHeader
        title="ルール編集"
        description="パイプラインで抽出されたルールの手動補正、新規追加、有効/無効切替。"
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            size="small"
          >
            新規ルール
          </Button>
        }
      />

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          select
          size="small"
          label="タスク種別フィルタ"
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value as TaskTypeFilter)}
          sx={{ minWidth: 240 }}
        >
          {TASK_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t === 'all' ? 'すべて' : t}
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Switch
            checked={includeInactive}
            onChange={(_, checked) => setIncludeInactive(checked)}
            inputProps={{ 'aria-label': '無効ルールも表示' }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            無効ルールも表示
          </Typography>
        </Stack>
      </Stack>

      {rulesQuery.error && <InlineError error={rulesQuery.error} />}

      {rulesQuery.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : !rulesQuery.data || rulesQuery.data.length === 0 ? (
        <EmptyState
          title="該当するルールがありません"
          description="Excel をアップロードして蒸留を行うか、「新規ルール」ボタンから手動登録してください。"
          actionLabel="新規ルールを追加"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <TableContainer>
          <Table size="small" aria-label="ルール一覧">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 56 }}>ID</TableCell>
                <TableCell>task_type</TableCell>
                <TableCell>instruction_text</TableCell>
                <TableCell>regex_pattern</TableCell>
                <TableCell sx={{ width: 80 }}>conf.</TableCell>
                <TableCell sx={{ width: 120 }}>usage / success</TableCell>
                <TableCell sx={{ width: 120 }}>source</TableCell>
                <TableCell sx={{ width: 80, textAlign: 'center' }}>active</TableCell>
                <TableCell sx={{ width: 56 }} aria-hidden></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rulesQuery.data.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell sx={sxTabularNum}>{rule.id}</TableCell>
                  <TableCell>
                    <Chip label={rule.task_type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={[sxLineClamp(2), sxTextPretty]}>
                      {rule.instruction_text ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      component="code"
                      sx={{ fontFamily: 'monospace', ...sxLineClamp(1) }}
                    >
                      {rule.regex_pattern ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={sxTabularNum}>{rule.confidence.toFixed(2)}</TableCell>
                  <TableCell sx={sxTabularNum}>
                    {rule.usage_count.toLocaleString()} / {rule.success_count.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Chip label={rule.source} size="small" />
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Switch
                      checked={rule.active}
                      onChange={(_, c) => handleToggleActive(rule.id, c)}
                      inputProps={{ 'aria-label': `ルール ${rule.id} の有効/無効` }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label={`ルール ${rule.id} を削除`}
                      onClick={() => setConfirmId(rule.id)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {(updateMutation.error || deleteMutation.error) && (
        <InlineError error={updateMutation.error ?? deleteMutation.error} />
      )}

      <CreateRuleDialog
        open={createOpen}
        organization={organization}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) =>
          createMutation.mutate(body, {
            onSuccess: () => setCreateOpen(false),
          })
        }
        loading={createMutation.isPending}
        error={createMutation.error}
      />

      <ConfirmDialog
        open={confirmId != null}
        title={`ルール ${confirmId ?? ''} を削除しますか？`}
        description="削除されたルールは復元できません。プロンプトキャッシュも次回呼び出し時に再構築されます。"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmId(null)}
        loading={deleteMutation.isPending}
      />
    </Box>
  )
}

// ───────────────────────────────────────────────────────────
// 新規ルール追加ダイアログ
// ───────────────────────────────────────────────────────────

interface CreateRuleDialogProps {
  open: boolean
  organization?: string
  onClose: () => void
  onSubmit: (body: {
    task_type: string
    instruction_text: string
    regex_pattern?: string
    confidence?: number
    organization?: string
  }) => void
  loading: boolean
  error: unknown
}

function CreateRuleDialog({
  open,
  organization,
  onClose,
  onSubmit,
  loading,
  error,
}: CreateRuleDialogProps) {
  const [taskType, setTaskType] = React.useState('id_normalization')
  const [instruction, setInstruction] = React.useState('')
  const [regex, setRegex] = React.useState('')
  const [confidence, setConfidence] = React.useState(0.7)

  const reset = () => {
    setTaskType('id_normalization')
    setInstruction('')
    setRegex('')
    setConfidence(0.7)
  }

  const handleClose = () => {
    if (!loading) {
      reset()
      onClose()
    }
  }

  const handleSubmit = () => {
    if (!instruction.trim()) return
    onSubmit({
      task_type: taskType,
      instruction_text: instruction.trim(),
      regex_pattern: regex.trim() || undefined,
      confidence,
      organization,
    })
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth transitionDuration={150}>
      <DialogTitle>新規ルールを追加</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            select
            label="タスク種別"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            fullWidth
            size="small"
          >
            {TASK_TYPES.filter((t) => t !== 'all').map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="指示文（必須）"
            placeholder="LLM 向け自然言語指示"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            size="small"
            required
          />
          <TextField
            label="正規表現パターン（任意）"
            placeholder="例: ^EQ\\d+$"
            value={regex}
            onChange={(e) => setRegex(e.target.value)}
            fullWidth
            size="small"
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          />
          <TextField
            label="信頼度"
            type="number"
            value={confidence}
            onChange={(e) => setConfidence(Math.max(0, Math.min(1, Number(e.target.value) || 0)))}
            slotProps={{ htmlInput: { step: 0.05, min: 0, max: 1 } }}
            size="small"
            sx={{ width: 200 }}
          />
          {error ? <InlineError error={error} /> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !instruction.trim()}
        >
          追加
        </Button>
      </DialogActions>
    </Dialog>
  )
}
