import { mockAIService, MockAIService } from '../services/MockAIService';
import { MaintenanceSuggestion, AIResponse } from '../types';

describe('MockAIService', () => {
  let service: MockAIService;

  beforeEach(() => {
    service = new MockAIService();
  });

  describe('generateResponse', () => {
    it('保全関連のキーワードに対して適切な応答を生成する', async () => {
      const response = await service.generateResponse('設備の保全計画について教えて');
      
      expect(response.success).toBe(true);
      expect(response.content).toContain('保全');
      expect(response.suggestions).toBeDefined();
      expect(Array.isArray(response.suggestions)).toBe(true);
    });

    it('故障関連のキーワードに対して適切な応答を生成する', async () => {
      const response = await service.generateResponse('故障予測を行って');
      
      expect(response.success).toBe(true);
      expect(response.content).toMatch(/故障|異常|トラブル/);
      expect(response.suggestions).toBeDefined();
      if (response.suggestions) {
        expect(response.suggestions.length).toBeGreaterThan(0);
        response.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('equipmentId');
          expect(suggestion).toHaveProperty('timeHeader');
          expect(suggestion).toHaveProperty('suggestedAction');
          expect(suggestion).toHaveProperty('reason');
          expect(suggestion).toHaveProperty('confidence');
          expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
          expect(suggestion.confidence).toBeLessThanOrEqual(1);
        });
      }
    });

    it('コスト関連のキーワードに対して適切な応答を生成する', async () => {
      const response = await service.generateResponse('コスト最適化の提案をして');
      
      expect(response.success).toBe(true);
      expect(response.content).toContain('コスト');
      expect(response.suggestions).toBeDefined();
    });

    it('特定の設備IDに対して適切な応答を生成する', async () => {
      const response = await service.generateResponse('EQ001について教えて');
      
      expect(response.success).toBe(true);
      expect(response.content).toContain('EQ001');
      expect(response.suggestions).toBeDefined();
      if (response.suggestions && response.suggestions.length > 0) {
        expect(response.suggestions[0].equipmentId).toBe('EQ001');
      }
    });

    it('設備名に対して適切な応答を生成する', async () => {
      const response = await service.generateResponse('ポンプA-1について');
      
      expect(response.success).toBe(true);
      expect(response.content).toContain('ポンプA-1');
    });

    it('マッチしない入力に対してデフォルト応答を生成する', async () => {
      const response = await service.generateResponse('天気はどうですか');
      
      expect(response.success).toBe(true);
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      // デフォルト応答では提案がない場合もある
    });

    it('空の入力に対して適切に処理する', async () => {
      const response = await service.generateResponse('');
      
      expect(response.success).toBe(true);
      expect(response.content).toBeDefined();
    });

    it('応答生成に適切な遅延がある', async () => {
      const startTime = Date.now();
      await service.generateResponse('テスト');
      const endTime = Date.now();
      
      // 1秒以上の遅延があることを確認（モック遅延）
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('analyzeEquipmentStatus', () => {
    it('設備IDリストに対して提案を生成する', async () => {
      const equipmentIds = ['EQ001', 'EQ002', 'EQ003'];
      const suggestions = await service.analyzeEquipmentStatus(equipmentIds);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(equipmentIds.length);
      
      suggestions.forEach((suggestion, index) => {
        expect(suggestion.equipmentId).toBe(equipmentIds[index]);
        expect(suggestion.timeHeader).toMatch(/^\d{4}-\d{2}$/);
        expect(['plan', 'actual', 'both']).toContain(suggestion.suggestedAction);
        expect(suggestion.reason).toBeDefined();
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0.6);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
        expect(suggestion.cost).toBeGreaterThan(0);
      });
    });

    it('存在しない設備IDに対して空の配列を返す', async () => {
      const suggestions = await service.analyzeEquipmentStatus(['INVALID_ID']);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    it('空の配列に対して空の配列を返す', async () => {
      const suggestions = await service.analyzeEquipmentStatus([]);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });
  });

  describe('generateMaintenanceReport', () => {
    it('有効な設備IDに対してレポートを生成する', async () => {
      const report = await service.generateMaintenanceReport('EQ001');
      
      expect(typeof report).toBe('string');
      expect(report).toContain('EQ001');
      expect(report).toContain('保全レポート');
      expect(report).toContain('現在の状態');
      expect(report).toContain('推奨アクション');
    });

    it('存在しない設備IDに対してエラーメッセージを返す', async () => {
      const report = await service.generateMaintenanceReport('INVALID_ID');
      
      expect(typeof report).toBe('string');
      expect(report).toContain('見つかりません');
    });

    it('レポート生成に適切な遅延がある', async () => {
      const startTime = Date.now();
      await service.generateMaintenanceReport('EQ001');
      const endTime = Date.now();
      
      // 1.5秒以上の遅延があることを確認
      expect(endTime - startTime).toBeGreaterThanOrEqual(1500);
    });
  });

  describe('singleton instance', () => {
    it('mockAIServiceがMockAIServiceのインスタンスである', () => {
      expect(mockAIService).toBeInstanceOf(MockAIService);
    });

    it('複数回の呼び出しで一貫した結果を返す', async () => {
      const input = '保全計画について';
      const response1 = await mockAIService.generateResponse(input);
      const response2 = await mockAIService.generateResponse(input);
      
      // 同じパターンマッチングロジックを使用するため、同じタイプの応答が返される
      expect(response1.success).toBe(response2.success);
      expect(response1.suggestions?.length).toBeGreaterThan(0);
      expect(response2.suggestions?.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('response validation', () => {
    it('すべての応答がAIResponseインターフェースに準拠する', async () => {
      const testInputs = [
        '保全について',
        '故障予測',
        'コスト最適化',
        'EQ001',
        '不明な入力'
      ];

      for (const input of testInputs) {
        const response: AIResponse = await service.generateResponse(input);
        
        expect(response).toHaveProperty('success');
        expect(response).toHaveProperty('content');
        expect(typeof response.success).toBe('boolean');
        expect(typeof response.content).toBe('string');
        
        if (response.suggestions) {
          expect(Array.isArray(response.suggestions)).toBe(true);
          response.suggestions.forEach((suggestion: MaintenanceSuggestion) => {
            expect(suggestion).toHaveProperty('equipmentId');
            expect(suggestion).toHaveProperty('timeHeader');
            expect(suggestion).toHaveProperty('suggestedAction');
            expect(suggestion).toHaveProperty('reason');
            expect(suggestion).toHaveProperty('confidence');
            expect(typeof suggestion.equipmentId).toBe('string');
            expect(typeof suggestion.timeHeader).toBe('string');
            expect(['plan', 'actual', 'both']).toContain(suggestion.suggestedAction);
            expect(typeof suggestion.reason).toBe('string');
            expect(typeof suggestion.confidence).toBe('number');
          });
        }
      }
    }, 15000); // Increase timeout to 15 seconds
  });
});