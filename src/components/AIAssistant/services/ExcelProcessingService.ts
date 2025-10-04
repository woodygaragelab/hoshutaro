import * as XLSX from 'xlsx';
import { ExcelImportResult, ImportError, DataMappingSuggestion } from '../types';

export class ExcelProcessingService {
  private readonly SUPPORTED_FORMATS = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];

  private readonly EQUIPMENT_FIELD_MAPPINGS = {
    // 設備ID関連
    'equipment_id': ['設備ID', '機器ID', 'Equipment ID', 'ID', 'equipment_code', '設備コード'],
    'equipment_name': ['設備名', '機器名', 'Equipment Name', 'Name', '名称', '機器名称'],
    'equipment_type': ['設備種別', '機器種別', 'Type', 'Equipment Type', '種別', 'タイプ'],
    'location': ['設置場所', '場所', 'Location', 'Plant', 'プラント', '工場'],
    'manufacturer': ['メーカー', 'Manufacturer', 'Maker', '製造元'],
    'model': ['型式', 'Model', '機種', 'モデル'],
    'serial_number': ['シリアル番号', 'Serial Number', 'S/N', 'Serial'],
    
    // 保全関連
    'maintenance_cycle': ['保全周期', 'Cycle', '周期', 'Maintenance Cycle', 'メンテナンス周期'],
    'last_maintenance': ['前回保全', 'Last Maintenance', '最終メンテナンス', '前回メンテナンス'],
    'next_maintenance': ['次回保全', 'Next Maintenance', '次回メンテナンス'],
    'maintenance_cost': ['保全費用', 'Cost', 'Maintenance Cost', 'コスト', '費用'],
    'maintenance_type': ['保全種別', 'Maintenance Type', '保全タイプ', 'メンテナンス種別'],
    
    // 日付関連
    'date': ['日付', 'Date', '年月', '実施日'],
    'year': ['年', 'Year', '年度'],
    'month': ['月', 'Month'],
    
    // 実績関連
    'planned': ['計画', 'Plan', 'Planned', '予定'],
    'actual': ['実績', 'Actual', '実施', '完了'],
    'status': ['状態', 'Status', 'ステータス'],
    'result': ['結果', 'Result', '判定']
  };

  async processFile(file: File): Promise<ExcelImportResult> {
    try {
      // ファイル形式チェック
      if (!this.isValidFileType(file)) {
        return {
          success: false,
          processedRows: 0,
          errors: [{
            row: 0,
            column: 'file',
            message: 'サポートされていないファイル形式です。Excel (.xlsx, .xls) またはCSV (.csv) ファイルをアップロードしてください。',
            severity: 'error'
          }],
          suggestions: []
        };
      }

      // ファイルサイズチェック (10MB制限)
      if (file.size > 10 * 1024 * 1024) {
        return {
          success: false,
          processedRows: 0,
          errors: [{
            row: 0,
            column: 'file',
            message: 'ファイルサイズが大きすぎます。10MB以下のファイルをアップロードしてください。',
            severity: 'error'
          }],
          suggestions: []
        };
      }

      // ファイル読み込み
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // 最初のシートを処理
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      if (!worksheet) {
        return {
          success: false,
          processedRows: 0,
          errors: [{
            row: 0,
            column: 'sheet',
            message: 'ワークシートが見つかりません。',
            severity: 'error'
          }],
          suggestions: []
        };
      }

      // データを JSON に変換
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        return {
          success: false,
          processedRows: 0,
          errors: [{
            row: 0,
            column: 'data',
            message: 'データが見つかりません。',
            severity: 'error'
          }],
          suggestions: []
        };
      }

      // ヘッダー行を取得
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1);

      // データマッピング提案を生成
      const mappingSuggestions = this.generateMappingSuggestions(headers);

      // データ検証
      const errors = this.validateData(dataRows, headers);

      return {
        success: errors.filter(e => e.severity === 'error').length === 0,
        processedRows: dataRows.length,
        errors,
        suggestions: mappingSuggestions
      };

    } catch (error) {
      console.error('Excel processing error:', error);
      return {
        success: false,
        processedRows: 0,
        errors: [{
          row: 0,
          column: 'system',
          message: `ファイル処理中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          severity: 'error'
        }],
        suggestions: []
      };
    }
  }

  private isValidFileType(file: File): boolean {
    return this.SUPPORTED_FORMATS.includes(file.type) || 
           file.name.toLowerCase().endsWith('.xlsx') ||
           file.name.toLowerCase().endsWith('.xls') ||
           file.name.toLowerCase().endsWith('.csv');
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          resolve(e.target.result);
        } else {
          reject(new Error('ファイル読み込みに失敗しました'));
        }
      };
      reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
      reader.readAsArrayBuffer(file);
    });
  }

  private generateMappingSuggestions(headers: string[]): DataMappingSuggestion[] {
    const suggestions: DataMappingSuggestion[] = [];

    headers.forEach(header => {
      const normalizedHeader = header?.toString().trim();
      if (!normalizedHeader) return;

      // 各フィールドタイプに対してマッチング
      Object.entries(this.EQUIPMENT_FIELD_MAPPINGS).forEach(([fieldType, patterns]) => {
        const matchScore = this.calculateMatchScore(normalizedHeader, patterns);
        if (matchScore > 0.6) {
          suggestions.push({
            sourceColumn: normalizedHeader,
            targetField: fieldType,
            confidence: matchScore,
            sampleValues: [] // 実際の実装では、サンプルデータを含める
          });
        }
      });
    });

    // 信頼度でソート
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateMatchScore(header: string, patterns: string[]): number {
    const normalizedHeader = header.toLowerCase();
    
    // 完全一致
    for (const pattern of patterns) {
      if (normalizedHeader === pattern.toLowerCase()) {
        return 1.0;
      }
    }

    // 部分一致
    let maxScore = 0;
    for (const pattern of patterns) {
      const normalizedPattern = pattern.toLowerCase();
      
      // 含まれているかチェック
      if (normalizedHeader.includes(normalizedPattern) || normalizedPattern.includes(normalizedHeader)) {
        const score = Math.min(normalizedHeader.length, normalizedPattern.length) / 
                     Math.max(normalizedHeader.length, normalizedPattern.length);
        maxScore = Math.max(maxScore, score * 0.8);
      }
      
      // レーベンシュタイン距離による類似度
      const distance = this.levenshteinDistance(normalizedHeader, normalizedPattern);
      const similarity = 1 - (distance / Math.max(normalizedHeader.length, normalizedPattern.length));
      if (similarity > 0.7) {
        maxScore = Math.max(maxScore, similarity * 0.7);
      }
    }

    return maxScore;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private validateData(dataRows: any[][], headers: string[]): ImportError[] {
    const errors: ImportError[] = [];

    dataRows.forEach((row, rowIndex) => {
      const actualRowNumber = rowIndex + 2; // ヘッダー行を考慮

      // 空行チェック
      if (row.every(cell => !cell || cell.toString().trim() === '')) {
        errors.push({
          row: actualRowNumber,
          column: 'all',
          message: '空行です',
          severity: 'warning'
        });
        return;
      }

      // 各セルの検証
      row.forEach((cell, colIndex) => {
        const header = headers[colIndex];
        const cellValue = cell?.toString().trim();

        // 必須フィールドのチェック（設備IDなど）
        if (this.isRequiredField(header) && (!cellValue || cellValue === '')) {
          errors.push({
            row: actualRowNumber,
            column: header,
            message: `必須項目が空です: ${header}`,
            severity: 'error'
          });
        }

        // データ型チェック
        if (cellValue && this.isDateField(header) && !this.isValidDate(cellValue)) {
          errors.push({
            row: actualRowNumber,
            column: header,
            message: `日付形式が正しくありません: ${cellValue}`,
            severity: 'warning'
          });
        }

        if (cellValue && this.isNumericField(header) && !this.isValidNumber(cellValue)) {
          errors.push({
            row: actualRowNumber,
            column: header,
            message: `数値形式が正しくありません: ${cellValue}`,
            severity: 'warning'
          });
        }
      });
    });

    return errors;
  }

  private isRequiredField(header: string): boolean {
    const requiredPatterns = ['設備ID', '機器ID', 'Equipment ID', 'ID', '設備名', '機器名'];
    return requiredPatterns.some(pattern => 
      header?.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private isDateField(header: string): boolean {
    const datePatterns = ['日付', 'date', '年月', '実施日', 'maintenance', '保全'];
    return datePatterns.some(pattern => 
      header?.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private isNumericField(header: string): boolean {
    const numericPatterns = ['費用', 'cost', 'コスト', '金額', '周期', 'cycle'];
    return numericPatterns.some(pattern => 
      header?.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private isValidDate(value: string): boolean {
    // 様々な日付形式をサポート
    const datePatterns = [
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/, // YYYY-MM-DD, YYYY/MM/DD
      /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/, // MM-DD-YYYY, MM/DD/YYYY
      /^\d{4}年\d{1,2}月\d{1,2}日$/, // YYYY年MM月DD日
      /^\d{4}年\d{1,2}月$/, // YYYY年MM月
    ];

    return datePatterns.some(pattern => pattern.test(value)) || !isNaN(Date.parse(value));
  }

  private isValidNumber(value: string): boolean {
    // カンマ区切りの数値もサポート
    const cleanValue = value.replace(/[,¥$]/g, '');
    return !isNaN(Number(cleanValue)) && cleanValue !== '';
  }

  async generatePreviewData(file: File, mappingSuggestions: DataMappingSuggestion[]): Promise<any[]> {
    try {
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1, 6); // 最初の5行のみプレビュー

      return dataRows.map((row: any[]) => {
        const mappedRow: any = {};
        headers.forEach((header, index) => {
          const suggestion = mappingSuggestions.find(s => s.sourceColumn === header);
          const fieldName = suggestion ? suggestion.targetField : header;
          mappedRow[fieldName] = row[index];
        });
        return mappedRow;
      });
    } catch (error) {
      console.error('Preview generation error:', error);
      return [];
    }
  }
}

export const excelProcessingService = new ExcelProcessingService();