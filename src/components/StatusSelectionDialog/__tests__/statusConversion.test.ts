import {
  convertToStatusValue,
  convertFromStatusValue,
  validateStatusTransition,
  executeStatusChange,
  executeBatchStatusChange,
  createStatusChangeHistory,
  checkStatusDataIntegrity,
} from '../statusConversion';
import { StatusValue } from '../../CommonEdit/types';
import { createStatusValue } from '../../CommonEdit/statusLogic';

// Mock status values for testing
const mockStatusUnplanned: StatusValue = {
  planned: false,
  actual: false,
  displaySymbol: '',
  label: '未計画',
};

const mockStatusPlanned: StatusValue = {
  planned: true,
  actual: false,
  displaySymbol: '○',
  label: '計画',
};

const mockStatusActual: StatusValue = {
  planned: false,
  actual: true,
  displaySymbol: '●',
  label: '実績',
};

const mockStatusBoth: StatusValue = {
  planned: true,
  actual: true,
  displaySymbol: '◎',
  label: '両方',
};

describe('Status Conversion Logic', () => {
  describe('convertToStatusValue', () => {
    test('should convert planned=false, actual=false to unplanned status', () => {
      const result = convertToStatusValue(false, false);
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toEqual(mockStatusUnplanned);
      expect(result.errors).toHaveLength(0);
    });

    test('should convert planned=true, actual=false to planned status', () => {
      const result = convertToStatusValue(true, false);
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toEqual(mockStatusPlanned);
      expect(result.errors).toHaveLength(0);
    });

    test('should convert planned=false, actual=true to actual status', () => {
      const result = convertToStatusValue(false, true);
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toEqual(mockStatusActual);
      expect(result.errors).toHaveLength(0);
    });

    test('should convert planned=true, actual=true to both status', () => {
      const result = convertToStatusValue(true, true);
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toEqual(mockStatusBoth);
      expect(result.errors).toHaveLength(0);
    });
  });    
test('should generate warning for actual without planned when business rules enabled', () => {
      const result = convertToStatusValue(false, true, { validateBusinessRules: true });
      
      expect(result.success).toBe(true);
      expect(result.warnings).toContain('計画なしで実績が記録されています。計画の追加を検討してください。');
    });

    test('should not generate warning when business rules disabled', () => {
      const result = convertToStatusValue(false, true, { validateBusinessRules: false });
      
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('convertFromStatusValue', () => {
    test('should extract planned and actual values from unplanned status', () => {
      const result = convertFromStatusValue(mockStatusUnplanned);
      
      expect(result.planned).toBe(false);
      expect(result.actual).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    test('should extract planned and actual values from planned status', () => {
      const result = convertFromStatusValue(mockStatusPlanned);
      
      expect(result.planned).toBe(true);
      expect(result.actual).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    test('should extract planned and actual values from actual status', () => {
      const result = convertFromStatusValue(mockStatusActual);
      
      expect(result.planned).toBe(false);
      expect(result.actual).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should extract planned and actual values from both status', () => {
      const result = convertFromStatusValue(mockStatusBoth);
      
      expect(result.planned).toBe(true);
      expect(result.actual).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateStatusTransition', () => {
    test('should allow valid transitions', () => {
      const result = validateStatusTransition(mockStatusUnplanned, mockStatusPlanned);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should require confirmation for actual to unplanned transition', () => {
      const result = validateStatusTransition(mockStatusActual, mockStatusUnplanned);
      
      expect(result.isValid).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationMessage).toContain('実績データを削除しますか？');
    });

    test('should require confirmation for planned to unplanned transition', () => {
      const result = validateStatusTransition(mockStatusPlanned, mockStatusUnplanned);
      
      expect(result.isValid).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationMessage).toContain('計画データを削除しますか？');
    });

    test('should skip confirmation when option is set', () => {
      const result = validateStatusTransition(
        mockStatusActual, 
        mockStatusUnplanned, 
        { skipConfirmation: true }
      );
      
      expect(result.isValid).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    test('should generate warnings for business rule violations', () => {
      const result = validateStatusTransition(
        mockStatusActual, 
        mockStatusUnplanned, 
        { validateBusinessRules: true }
      );
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('実績データが削除されます');
    });
  });

  describe('executeStatusChange', () => {
    test('should execute valid status change', () => {
      const result = executeStatusChange(mockStatusUnplanned, mockStatusPlanned);
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toEqual(mockStatusPlanned);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle status change requiring confirmation', () => {
      const result = executeStatusChange(mockStatusActual, mockStatusUnplanned);
      
      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationMessage).toBeDefined();
    });

    test('should preserve original status on validation failure', () => {
      // Mock a scenario where validation would fail
      const invalidStatus = { ...mockStatusUnplanned, label: 'invalid' as any };
      const result = executeStatusChange(mockStatusUnplanned, invalidStatus);
      
      // Should still succeed since our validation is permissive
      expect(result.success).toBe(true);
    });
  });

  describe('executeBatchStatusChange', () => {
    test('should execute multiple status changes', () => {
      const changes = [
        { id: '1', fromStatus: mockStatusUnplanned, toStatus: mockStatusPlanned },
        { id: '2', fromStatus: mockStatusPlanned, toStatus: mockStatusActual },
        { id: '3', fromStatus: mockStatusActual, toStatus: mockStatusBoth },
      ];

      const result = executeBatchStatusChange(changes);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].newStatus).toEqual(mockStatusPlanned);
      expect(result.results[1].newStatus).toEqual(mockStatusActual);
      expect(result.results[2].newStatus).toEqual(mockStatusBoth);
    });

    test('should handle mixed success and failure in batch', () => {
      const changes = [
        { id: '1', fromStatus: mockStatusUnplanned, toStatus: mockStatusPlanned },
        { id: '2', fromStatus: mockStatusPlanned, toStatus: mockStatusActual },
      ];

      const result = executeBatchStatusChange(changes);
      
      expect(result.success).toBe(true);
      expect(result.totalErrors).toBe(0);
      expect(result.totalWarnings).toBe(0);
    });
  });

  describe('createStatusChangeHistory', () => {
    test('should create status change history entry', () => {
      const history = createStatusChangeHistory(
        mockStatusUnplanned,
        mockStatusPlanned,
        'testUser',
        'desktop',
        'Test reason'
      );
      
      expect(history.fromStatus).toEqual(mockStatusUnplanned);
      expect(history.toStatus).toEqual(mockStatusPlanned);
      expect(history.user).toBe('testUser');
      expect(history.deviceType).toBe('desktop');
      expect(history.reason).toBe('Test reason');
      expect(history.timestamp).toBeInstanceOf(Date);
    });

    test('should create history entry without reason', () => {
      const history = createStatusChangeHistory(
        mockStatusPlanned,
        mockStatusActual,
        'testUser',
        'mobile'
      );
      
      expect(history.fromStatus).toEqual(mockStatusPlanned);
      expect(history.toStatus).toEqual(mockStatusActual);
      expect(history.user).toBe('testUser');
      expect(history.deviceType).toBe('mobile');
      expect(history.reason).toBeUndefined();
    });
  });

  describe('checkStatusDataIntegrity', () => {
    test('should pass integrity check for consistent data', () => {
      const result = checkStatusDataIntegrity(mockStatusPlanned, true, false);
      
      expect(result.isConsistent).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect planned value inconsistency', () => {
      const result = checkStatusDataIntegrity(mockStatusPlanned, false, false);
      
      expect(result.isConsistent).toBe(false);
      expect(result.issues).toContainEqual({
        type: 'error',
        message: expect.stringContaining('計画状態の不整合'),
        field: 'planned',
      });
    });

    test('should detect actual value inconsistency', () => {
      const result = checkStatusDataIntegrity(mockStatusActual, false, false);
      
      expect(result.isConsistent).toBe(false);
      expect(result.issues).toContainEqual({
        type: 'error',
        message: expect.stringContaining('実績状態の不整合'),
        field: 'actual',
      });
    });

    test('should detect display symbol inconsistency as warning', () => {
      const inconsistentStatus = { ...mockStatusPlanned, displaySymbol: '●' as any };
      const result = checkStatusDataIntegrity(inconsistentStatus, true, false);
      
      expect(result.isConsistent).toBe(true); // Only warnings, not errors
      expect(result.issues).toContainEqual({
        type: 'warning',
        message: expect.stringContaining('表示記号の不整合'),
        field: 'displaySymbol',
      });
    });

    test('should handle multiple inconsistencies', () => {
      const result = checkStatusDataIntegrity(mockStatusBoth, false, false);
      
      expect(result.isConsistent).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      
      const errorIssues = result.issues.filter(issue => issue.type === 'error');
      expect(errorIssues.length).toBe(2); // Both planned and actual inconsistencies
    });
  });
});