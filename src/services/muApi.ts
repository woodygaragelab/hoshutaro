/**
 * Project Mu / Knowledge Base API クライアント。
 *
 * バックエンド: backend/app/routers/mu.py
 * すべてローカル FastAPI（127.0.0.1:8000、Vite proxy 経由 /api/mu）を呼ぶ。
 */

// ───────────────────────────────────────────────────────────
// Types（Pydantic と一致、Track D で OpenAPI 自動生成に置換予定）
// ───────────────────────────────────────────────────────────

export interface MuRule {
  id: number
  task_type: string
  regex_pattern: string | null
  instruction_text: string | null
  organization: string | null
  // examples は task_type ごとに shape が異なる arbitrary JSON ペイロード
  examples: unknown[]
  confidence: number
  usage_count: number
  success_count: number
  source: string
  active: boolean
}

export interface MuMapping {
  id: number
  raw_name: string
  standard_name: string | null
  category_id: string | null
  location_path: string | null
  user_confirmed: boolean
  confidence: number | null
  organization: string | null
}

export interface MuLoraAdapter {
  version: string
  file_path: string | null
  base_model: string | null
  task_types: string[]
  training_examples_count: number
  // metrics は backend が返す可変キーの数値メトリクス
  metrics: Record<string, unknown>
  organization: string | null
  active: boolean
  created_at?: string | null
}

export interface MuTrainingCacheStats {
  total: number
  confirmed: number
  used: number
  pending: number
}

export interface MuDashboard {
  rules: {
    total: number
    active: number
    by_task_type: [string, number][]
  }
  master_map: {
    total: number
    confirmed: number
    top_locations: [string, number][]
    top_categories: [string, number][]
  }
  training_cache: MuTrainingCacheStats
  lora: {
    active_version: string | null
    all: MuLoraAdapter[]
  }
  cache: {
    vector_search_available: boolean
    vector_stats: { master_map_vec: number | null; rules_vec: number | null }
    kv_cache_disk: { file_count: number; total_bytes: number }
  }
  training_scheduler_status: {
    state: string
    pending: number
  }
}

export interface MuTrainingStatus {
  state: string
  started_at: string | null
  finished_at: string | null
  last_lora_version: string | null
  last_error: string | null
  pending: number
  threshold: number
}

export interface MuHealth {
  ok: boolean
  vector_search: boolean
  embedder: boolean
  training_scheduler: string
}

// ───────────────────────────────────────────────────────────
// API
// ───────────────────────────────────────────────────────────

const BASE = '/api/mu'

async function jsonGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  return res.json() as Promise<T>
}

async function jsonRequest<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<T | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${method} ${url} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

export const muApi = {
  // Dashboard / Health
  dashboard: (organization?: string) =>
    jsonGet<MuDashboard>(`${BASE}/dashboard${organization ? `?organization=${encodeURIComponent(organization)}` : ''}`),

  health: () => jsonGet<MuHealth>(`${BASE}/health`),

  // Rules
  listRules: (params: { task_type?: string; organization?: string; include_inactive?: boolean; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.set(k, String(v))
    })
    const query = qs.toString()
    return jsonGet<MuRule[]>(`${BASE}/rules${query ? `?${query}` : ''}`)
  },
  createRule: (body: Partial<MuRule> & { task_type: string; instruction_text: string }) =>
    jsonRequest<MuRule>(`${BASE}/rules`, 'POST', body),
  updateRule: (id: number, body: Partial<MuRule>) =>
    jsonRequest<MuRule>(`${BASE}/rules/${id}`, 'PATCH', body),
  deleteRule: (id: number) => jsonRequest<null>(`${BASE}/rules/${id}`, 'DELETE'),

  // Master map
  listMappings: (params: { organization?: string; confirmed_only?: boolean; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.set(k, String(v))
    })
    const query = qs.toString()
    return jsonGet<MuMapping[]>(`${BASE}/master_map${query ? `?${query}` : ''}`)
  },
  confirmMapping: (id: number, body: Partial<MuMapping>) =>
    jsonRequest<MuMapping>(`${BASE}/master_map/${id}/confirm`, 'POST', body),

  // Training cache
  trainingCacheStats: (organization?: string) =>
    jsonGet<MuTrainingCacheStats>(
      `${BASE}/training_cache/stats${organization ? `?organization=${encodeURIComponent(organization)}` : ''}`,
    ),

  // Training scheduler
  triggerTraining: (body: { organization?: string; task_type?: string; manual?: boolean }) =>
    jsonRequest<{ started: boolean; state: string; pending: number }>(`${BASE}/training/trigger`, 'POST', body),
  trainingStatus: (organization?: string) =>
    jsonGet<MuTrainingStatus>(
      `${BASE}/training/status${organization ? `?organization=${encodeURIComponent(organization)}` : ''}`,
    ),

  // LoRA
  listLoras: (organization?: string) =>
    jsonGet<MuLoraAdapter[]>(
      `${BASE}/lora_adapters${organization ? `?organization=${encodeURIComponent(organization)}` : ''}`,
    ),
  activateLora: (version: string) =>
    jsonRequest<{ activated: string }>(`${BASE}/lora_adapters/${encodeURIComponent(version)}/activate`, 'POST', {}),
  deactivateAllLoras: (organization?: string) =>
    jsonRequest<{ deactivated_count: number }>(
      `${BASE}/lora_adapters/deactivate${organization ? `?organization=${encodeURIComponent(organization)}` : ''}`,
      'POST',
      {},
    ),

  // Cache
  cacheStats: () => jsonGet<MuDashboard['cache']>(`${BASE}/cache/stats`),
  cleanupCache: () => jsonRequest<{ removed_orphans: number }>(`${BASE}/cache/cleanup`, 'POST', {}),
}

// ───────────────────────────────────────────────────────────
// Setup API（モデル初回ダウンロード）
// ───────────────────────────────────────────────────────────

export interface SetupStatus {
  models_root: string
  target_repo: string
  drafter_repo: string
  target_done: boolean
  drafter_done: boolean
  target_dir: string
  drafter_dir: string
  running: boolean
  state: string
  current_repo: string | null
  current_step: string | null
  progress_pct: number
  completed_repos: string[]
  error: string | null
}

export const setupApi = {
  status: () => jsonGet<SetupStatus>('/api/setup/status'),

  triggerDownload: (body: { include_drafter?: boolean; force?: boolean; hf_token?: string }) =>
    jsonRequest<{ started: boolean; state: string; detail: SetupStatus }>(
      '/api/setup/download_models',
      'POST',
      body,
    ),

  /**
   * SSE で進捗をストリーミング受信。
   * @param onProgress 進捗イベントごとに呼ばれるコールバック
   * @returns close 関数
   */
  streamProgress: (onProgress: (status: SetupStatus) => void): (() => void) => {
    const es = new EventSource('/api/setup/download_progress')
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        onProgress(data as SetupStatus)
      } catch {
        // ignore parse errors
      }
    }
    es.addEventListener('end', () => es.close())
    es.onerror = () => es.close()
    return () => es.close()
  },
}
