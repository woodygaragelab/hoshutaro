import { MaintenanceSuggestion } from '../types';
import { HierarchicalData } from '../../../types';

export class MaintenanceGridIntegration {
  /**
   * AI提案を既存の星取表データに適用する
   */
  applySuggestionToGrid(
    suggestion: MaintenanceSuggestion,
    gridData: HierarchicalData[],
    onDataUpdate: (updatedData: HierarchicalData[]) => void
  ): { success: boolean; message: string; updatedItem?: HierarchicalData } {
    try {
      // 対象設備を検索
      const targetEquipment = this.findEquipmentById(gridData, suggestion.equipmentId);
      
      if (!targetEquipment) {
        return {
          success: false,
          message: `設備ID "${suggestion.equipmentId}" が見つかりません。`
        };
      }

      // 時間ヘッダーの検証
      if (!targetEquipment.results[suggestion.timeHeader]) {
        // 新しい時間ヘッダーの場合、初期化
        targetEquipment.results[suggestion.timeHeader] = {
          planned: false,
          actual: false,
          planCost: 0,
          actualCost: 0
        };
      }

      // 提案内容を適用
      const updatedEquipment = this.applySuggestionToEquipment(targetEquipment, suggestion);
      
      // グリッドデータを更新
      const updatedGridData = this.updateGridData(gridData, updatedEquipment);
      
      // 親階層の集計を更新
      this.updateRolledUpResults(updatedGridData);
      
      // データ更新コールバックを実行
      onDataUpdate(updatedGridData);

      return {
        success: true,
        message: `${suggestion.equipmentId} の ${suggestion.timeHeader} に提案を適用しました。`,
        updatedItem: updatedEquipment
      };

    } catch (error) {
      console.error('Suggestion application error:', error);
      return {
        success: false,
        message: `提案の適用中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      };
    }
  }

  /**
   * 複数の提案を一括適用
   */
  applyMultipleSuggestions(
    suggestions: MaintenanceSuggestion[],
    gridData: HierarchicalData[],
    onDataUpdate: (updatedData: HierarchicalData[]) => void,
    onProgress?: (current: number, total: number) => void
  ): { success: boolean; message: string; appliedCount: number; errors: string[] } {
    let appliedCount = 0;
    const errors: string[] = [];
    let currentGridData = [...gridData];

    suggestions.forEach((suggestion, index) => {
      const result = this.applySuggestionToGrid(
        suggestion,
        currentGridData,
        (updatedData) => {
          currentGridData = updatedData;
        }
      );

      if (result.success) {
        appliedCount++;
      } else {
        errors.push(`${suggestion.equipmentId}: ${result.message}`);
      }

      if (onProgress) {
        onProgress(index + 1, suggestions.length);
      }
    });

    // 最終的なデータ更新
    onDataUpdate(currentGridData);

    return {
      success: appliedCount > 0,
      message: `${appliedCount}/${suggestions.length} 件の提案を適用しました。`,
      appliedCount,
      errors
    };
  }

  /**
   * 設備IDで設備を検索
   */
  private findEquipmentById(data: HierarchicalData[], equipmentId: string): HierarchicalData | null {
    for (const item of data) {
      // 直接一致
      if (item.id === equipmentId || item.bomCode === equipmentId) {
        return item;
      }

      // 子要素を再帰的に検索
      if (item.children && item.children.length > 0) {
        const found = this.findEquipmentById(item.children, equipmentId);
        if (found) return found;
      }

      // タスク名での部分一致検索
      if (item.task.includes(equipmentId)) {
        return item;
      }
    }

    return null;
  }

  /**
   * 提案を設備データに適用
   */
  private applySuggestionToEquipment(
    equipment: HierarchicalData,
    suggestion: MaintenanceSuggestion
  ): HierarchicalData {
    const updatedEquipment = { ...equipment };
    const timeKey = suggestion.timeHeader;
    
    // 既存の結果データを取得または初期化
    const currentResult = updatedEquipment.results[timeKey] || {
      planned: false,
      actual: false,
      planCost: 0,
      actualCost: 0
    };

    // 提案内容に基づいて更新
    switch (suggestion.suggestedAction) {
      case 'plan':
        currentResult.planned = true;
        if (suggestion.cost) {
          currentResult.planCost = suggestion.cost;
        }
        break;
      
      case 'actual':
        currentResult.actual = true;
        if (suggestion.cost) {
          currentResult.actualCost = suggestion.cost;
        }
        break;
      
      case 'both':
        currentResult.planned = true;
        currentResult.actual = true;
        if (suggestion.cost) {
          currentResult.planCost = suggestion.cost;
          currentResult.actualCost = suggestion.cost;
        }
        break;
    }

    updatedEquipment.results[timeKey] = currentResult;

    // メタデータを追加（AI提案の履歴）
    if (!updatedEquipment.specifications.find(spec => spec.key === 'AI提案履歴')) {
      updatedEquipment.specifications.push({
        key: 'AI提案履歴',
        value: `${new Date().toLocaleDateString()}: ${suggestion.reason}`,
        order: 999
      });
    }

    return updatedEquipment;
  }

  /**
   * グリッドデータ内の特定設備を更新
   */
  private updateGridData(
    gridData: HierarchicalData[],
    updatedEquipment: HierarchicalData
  ): HierarchicalData[] {
    return gridData.map(item => {
      if (item.id === updatedEquipment.id) {
        return updatedEquipment;
      }

      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: this.updateGridData(item.children, updatedEquipment)
        };
      }

      return item;
    });
  }

  /**
   * 親階層の集計結果を更新
   */
  private updateRolledUpResults(data: HierarchicalData[]): void {
    data.forEach(item => {
      if (item.children && item.children.length > 0) {
        // 子要素の集計を先に更新
        this.updateRolledUpResults(item.children);

        // 子要素の結果を集計
        const rolledUpResults: { [timeKey: string]: { planned: boolean; actual: boolean; planCost: number; actualCost: number; } } = {};

        // 全ての時間キーを収集
        const allTimeKeys = new Set<string>();
        item.children.forEach(child => {
          Object.keys(child.results || {}).forEach(key => allTimeKeys.add(key));
          Object.keys(child.rolledUpResults || {}).forEach(key => allTimeKeys.add(key));
        });

        // 各時間キーについて集計
        allTimeKeys.forEach(timeKey => {
          let hasPlanned = false;
          let hasActual = false;
          let totalPlanCost = 0;
          let totalActualCost = 0;

          item.children.forEach(child => {
            const childResult = child.results?.[timeKey] || child.rolledUpResults?.[timeKey];
            if (childResult) {
              if (childResult.planned) hasPlanned = true;
              if (childResult.actual) hasActual = true;
              totalPlanCost += childResult.planCost || 0;
              totalActualCost += childResult.actualCost || 0;
            }
          });

          rolledUpResults[timeKey] = {
            planned: hasPlanned,
            actual: hasActual,
            planCost: totalPlanCost,
            actualCost: totalActualCost
          };
        });

        item.rolledUpResults = rolledUpResults;
      }
    });
  }

  /**
   * AI提案の妥当性を検証
   */
  validateSuggestion(
    suggestion: MaintenanceSuggestion,
    gridData: HierarchicalData[]
  ): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let isValid = true;

    // 設備の存在確認
    const equipment = this.findEquipmentById(gridData, suggestion.equipmentId);
    if (!equipment) {
      warnings.push(`設備ID "${suggestion.equipmentId}" が見つかりません`);
      isValid = false;
    }

    // 信頼度の確認
    if (suggestion.confidence < 0.5) {
      warnings.push(`提案の信頼度が低いです (${Math.round(suggestion.confidence * 100)}%)`);
    }

    // コストの妥当性確認
    if (suggestion.cost && suggestion.cost < 0) {
      warnings.push('コストが負の値です');
      isValid = false;
    }

    // 時間ヘッダーの形式確認
    if (!/^\d{4}-\d{2}$/.test(suggestion.timeHeader)) {
      warnings.push(`時間ヘッダーの形式が正しくありません: ${suggestion.timeHeader}`);
    }

    return { isValid, warnings };
  }

  /**
   * 既存データから類似の提案を検索
   */
  findSimilarSuggestions(
    suggestion: MaintenanceSuggestion,
    gridData: HierarchicalData[]
  ): MaintenanceSuggestion[] {
    const similarSuggestions: MaintenanceSuggestion[] = [];
    
    // 同じ設備の他の時期の提案を生成
    const equipment = this.findEquipmentById(gridData, suggestion.equipmentId);
    if (equipment) {
      Object.keys(equipment.results).forEach(timeKey => {
        if (timeKey !== suggestion.timeHeader) {
          const result = equipment.results[timeKey];
          if (!result.planned && !result.actual) {
            similarSuggestions.push({
              equipmentId: suggestion.equipmentId,
              timeHeader: timeKey,
              suggestedAction: suggestion.suggestedAction,
              reason: `類似パターンによる提案: ${suggestion.reason}`,
              confidence: suggestion.confidence * 0.8,
              cost: suggestion.cost
            });
          }
        }
      });
    }

    return similarSuggestions;
  }
}

export const maintenanceGridIntegration = new MaintenanceGridIntegration();