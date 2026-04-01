import { MaintenanceSuggestion } from '../components/AIAssistant/types';

export interface ExcelAnalysisResult {
  success: boolean;
  status: string;
  summary: string;
  total_rows: number;
  sheets?: Array<{
    sheet_name: string;
    summary: string;
    total_rows: number;
    structure_info: any;
    descriptors_info: any[];
    symbol_mapping: Record<string, string>;
    preview_records: any[];
    warnings: string[];
  }>;
  suggestions?: MaintenanceSuggestion[];
}

export interface ExcelImportResult {
  success: boolean;
  summary: string;
  suggestions?: MaintenanceSuggestion[];
}

export async function uploadExcelFile(file: File, sessionId: string): Promise<ExcelAnalysisResult> {
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

export async function confirmExcelImport(sessionId: string): Promise<any> {
  const res = await fetch('/api/data/import/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errorResponse = await res.json();
      errorDetail = errorResponse.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(`インポート失敗: ${errorDetail}`);
  }

  return res.json();
}

/**
 * マッピング結果を人間が読めるサマリに変換する
 */
export function formatMappingSummary(result: ExcelAnalysisResult): string {
  const lines: string[] = [];
  
  lines.push(`📋 **Excel解析結果** (${result.total_rows}行)`);
  lines.push('');
  
  if (result.sheets && result.sheets.length > 0) {
    for (const sheet of result.sheets) {
      lines.push(`---`);
      lines.push(`📑 **シート: ${sheet.sheet_name}** (${sheet.total_rows}行)`);
      
      if (sheet.structure_info) {
        const patternLabel = sheet.structure_info.pattern || '自動判定';
        lines.push(`  パターン: **${patternLabel}**`);
        if (sheet.structure_info.implied_hierarchy && Object.keys(sheet.structure_info.implied_hierarchy).length > 0) {
           const hier = Object.entries(sheet.structure_info.implied_hierarchy).map(([k, v]) => `${k}:${v}`).join(', ');
           lines.push(`  推定分類: ${hier}`);
        }
      }

      if (sheet.descriptors_info) {
        lines.push('  **列マッピング:**');
        const mapped = sheet.descriptors_info.filter((d: any) => d.field !== 'ignore');
        for (const d of mapped.slice(0, 8)) {
          let desc = `    Col${d.col} → ${d.field}`;
          if (d.month) desc += ` (${d.month}月)`;
          if (d.sub) desc += ` [${d.sub}]`;
          if (d.label) desc += ` "${d.label}"`;
          lines.push(desc);
        }
        if (mapped.length > 8) {
          lines.push(`    ... 他${mapped.length - 8}列`);
        }
      }

      if (sheet.preview_records && sheet.preview_records.length > 0) {
        lines.push(`  📊 プレビュー:`);
        for (const rec of sheet.preview_records.slice(0, 2)) {
          const id = rec.asset_id || '?';
          const name = rec.asset_name || '';
          const attrs = rec.hierarchyPath ? Object.values(rec.hierarchyPath).join('>') : "";
          lines.push(`    [${attrs}] ${id} ${name}`);
        }
      }

      if (sheet.warnings && sheet.warnings.length > 0) {
        lines.push('  ⚠️ 警告:');
        for (const w of sheet.warnings) {
          lines.push(`    - ${w}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
