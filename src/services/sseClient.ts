export interface SSEEvent {
  type: 'status' | 'text_delta' | 'suggestion' | 'error' | 'workbook_update' | 'dashboard_update' | 'document_update' | 'op_summary';
  message?: string;
  delta?: string;
  suggestion?: any;
}

export function startChatStream(
  sessionId: string,
  messages: { role: string; content: string }[],
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  onError: (err: string) => void
): () => void {
  const controller = new AbortController()
  let doneEmitted = false

  function emitDone() {
    if (!doneEmitted) {
      doneEmitted = true
      onDone()
    }
  }

  async function run() {
    try {
      const res = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          session_id: sessionId,
          messages,
        }),
      })

      if (!res.ok || !res.body) {
        try {
          const err = await res.json()
          onError(`エラー: ${err.detail || res.statusText}`)
        } catch {
          onError(`エラー: ${res.statusText}`)
        }
        emitDone()
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') {
              emitDone()
              continue
            }
            if (!raw) continue
            try {
              const chunk = JSON.parse(raw)
              onEvent(chunk as SSEEvent)
            } catch (e) {
              // ignore parse error for incomplete chunks
            }
          }
        }
      }
      emitDone()
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        onError(e?.message ?? '接続エラー')
      }
      emitDone()
    }
  }

  run()

  return () => controller.abort()
}
