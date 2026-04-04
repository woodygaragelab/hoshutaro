export interface LLMSettings {
  llm_adapter: string
  llm_base_url: string
  llm_model: string
  llm_api_key?: string
  llm_temperature: number
  llm_max_tokens: number
  openvino_models_dir?: string
  openvino_model_path?: string
  openvino_device?: string
  openvino_performance_mode?: string
}

export interface TestConnectionResult {
  ok: boolean
  latency_ms: number
  error?: string
  model_info?: string
}

export async function getLLMSettings(): Promise<LLMSettings> {
  const res = await fetch('/api/settings/llm')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export async function updateLLMSettings(settings: LLMSettings): Promise<void> {
  const res = await fetch('/api/settings/llm', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to update settings')
}

export async function testLLMConnection(settings: LLMSettings): Promise<TestConnectionResult> {
  const res = await fetch('/api/settings/llm/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return res.json()
}

export async function getLLMModels(baseUrl: string, apiKey?: string): Promise<string[]> {
  const res = await fetch('/api/settings/llm/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_url: baseUrl,
      api_key: apiKey,
    }),
  })
  if (!res.ok) throw new Error('Failed to fetch models')
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Unknown error fetching models')
  return data.models || []
}

export interface LocalModelInfo {
  name: string
  path: string
}

export async function getLocalModels(base_dir?: string): Promise<LocalModelInfo[]> {
  const url = base_dir 
    ? `/api/settings/local_models?base_dir=${encodeURIComponent(base_dir)}`
    : '/api/settings/local_models';
    
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch local models')
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Unknown error fetching local models')
  return data.models || []
}
