/**
 * SetupScreen — 初回モデル取得の誘導画面（プラン WS1-6）。
 *
 * `useSetupStatus` でバックエンドの `/api/setup/status` を polling し、target / drafter が
 * 未配置のときに HF トークン入力 + ダウンロード起動ボタン + SSE 進捗を表示する。
 *
 * App.tsx は target_done=false のとき本画面を起動時に出すゲートとして使う。
 */

import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { useSetupStatus, useTriggerSetupDownload } from '../KnowledgeBase/hooks'
import { setupApi, SetupStatus } from '../../services/muApi'

export interface SetupScreenProps {
  /** モデル取得済みになった時に呼ばれる（呼び出し側で画面を閉じる）。 */
  onComplete?: () => void
  /** 後で設定する場合のスキップ。 */
  onSkip?: () => void
}

export function SetupScreen({ onComplete, onSkip }: SetupScreenProps): React.ReactElement {
  const { data: status, refetch } = useSetupStatus()
  const trigger = useTriggerSetupDownload()
  const [hfToken, setHfToken] = useState('')
  const [streamStatus, setStreamStatus] = useState<SetupStatus | null>(null)

  // SSE 進捗を購読（ダウンロード中のみ有効）
  useEffect(() => {
    if (!status?.running) return
    const close = setupApi.streamProgress((s) => setStreamStatus(s))
    return () => {
      close()
    }
  }, [status?.running])

  const effective: SetupStatus | undefined = streamStatus ?? status
  const targetDone = effective?.target_done ?? false
  const drafterDone = effective?.drafter_done ?? false
  const running = effective?.running ?? false
  const progress = effective?.progress_pct ?? 0
  const errorMsg = effective?.error
  const currentStep = effective?.current_step
  const currentRepo = effective?.current_repo

  // 完了検出
  useEffect(() => {
    if (targetDone && !running && onComplete) {
      onComplete()
    }
  }, [targetDone, running, onComplete])

  const handleStart = async () => {
    await trigger.mutateAsync({
      include_drafter: true,
      force: false,
      hf_token: hfToken || undefined,
    })
    refetch()
  }

  return (
    <Dialog open fullWidth maxWidth="sm">
      <DialogTitle>初回モデルセットアップ</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2">
            HOSHUTARO のローカル LLM（Gemma 4 E2B-it + MTP drafter）を取得します。
            初回のみ実行が必要です。HuggingFace の gated モデルのため、HF アクセストークンを
            入力してください。
          </Typography>

          <Box>
            <Typography variant="caption" color="text.secondary">
              モデル配置先: {effective?.models_root ?? '~/.hoshutaro/models'}
            </Typography>
            <Typography variant="body2">
              target ({effective?.target_repo}): {targetDone ? '✓ 取得済み' : '未取得'}
            </Typography>
            <Typography variant="body2">
              drafter ({effective?.drafter_repo}): {drafterDone ? '✓ 取得済み' : '未取得（MTP 用）'}
            </Typography>
          </Box>

          {!targetDone && !running && (
            <TextField
              label="HuggingFace アクセストークン"
              placeholder="hf_xxx..."
              type="password"
              fullWidth
              value={hfToken}
              onChange={(e) => setHfToken(e.target.value)}
              helperText="Gemma 4 は gated モデルのため、利用申請済み HF アカウントのトークンが必要です。"
            />
          )}

          {running && (
            <Box>
              <Typography variant="body2" gutterBottom>
                {currentStep === 'converting'
                  ? `変換中: ${currentRepo}`
                  : `ダウンロード中: ${currentRepo}`}
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption" color="text.secondary">
                {progress.toFixed(1)} %
              </Typography>
            </Box>
          )}

          {errorMsg && (
            <Alert severity="error">エラー: {errorMsg}</Alert>
          )}

          {targetDone && !running && (
            <Alert severity="success">target モデルの取得が完了しました。</Alert>
          )}

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {onSkip && (
              <Button onClick={onSkip} disabled={running}>
                あとで
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={running || targetDone || trigger.isPending}
            >
              {trigger.isPending ? '起動中...' : 'ダウンロード開始'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export default SetupScreen
