export interface LLMSettings {
  llm_adapter: string
  llm_base_url: string
  llm_model: string
  llm_api_key?: string
  llm_temperature: number
  llm_max_tokens: number
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
    body: JSON.stringify({
      base_url: settings.llm_base_url,
      model: settings.llm_model,
      api_key: settings.llm_api_key,
    }),
  })
  if (!res.ok) throw new Error('Failed to test connection')
  return res.json()
}
