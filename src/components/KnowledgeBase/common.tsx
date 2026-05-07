/**
 * Knowledge Base UI 共通コンポーネント。
 *
 * baseline-ui 制約遵守:
 *  - h-dvh 相当: sx の minHeight/100dvh
 *  - tabular-nums: 数値表示で fontVariantNumeric
 *  - text-balance / text-pretty: Typography sx
 *  - 構造的スケルトンでローディング
 *  - aria-label: 全アイコンボタンに付与
 *  - 不可逆操作 → ConfirmDialog
 */

import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Skeleton,
  Stack,
  Typography,
  type Theme,
} from '@mui/material'
import type { SystemStyleObject } from '@mui/system'

// ───────────────────────────────────────────────────────────
// 標準 sx スニペット（重複排除）
// 型は `SystemStyleObject<Theme>` — `sx={[a, b]}` の配列要素として受かる必要があるため（SxProps<Theme> だと型エラー）
// ───────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const sxTabularNum: SystemStyleObject<Theme> = { fontVariantNumeric: 'tabular-nums' }
// eslint-disable-next-line react-refresh/only-export-components
export const sxTextBalance: SystemStyleObject<Theme> = { textWrap: 'balance' as const }
// eslint-disable-next-line react-refresh/only-export-components
export const sxTextPretty: SystemStyleObject<Theme> = { textWrap: 'pretty' as const }
// eslint-disable-next-line react-refresh/only-export-components
export const sxLineClamp = (lines: number): SystemStyleObject<Theme> => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
})

// ───────────────────────────────────────────────────────────
// 統計カード
// ───────────────────────────────────────────────────────────

export type StatTone = 'neutral' | 'positive' | 'warning' | 'critical'

export interface StatCardProps {
  label: string
  value: string | number | null | undefined
  caption?: string
  tone?: StatTone
  loading?: boolean
}

export function StatCard({ label, value, caption, tone = 'neutral', loading }: StatCardProps) {
  const valueText = value === null || value === undefined ? '—' : String(value)
  const accentColor: Record<StatTone, string | undefined> = {
    neutral: undefined,
    positive: 'success.main',
    warning: 'warning.main',
    critical: 'error.main',
  }
  return (
    <Card aria-label={label} sx={{ minHeight: 112 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={0.75}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', letterSpacing: 0, ...sxTextPretty }}
          >
            {label}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={96} height={36} />
          ) : (
            <Typography
              variant="h5"
              component="div"
              sx={{
                fontWeight: 600,
                color: accentColor[tone] ?? 'text.primary',
                ...sxTabularNum,
              }}
            >
              {valueText}
            </Typography>
          )}
          {caption && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', ...sxTextPretty }}
            >
              {caption}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

// ───────────────────────────────────────────────────────────
// セクション見出し
// ───────────────────────────────────────────────────────────

export interface SectionHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={1.5}
      sx={{ mb: 2 }}
    >
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600, ...sxTextBalance }}>
          {title}
        </Typography>
        {description && (
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', ...sxTextPretty }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  )
}

// ───────────────────────────────────────────────────────────
// 空状態（baseline-ui: 必ず1つの明確な next action を提示）
// ───────────────────────────────────────────────────────────

export interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ py: 6, px: 3, textAlign: 'center' }}
      role="status"
      aria-live="polite"
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, ...sxTextBalance }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 480, ...sxTextPretty }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="contained" size="small" sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  )
}

// ───────────────────────────────────────────────────────────
// 行スケルトン（テーブルローディング用）
// ───────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Stack spacing={1} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, ri) => (
        <Stack direction="row" spacing={2} key={ri}>
          {Array.from({ length: columns }).map((_, ci) => (
            <Skeleton key={ci} variant="rectangular" height={36} sx={{ flex: 1, borderRadius: 1 }} />
          ))}
        </Stack>
      ))}
    </Stack>
  )
}

// ───────────────────────────────────────────────────────────
// 確認ダイアログ（不可逆アクション専用、baseline-ui 必須）
// ───────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      role="alertdialog"
      transitionDuration={150}
    >
      <DialogTitle id="confirm-dialog-title" sx={sxTextBalance}>
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description" sx={sxTextPretty}>
          {description}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} autoFocus disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color={destructive ? 'error' : 'primary'}
          variant="contained"
          disabled={loading}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ───────────────────────────────────────────────────────────
// インラインエラー（baseline-ui: errors next to where the action happens）
// ───────────────────────────────────────────────────────────

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <Alert severity="error" variant="outlined" sx={{ mt: 1 }}>
      {message}
    </Alert>
  )
}
