/**
 * Knowledge Base UI 共通フック（React Query ラッパ）。
 *
 * Project Mu バックエンド `/api/mu/*` および `/api/setup/*` を呼ぶ。
 * QueryClient はアプリ全体の providers/ThemeProvider.tsx で提供済み。
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import {
  muApi,
  setupApi,
  type MuRule,
  type MuMapping,
  type MuLoraAdapter,
  type MuDashboard,
  type MuTrainingCacheStats,
  type MuTrainingStatus,
  type SetupStatus,
} from '../../services/muApi'

// ───────────────────────────────────────────────────────────
// Query keys（無効化対象を集中管理）
// ───────────────────────────────────────────────────────────

export const muKeys = {
  all: ['mu'] as const,
  dashboard: (org?: string) => [...muKeys.all, 'dashboard', org ?? null] as const,
  health: () => [...muKeys.all, 'health'] as const,
  rules: (params?: Record<string, unknown>) => [...muKeys.all, 'rules', params ?? {}] as const,
  mappings: (params?: Record<string, unknown>) => [...muKeys.all, 'mappings', params ?? {}] as const,
  trainingStats: (org?: string) => [...muKeys.all, 'trainingStats', org ?? null] as const,
  trainingStatus: (org?: string) => [...muKeys.all, 'trainingStatus', org ?? null] as const,
  loras: (org?: string) => [...muKeys.all, 'loras', org ?? null] as const,
  cacheStats: () => [...muKeys.all, 'cacheStats'] as const,
  setupStatus: () => ['setup', 'status'] as const,
}

// ───────────────────────────────────────────────────────────
// Dashboard / Health
// ───────────────────────────────────────────────────────────

export function useMuDashboard(organization?: string, opts?: Partial<UseQueryOptions<MuDashboard>>) {
  return useQuery<MuDashboard>({
    queryKey: muKeys.dashboard(organization),
    queryFn: () => muApi.dashboard(organization),
    refetchInterval: 30_000,
    ...opts,
  })
}

export function useMuHealth() {
  return useQuery({
    queryKey: muKeys.health(),
    queryFn: () => muApi.health(),
    refetchInterval: 60_000,
  })
}

// ───────────────────────────────────────────────────────────
// Rules
// ───────────────────────────────────────────────────────────

export function useRules(params: Parameters<typeof muApi.listRules>[0] = {}) {
  return useQuery<MuRule[]>({
    queryKey: muKeys.rules(params as Record<string, unknown>),
    queryFn: () => muApi.listRules(params),
  })
}

export function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof muApi.createRule>[0]) => muApi.createRule(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: muKeys.all })
    },
  })
}

export function useUpdateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<MuRule> }) => muApi.updateRule(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: muKeys.all })
    },
  })
}

export function useDeleteRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => muApi.deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: muKeys.all })
    },
  })
}

// ───────────────────────────────────────────────────────────
// Master map
// ───────────────────────────────────────────────────────────

export function useMappings(params: Parameters<typeof muApi.listMappings>[0] = {}) {
  return useQuery<MuMapping[]>({
    queryKey: muKeys.mappings(params as Record<string, unknown>),
    queryFn: () => muApi.listMappings(params),
  })
}

export function useConfirmMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<MuMapping> }) => muApi.confirmMapping(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: muKeys.all })
    },
  })
}

// ───────────────────────────────────────────────────────────
// Training cache + scheduler
// ───────────────────────────────────────────────────────────

export function useTrainingStats(organization?: string) {
  return useQuery<MuTrainingCacheStats>({
    queryKey: muKeys.trainingStats(organization),
    queryFn: () => muApi.trainingCacheStats(organization),
    refetchInterval: 30_000,
  })
}

export function useTrainingStatus(organization?: string) {
  return useQuery<MuTrainingStatus>({
    queryKey: muKeys.trainingStatus(organization),
    queryFn: () => muApi.trainingStatus(organization),
    refetchInterval: 5_000,
  })
}

export function useTriggerTraining() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof muApi.triggerTraining>[0]) => muApi.triggerTraining(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: muKeys.all })
    },
  })
}

// ───────────────────────────────────────────────────────────
// LoRA
// ───────────────────────────────────────────────────────────

export function useLoraAdapters(organization?: string) {
  return useQuery<MuLoraAdapter[]>({
    queryKey: muKeys.loras(organization),
    queryFn: () => muApi.listLoras(organization),
  })
}

export function useActivateLora() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (version: string) => muApi.activateLora(version),
    onSuccess: () => qc.invalidateQueries({ queryKey: muKeys.all }),
  })
}

export function useDeactivateAllLoras() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (organization: string | undefined) => muApi.deactivateAllLoras(organization),
    onSuccess: () => qc.invalidateQueries({ queryKey: muKeys.all }),
  })
}

// ───────────────────────────────────────────────────────────
// Cache
// ───────────────────────────────────────────────────────────

export function useCacheStats() {
  return useQuery({
    queryKey: muKeys.cacheStats(),
    queryFn: () => muApi.cacheStats(),
    refetchInterval: 60_000,
  })
}

export function useCleanupCache() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => muApi.cleanupCache(),
    onSuccess: () => qc.invalidateQueries({ queryKey: muKeys.all }),
  })
}

// ───────────────────────────────────────────────────────────
// Setup（初回モデルダウンロード）
// ───────────────────────────────────────────────────────────

export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: muKeys.setupStatus(),
    queryFn: () => setupApi.status(),
    refetchInterval: 10_000,
  })
}

export function useTriggerSetupDownload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof setupApi.triggerDownload>[0]) => setupApi.triggerDownload(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: muKeys.setupStatus() }),
  })
}

// ───────────────────────────────────────────────────────────
// 表示用ヘルパ
// ───────────────────────────────────────────────────────────

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function formatPercentage(value: number, total: number): string {
  if (!total) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}
