/**
 * Knowledge Base Dashboard — Project Mu の各層の統計サマリ。
 *
 * 表示する内容:
 *  - rules: 総数 / active / task_type 別件数
 *  - master_map: 総数 / 確認済み / top locations / top categories
 *  - training_cache: total / confirmed / used / pending
 *  - LoRA: active version / 全アダプター
 *  - cache: KV ディスク使用量 / vector search 状況
 *  - training scheduler: state / pending count
 */

import { Alert, Box, Chip, Grid, Stack, Typography } from '@mui/material'
import {
  EmptyState,
  InlineError,
  SectionHeader,
  StatCard,
  sxTabularNum,
  sxTextPretty,
} from './common'
import { formatBytes, useMuDashboard, useMuHealth } from './hooks'

interface DashboardProps {
  organization?: string
}

export function Dashboard({ organization }: DashboardProps) {
  const dashboardQuery = useMuDashboard(organization)
  const healthQuery = useMuHealth()

  const data = dashboardQuery.data
  const loading = dashboardQuery.isLoading
  const error = dashboardQuery.error
  const health = healthQuery.data

  if (error) {
    return (
      <Box>
        <SectionHeader title="ダッシュボード" />
        <InlineError error={error} />
      </Box>
    )
  }

  return (
    <Box>
      <SectionHeader
        title="ダッシュボード"
        description={
          organization
            ? `組織 "${organization}" のナレッジ蓄積状況`
            : 'ナレッジベースの統計サマリ。30秒ごとに自動更新します。'
        }
      />

      {!loading && health && !health.ok && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          一部の機能が利用できません。詳細はヘルスチェックを確認してください。
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="ルール総数"
            value={data?.rules.total ?? null}
            caption={
              data
                ? `アクティブ: ${data.rules.active.toLocaleString()} / 全${data.rules.total.toLocaleString()}`
                : undefined
            }
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="マッピング登録数"
            value={data?.master_map.total ?? null}
            caption={
              data
                ? `確認済: ${data.master_map.confirmed.toLocaleString()} / ${data.master_map.total.toLocaleString()}`
                : undefined
            }
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="学習データ未消化"
            value={data?.training_cache.pending ?? null}
            caption={
              data
                ? `確認済: ${data.training_cache.confirmed.toLocaleString()} / 学習済: ${data.training_cache.used.toLocaleString()}`
                : undefined
            }
            tone={(data?.training_cache.pending ?? 0) >= 100 ? 'positive' : 'neutral'}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="LoRA"
            value={data?.lora.active_version ?? '未適用'}
            caption={
              data
                ? `登録 ${data.lora.all.length.toLocaleString()} 件`
                : undefined
            }
            tone={data?.lora.active_version ? 'positive' : 'neutral'}
            loading={loading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="ベクトル検索"
            value={
              data
                ? data.cache.vector_search_available
                  ? '有効'
                  : '無効 (拡張未ロード)'
                : null
            }
            caption={
              data?.cache.vector_search_available
                ? `master_map_vec: ${data.cache.vector_stats.master_map_vec ?? 0} / rules_vec: ${data.cache.vector_stats.rules_vec ?? 0}`
                : 'sqlite-vec 拡張のロードに失敗しています'
            }
            tone={data?.cache.vector_search_available ? 'positive' : 'warning'}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="KV キャッシュ ディスク使用量"
            value={data ? formatBytes(data.cache.kv_cache_disk.total_bytes) : null}
            caption={
              data
                ? `${data.cache.kv_cache_disk.file_count.toLocaleString()} ファイル`
                : undefined
            }
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="学習スケジューラ"
            value={data?.training_scheduler_status.state ?? null}
            caption={
              data
                ? `保留: ${data.training_scheduler_status.pending.toLocaleString()} 件`
                : undefined
            }
            tone={
              data?.training_scheduler_status.state === 'running'
                ? 'positive'
                : data?.training_scheduler_status.state === 'failed'
                  ? 'critical'
                  : 'neutral'
            }
            loading={loading}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <SectionHeader title="タスクタイプ別ルール内訳" />
        {loading ? (
          <Stack direction="row" spacing={1}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Chip key={i} label="…" sx={{ minWidth: 96 }} />
            ))}
          </Stack>
        ) : !data || data.rules.by_task_type.length === 0 ? (
          <EmptyState
            title="ルールが登録されていません"
            description="Excel をアップロードしてルール蒸留 (フェーズ1) を実行するか、「ルール編集」タブから手動で追加してください。"
          />
        ) : (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {data.rules.by_task_type.map(([taskType, count]) => (
              <Chip
                key={taskType}
                label={
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography variant="body2" component="span">
                      {taskType}
                    </Typography>
                    <Typography variant="caption" component="span" sx={sxTabularNum}>
                      {count.toLocaleString()}
                    </Typography>
                  </Stack>
                }
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        )}
      </Box>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionHeader title="よく使われる Location" />
          {loading ? (
            <Stack spacing={1}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Chip key={i} label="…" sx={{ minWidth: 96 }} />
              ))}
            </Stack>
          ) : !data || data.master_map.top_locations.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', ...sxTextPretty }}>
              まだ十分なマッピングデータがありません。
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {data.master_map.top_locations.map(([path, count]) => (
                <Stack
                  key={path}
                  direction="row"
                  alignItems="baseline"
                  justifyContent="space-between"
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ ...sxTextPretty, mr: 2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {path}
                  </Typography>
                  <Typography variant="caption" sx={sxTabularNum}>
                    {count.toLocaleString()}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <SectionHeader title="よく使われる Category" />
          {loading ? (
            <Stack spacing={1}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Chip key={i} label="…" sx={{ minWidth: 96 }} />
              ))}
            </Stack>
          ) : !data || data.master_map.top_categories.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', ...sxTextPretty }}>
              まだ十分なマッピングデータがありません。
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {data.master_map.top_categories.map(([cat, count]) => (
                <Stack
                  key={cat}
                  direction="row"
                  alignItems="baseline"
                  justifyContent="space-between"
                  sx={{ px: 1.5, py: 0.75, borderRadius: 1, bgcolor: 'action.hover' }}
                >
                  <Typography variant="body2" sx={sxTextPretty}>
                    {cat}
                  </Typography>
                  <Typography variant="caption" sx={sxTabularNum}>
                    {count.toLocaleString()}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Grid>
      </Grid>
    </Box>
  )
}
