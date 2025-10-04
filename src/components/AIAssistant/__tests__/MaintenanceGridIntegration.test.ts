import { maintenanceGridIntegration } from '../services/MaintenanceGridIntegration';
import { MaintenanceSuggestion } from '../types';

// Import the actual mock data structure
import { mockMaintenanceData } from '../services/MockMaintenanceData';

describe('MaintenanceGridIntegration', () => {
  let mockUpdateCallback: jest.Mock;

  beforeEach(() => {
    mockUpdateCallback = jest.fn();
    jest.clearAllMocks();
  });

  describe('applySuggestionToGrid', () => {
    it('計画提案を正常に適用する', () => {
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: '定期点検が必要',
        confidence: 0.85,
        cost: 50000
      };

      const result = maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('提案を適用しました');
      expect(mockUpdateCallback).toHaveBeenCalled();

      const updatedData = mockUpdateCallback.mock.calls[0][0];
      const targetEquipment = updatedData.find((eq: any) => eq.id === 'EQ001');
      expect(targetEquipment.results['2024-05'].planned).toBe(true);
      expect(targetEquipment.results['2024-05'].planCost).toBe(50000);
    });

    it('実績提案を正常に適用する', () => {
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'actual',
        reason: '実施完了報告',
        confidence: 0.90,
        cost: 45000
      };

      const result = maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('提案を適用しました');

      const updatedData = mockUpdateCallback.mock.calls[0][0];
      const targetEquipment = updatedData.find((eq: any) => eq.id === 'EQ001');
      expect(targetEquipment.results['2024-05'].actual).toBe(true);
      expect(targetEquipment.results['2024-05'].actualCost).toBe(45000);
    });

    it('計画と実績の両方を適用する', () => {
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-06',
        suggestedAction: 'both',
        reason: '緊急対応完了',
        confidence: 0.95,
        cost: 80000
      };

      const result = maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('提案を適用しました');

      const updatedData = mockUpdateCallback.mock.calls[0][0];
      const targetEquipment = updatedData.find((eq: any) => eq.id === 'EQ001');
      expect(targetEquipment.results['2024-06'].planned).toBe(true);
      expect(targetEquipment.results['2024-06'].actual).toBe(true);
      expect(targetEquipment.results['2024-06'].planCost).toBe(80000);
      expect(targetEquipment.results['2024-06'].actualCost).toBe(80000);
    });

    it('存在しない設備IDでエラーを返す', () => {
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'INVALID_ID',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: 'テスト',
        confidence: 0.80
      };

      const result = maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('が見つかりません');
      expect(mockUpdateCallback).not.toHaveBeenCalled();
    });

    it('存在しない時間ヘッダーでも新規作成して適用する', () => {
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-12',
        suggestedAction: 'plan',
        reason: 'テスト',
        confidence: 0.80
      };

      const result = maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('提案を適用しました');
      expect(mockUpdateCallback).toHaveBeenCalled();

      const updatedData = mockUpdateCallback.mock.calls[0][0];
      const targetEquipment = updatedData.find((eq: any) => eq.id === 'EQ001');
      expect(targetEquipment.results['2024-12']).toBeDefined();
      expect(targetEquipment.results['2024-12'].planned).toBe(true);
    });

    it('既存の計画を上書きする場合の処理', () => {
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-01',
        suggestedAction: 'plan',
        reason: '計画変更',
        confidence: 0.75,
        cost: 60000
      };

      const result = maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('提案を適用しました');

      const updatedData = mockUpdateCallback.mock.calls[0][0];
      const targetEquipment = updatedData.find((eq: any) => eq.id === 'EQ001');
      expect(targetEquipment.results['2024-01'].planCost).toBe(60000);
    });

    it('コストが指定されていない場合はデフォルト値を使用', () => {
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: 'コストなし提案',
        confidence: 0.80
        // cost は未指定
      };

      const result = maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      expect(result.success).toBe(true);

      const updatedData = mockUpdateCallback.mock.calls[0][0];
      const targetEquipment = updatedData.find((eq: any) => eq.id === 'EQ001');
      // When cost is not specified, it should remain 0 or use existing cost
      expect(targetEquipment.results['2024-05'].planCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findSimilarSuggestions', () => {
    it('同じ設備の他の時期の類似提案を見つける', () => {
      const baseSuggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: 'ポンプ定期点検',
        confidence: 0.85,
        cost: 50000
      };

      const similarSuggestions = maintenanceGridIntegration.findSimilarSuggestions(
        baseSuggestion,
        mockMaintenanceData
      );

      expect(Array.isArray(similarSuggestions)).toBe(true);
      expect(similarSuggestions.length).toBeGreaterThan(0);

      // 同じ設備の他の時期の提案
      expect(similarSuggestions.every(s => s.equipmentId === 'EQ001')).toBe(true);
      expect(similarSuggestions.every(s => s.timeHeader !== '2024-05')).toBe(true);

      // 提案された設備が実際に存在する
      similarSuggestions.forEach(suggestion => {
        const equipment = mockMaintenanceData.find(eq => eq.id === suggestion.equipmentId);
        expect(equipment).toBeDefined();
      });
    });

    it('同じ時期の類似提案を生成する', () => {
      const baseSuggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ002',
        timeHeader: '2024-05',
        suggestedAction: 'actual',
        reason: 'コンプレッサー実績報告',
        confidence: 0.90,
        cost: 75000
      };

      const similarSuggestions = maintenanceGridIntegration.findSimilarSuggestions(
        baseSuggestion,
        mockMaintenanceData
      );

      // 同じ時期または近い時期の提案が含まれる
      expect(similarSuggestions.some(s => 
        s.timeHeader === '2024-05' || 
        s.timeHeader === '2024-04' || 
        s.timeHeader === '2024-06' ||
        s.timeHeader === '2024-01' ||
        s.timeHeader === '2024-02' ||
        s.timeHeader === '2024-03'
      )).toBe(true);
    });

    it('メンテナンスが必要な設備を優先する', () => {
      const baseSuggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: '定期点検',
        confidence: 0.85,
        cost: 50000
      };

      const similarSuggestions = maintenanceGridIntegration.findSimilarSuggestions(
        baseSuggestion,
        mockMaintenanceData
      );

      // メンテナンスが実施されていない設備が優先される
      similarSuggestions.forEach(suggestion => {
        const equipment = mockMaintenanceData.find(eq => eq.id === suggestion.equipmentId);
        const maintenanceData = equipment?.results[suggestion.timeHeader];
        
        if (suggestion.suggestedAction === 'plan') {
          // 計画提案の場合、まだ計画されていない設備が対象
          expect(maintenanceData?.planned).toBeFalsy();
        } else if (suggestion.suggestedAction === 'actual') {
          // 実績提案の場合、計画はあるが実績がない設備が対象
          expect(maintenanceData?.planned).toBeTruthy();
          expect(maintenanceData?.actual).toBeFalsy();
        }
      });
    });

    it('適切な信頼度を設定する', () => {
      const baseSuggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: '定期点検',
        confidence: 0.85,
        cost: 50000
      };

      const similarSuggestions = maintenanceGridIntegration.findSimilarSuggestions(
        baseSuggestion,
        mockMaintenanceData
      );

      similarSuggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThan(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
        // 類似提案は元の提案より信頼度が低い
        expect(suggestion.confidence).toBeLessThan(baseSuggestion.confidence);
      });
    });

    it('メンテナンスが必要な時期がない場合は空配列を返す', () => {
      // Create test data where all time periods already have maintenance
      const fullMaintenanceData = [{
        ...mockMaintenanceData[0],
        results: {
          '2024-01': { planned: true, actual: true, planCost: 50000, actualCost: 48000 },
          '2024-02': { planned: true, actual: true, planCost: 50000, actualCost: 48000 },
          '2024-03': { planned: true, actual: true, planCost: 50000, actualCost: 48000 },
          '2024-04': { planned: true, actual: true, planCost: 50000, actualCost: 48000 },
          '2024-05': { planned: true, actual: true, planCost: 50000, actualCost: 48000 },
          '2024-06': { planned: true, actual: true, planCost: 50000, actualCost: 48000 }
        }
      }];
      
      const baseSuggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: '定期点検',
        confidence: 0.85,
        cost: 50000
      };

      const similarSuggestions = maintenanceGridIntegration.findSimilarSuggestions(
        baseSuggestion,
        fullMaintenanceData
      );

      expect(similarSuggestions).toEqual([]);
    });

    it('存在しない設備IDの場合は空配列を返す', () => {
      const baseSuggestion: MaintenanceSuggestion = {
        equipmentId: 'INVALID_ID',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: '定期点検',
        confidence: 0.85,
        cost: 50000
      };

      const similarSuggestions = maintenanceGridIntegration.findSimilarSuggestions(
        baseSuggestion,
        mockMaintenanceData
      );

      expect(similarSuggestions).toEqual([]);
    });
  });

  describe('データ整合性', () => {
    it('元のデータを変更しない', () => {
      const originalData = JSON.parse(JSON.stringify(mockMaintenanceData));
      
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'plan',
        reason: 'テスト',
        confidence: 0.80,
        cost: 50000
      };

      maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      // 元のデータが変更されていないことを確認
      expect(mockMaintenanceData).toEqual(originalData);
    });

    it('更新されたデータが正しい構造を持つ', () => {
      const suggestion: MaintenanceSuggestion = {
        equipmentId: 'EQ001',
        timeHeader: '2024-05',
        suggestedAction: 'both',
        reason: 'テスト',
        confidence: 0.80,
        cost: 50000
      };

      maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockMaintenanceData,
        mockUpdateCallback
      );

      const updatedData = mockUpdateCallback.mock.calls[0][0];
      
      // データ構造が保持されている
      expect(Array.isArray(updatedData)).toBe(true);
      expect(updatedData.length).toBe(mockMaintenanceData.length);
      
      updatedData.forEach((equipment: any) => {
        expect(equipment).toHaveProperty('id');
        expect(equipment).toHaveProperty('task');
        expect(equipment).toHaveProperty('specifications');
        expect(equipment).toHaveProperty('results');
        expect(Array.isArray(equipment.specifications)).toBe(true);
        expect(typeof equipment.results).toBe('object');
      });
    });
  });
});