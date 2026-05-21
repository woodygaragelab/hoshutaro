import type { Asset, WorkOrder, WorkOrderLine } from '../types/maintenanceTask';
import type { UIContextSnapshot } from '../state/uiContextStore';
import { apiUrl } from './apiBase';

export interface SSEEvent {
  type:
    | 'status'
    | 'text_delta'
    | 'suggestion'
    | 'error'
    | 'workbook_update'
    | 'dashboard_update'
    | 'document_update'
    | 'op_summary'
    // プラン WS1-9 で追加した orchestrator イベント
    | 'intent_classified'
    | 'tool_call'
    | 'tool_result'
    | 'proposal_pending'
    | 'proposal_executed'
    | 'dialog_open_request';
  message?: string;
  delta?: string;
  suggestion?: unknown;
  // orchestrator イベント用フィールド（任意）
  intent?: string;
  confidence?: number;
  parameters?: Record<string, unknown>;
  out_of_scope_reason?: string | null;
  final_response?: string;
  operations?: unknown[];
  pending_operations?: unknown[];
  // dialog_open_request 用: 開くべきダイアログ種別
  dialog?: string;
}

export function startChatStream(
  sessionId: string,
  messages: { role: string; content: string }[],
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  onError: (err: string) => void,
  dataContext?: { assets: Asset[]; workOrders: WorkOrder[]; workOrderLines: WorkOrderLine[] },
  uiContext?: UIContextSnapshot
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
      const res = await fetch(apiUrl('/api/chat/completions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          session_id: sessionId,
          messages,
          data_context: dataContext || undefined,
          ui_context: uiContext || undefined,
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
              // SSE ping keepalive がストリームを開いたままにするため、
              // 明示的にreaderをキャンセルして接続を閉じる
              reader.cancel()
              return
            }
            if (!raw) continue
            try {
              const chunk = JSON.parse(raw)
              onEvent(chunk as SSEEvent)
            } catch (_e) {
              // ignore parse error for incomplete chunks
            }
          }
        }
      }
      emitDone()
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.name !== 'AbortError') {
          onError(e.message || '接続エラー')
        }
      } else {
        onError('接続エラー')
      }
      emitDone()
    }
  }

  run()

  return () => controller.abort()
}
