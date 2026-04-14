export interface LLMSettings {
  llm_adapter: string
  llm_temperature: number
  llm_max_tokens: number
}

export interface TestConnectionResult {
  ok: boolean
  latency_ms: number
  model_info?: string
  response_text?: string
  error?: string
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

export async function startLLMAdapter(adapter: string, pluginConfig: Record<string, any>): Promise<{ok: boolean, error?: string}> {
  const res = await fetch('/api/settings/llm/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adapter, plugin_config: pluginConfig }),
  })
  if (!res.ok) throw new Error('Failed to start LLM adapter')
  return res.json()
}

export async function testLLMConnection(adapter: string, pluginConfig: Record<string, any>): Promise<TestConnectionResult> {
  const res = await fetch('/api/settings/llm/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adapter, plugin_config: pluginConfig }),
  })
  return res.json()
}

export async function getLLMModels(adapter: string, pluginConfig: Record<string, any>): Promise<string[]> {
  const res = await fetch('/api/settings/llm/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adapter: adapter,
      plugin_config: pluginConfig,
    }),
  })
  if (!res.ok) throw new Error('Failed to fetch models')
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Unknown error fetching models')
  return data.models || []
}

export async function callLLMTool(adapter: string, pluginConfig: Record<string, any>, toolName: string, toolArgs: Record<string, any>): Promise<any> {
  const res = await fetch('/api/settings/llm/tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adapter: adapter,
      plugin_config: pluginConfig,
      tool_name: toolName,
      tool_args: toolArgs,
    }),
  })
  if (!res.ok) throw new Error(`Failed to call tool ${toolName}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || `Unknown error calling tool ${toolName}`)
  return data.result
}

export interface LocalModelInfo {
  name: string
  path: string
}

export interface PluginInfo {
  id: string
  name: string
  version: string
  category?: string
  status?: string
  configSchema?: Record<string, any>
}

export async function getInstalledPlugins(): Promise<PluginInfo[]> {
  const res = await fetch('/api/plugins')
  if (!res.ok) throw new Error('Failed to fetch plugins')
  const data = await res.json()
  return data.plugins || []
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

export async function getPluginConfig(pluginId: string): Promise<Record<string, any>> {
  const res = await fetch(`/api/plugins/${pluginId}/config`)
  if (!res.ok) {
    if (res.status === 404) return {}; // Plugin not found or no config
    throw new Error('Failed to fetch plugin config')
  }
  const data = await res.json()
  return data.config || {}
}

export async function updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/plugins/${pluginId}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config })
  })
  if (!res.ok) throw new Error('Failed to update plugin config')
  return res.json()
}
