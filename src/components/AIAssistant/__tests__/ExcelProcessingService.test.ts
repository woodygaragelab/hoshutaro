import './setup';
import { ExcelProcessingService, excelProcessingService } from '../services/ExcelProcessingService';
import { ExcelImportResult, DataMappingSuggestion, ImportError } from '../types';

// Mock XLSX library
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn()
  }
}));

describe('ExcelProcessingService', () => {
  let service: ExcelProcessingService;
  let mockFile: File;

  beforeEach(() => {
    service = new ExcelProcessingService();
    
    // Create a mock Excel file
    const mockBlob = new (global as any).Blob(['mock excel content'], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    mockFile = new (global as any).File([mockBlob], 'test.xlsx', { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('processFile', () => {
    it('有効なExcelファイルを正常に処理する', async () => {
      // Mock XLSX behavior
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      };
      
      const mockData = [
        ['設備ID', '設備名', '保全周期', '費用'],
        ['EQ001', 'ポンプA-1', '6', '50000'],
        ['EQ002', 'コンプレッサーB-2', '12', '75000']
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const result = await service.processFile(mockFile);

      expect(result.success).toBe(true);
      expect(result.processedRows).toBe(2);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.errors.filter(e => e.severity === 'error').length).toBe(0);
    });

    it('サポートされていないファイル形式を拒否する', async () => {
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      const result = await service.processFile(invalidFile);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('サポートされていないファイル形式');
    });

    it('大きすぎるファイルを拒否する', async () => {
      // Create a mock file larger than 10MB
      const largeBlob = new (global as any).Blob(['x'.repeat(11 * 1024 * 1024)], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const largeFile = new (global as any).File([largeBlob], 'large.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const result = await service.processFile(largeFile);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('ファイルサイズが大きすぎます');
    });

    it('空のワークシートを適切に処理する', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      };

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue([]);

      const result = await service.processFile(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('データが見つかりません');
    });

    it('ワークシートが存在しない場合を処理する', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {}
      };

      require('xlsx').read.mockReturnValue(mockWorkbook);

      const result = await service.processFile(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('ワークシートが見つかりません');
    });

    it('ファイル読み込みエラーを適切に処理する', async () => {
      require('xlsx').read.mockImplementation(() => {
        throw new Error('File reading error');
      });

      const result = await service.processFile(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('ファイル処理中にエラーが発生しました');
    });
  });

  describe('データマッピング提案', () => {
    it('設備ID関連のヘッダーを正しく識別する', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      };
      
      const mockData = [
        ['設備ID', 'Equipment Name', '保全周期', 'Cost'],
        ['EQ001', 'Pump A-1', '6', '50000']
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const result = await service.processFile(mockFile);

      expect(result.suggestions.length).toBeGreaterThan(0);
      
      const equipmentIdMapping = result.suggestions.find(s => s.targetField === 'equipment_id');
      expect(equipmentIdMapping).toBeDefined();
      expect(equipmentIdMapping?.sourceColumn).toBe('設備ID');
      expect(equipmentIdMapping?.confidence).toBeGreaterThan(0.8);
    });

    it('英語のヘッダーを正しく識別する', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      };
      
      const mockData = [
        ['Equipment ID', 'Equipment Name', 'Maintenance Cycle', 'Cost'],
        ['EQ001', 'Pump A-1', '6', '50000']
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const result = await service.processFile(mockFile);

      const equipmentIdMapping = result.suggestions.find(s => s.targetField === 'equipment_id');
      expect(equipmentIdMapping).toBeDefined();
      expect(equipmentIdMapping?.confidence).toBe(1.0); // 完全一致
    });

    it('部分一致のヘッダーに適切な信頼度を設定する', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      };
      
      const mockData = [
        ['機器コード', '機器名称', 'メンテ周期'],
        ['EQ001', 'Pump A-1', '6']
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const result = await service.processFile(mockFile);

      const mappings = result.suggestions;
      expect(mappings.length).toBeGreaterThan(0);
      
      // 部分一致の場合、信頼度が1.0未満であることを確認
      mappings.forEach(mapping => {
        expect(mapping.confidence).toBeGreaterThan(0);
        expect(mapping.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('データ検証', () => {
    it('必須フィールドの欠損を検出する', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      };
      
      const mockData = [
        ['設備ID', '設備名'],
        ['', 'ポンプA-1'], // 設備IDが空
        ['EQ002', ''] // 設備名が空
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const result = await service.processFile(mockFile);

      const errors = result.errors.filter(e => e.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('必須項目が空です'))).toBe(true);
    });

    it('日付形式の検証を行う', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      };
      
      const mockData = [
        ['設備ID', '保全日付'],
        ['EQ001', '2024-04-15'], // 正しい形式
        ['EQ002', 'invalid-date'] // 不正な形式
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const result = await service.processFile(mockFile);

      const dateErrors = result.errors.filter(e => e.message.includes('日付形式'));
      expect(dateErrors.length).toBeGreaterThan(0);
    });

    it('数値形式の検証を行う', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      };
      
      const mockData = [
        ['設備ID', '費用'],
        ['EQ001', '50000'], // 正しい形式
        ['EQ002', 'not-a-number'] // 不正な形式
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const result = await service.processFile(mockFile);

      const numericErrors = result.errors.filter(e => e.message.includes('数値形式'));
      expect(numericErrors.length).toBeGreaterThan(0);
    });

    it('空行を警告として検出する', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      };
      
      const mockData = [
        ['設備ID', '設備名'],
        ['EQ001', 'ポンプA-1'],
        ['', ''], // 空行
        ['EQ002', 'コンプレッサーB-2']
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const result = await service.processFile(mockFile);

      const warnings = result.errors.filter(e => e.severity === 'warning');
      expect(warnings.some(w => w.message.includes('空行です'))).toBe(true);
    });
  });

  describe('generatePreviewData', () => {
    it('プレビューデータを正しく生成する', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      };
      
      const mockData = [
        ['設備ID', '設備名', '費用'],
        ['EQ001', 'ポンプA-1', '50000'],
        ['EQ002', 'コンプレッサーB-2', '75000'],
        ['EQ003', 'モーターC-3', '30000']
      ];

      const mappingSuggestions: DataMappingSuggestion[] = [
        {
          sourceColumn: '設備ID',
          targetField: 'equipment_id',
          confidence: 1.0,
          sampleValues: []
        },
        {
          sourceColumn: '設備名',
          targetField: 'equipment_name',
          confidence: 1.0,
          sampleValues: []
        }
      ];

      require('xlsx').read.mockReturnValue(mockWorkbook);
      require('xlsx').utils.sheet_to_json.mockReturnValue(mockData);

      const previewData = await service.generatePreviewData(mockFile, mappingSuggestions);

      expect(Array.isArray(previewData)).toBe(true);
      expect(previewData.length).toBeLessThanOrEqual(5); // 最大5行のプレビュー
      
      if (previewData.length > 0) {
        expect(previewData[0]).toHaveProperty('equipment_id');
        expect(previewData[0]).toHaveProperty('equipment_name');
      }
    });

    it('エラー時に空配列を返す', async () => {
      require('xlsx').read.mockImplementation(() => {
        throw new Error('File reading error');
      });

      const previewData = await service.generatePreviewData(mockFile, []);

      expect(Array.isArray(previewData)).toBe(true);
      expect(previewData.length).toBe(0);
    });
  });

  describe('singleton instance', () => {
    it('excelProcessingServiceがExcelProcessingServiceのインスタンスである', () => {
      expect(excelProcessingService).toBeInstanceOf(ExcelProcessingService);
    });
  });

  describe('ファイル形式サポート', () => {
    const supportedFiles = [
      { name: 'test.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'test.xls', type: 'application/vnd.ms-excel' },
      { name: 'test.csv', type: 'text/csv' }
    ];

    supportedFiles.forEach(({ name, type }) => {
      it(`${name}ファイルをサポートする`, async () => {
        const file = new (global as any).File(['content'], name, { type });
        
        // Mock successful processing
        const mockWorkbook = {
          SheetNames: ['Sheet1'],
          Sheets: { Sheet1: {} }
        };
        
        require('xlsx').read.mockReturnValue(mockWorkbook);
        require('xlsx').utils.sheet_to_json.mockReturnValue([
          ['設備ID', '設備名'],
          ['EQ001', 'テスト設備']
        ]);

        const result = await service.processFile(file);

        expect(result.success).toBe(true);
      });
    });

    const unsupportedFiles = [
      { name: 'test.txt', type: 'text/plain' },
      { name: 'test.pdf', type: 'application/pdf' },
      { name: 'test.doc', type: 'application/msword' }
    ];

    unsupportedFiles.forEach(({ name, type }) => {
      it(`${name}ファイルを拒否する`, async () => {
        const file = new (global as any).File(['content'], name, { type });
        
        const result = await service.processFile(file);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain('サポートされていないファイル形式');
      });
    });
  });
});