import { MaintenanceSuggestion } from '../components/AIAssistant/types';

export interface ExcelImportResult {
  success: boolean;
  summary: string;
  suggestions?: MaintenanceSuggestion[];
}

export async function uploadExcelFile(file: File, sessionId: string): Promise<ExcelImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', sessionId);

  const res = await fetch('/api/data/import/excel', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errorResponse = await res.json();
      errorDetail = errorResponse.detail || errorDetail;
    } catch {
      // ignore json parse error
    }
    throw new Error(`アップロード失敗: ${errorDetail}`);
  }

  return res.json();
}
