/**
 * MaintenanceCellの集約データ表示テスト
 * 年表示・月表示での集約データが正しく表示されることを確認
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MaintenanceCell } from '../MaintenanceCell';
import type { AggregatedStatus } from '../../../types/maintenanceTask';
import type { HierarchicalData } from '../../../types';
import type { GridColumn } from '../../ExcelLikeGrid/types';

describe('MaintenanceCell - Aggregation Display', () => {
  const mockItem: HierarchicalData = {
    id: 'test-asset-1',
    task: 'Test Asset',
    bomCode: 'A-001',
    specifications: [],
    results: {},
    rolledUpResults: {},
  };

  const mockColumn: GridColumn = {
    id: 'time_2025',
    label: '2025',
    width: 80,
    type: 'status',
    editable: true,
  };

  const mockCallbacks = {
    onCellEdit: jest.fn(),
    onCellClick: jest.fn(),
    onCellDoubleClick: jest.fn(),
  };

  describe('ステータス表示（機器ベースモード）', () => {
    it('集約されたステータスを◎(2)形式で表示する', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: true,
        actual: true,
        totalPlanCost: 2000000,
        totalActualCost: 1900000,
        count: 2,
      };

      render(
        <MaintenanceCell
          item={mockItem}
          column={mockColumn}
          value={aggregatedStatus}
          viewMode="status"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      expect(screen.getByText('◎(2)')).toBeInTheDocument();
    });

    it('作業数が1の場合は数字を省略する', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: true,
        actual: true,
        totalPlanCost: 1000000,
        totalActualCost: 950000,
        count: 1,
      };

      render(
        <MaintenanceCell
          item={mockItem}
          column={mockColumn}
          value={aggregatedStatus}
          viewMode="status"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      expect(screen.getByText('◎')).toBeInTheDocument();
    });

    it('計画のみの集約ステータスを○(3)形式で表示する', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: true,
        actual: false,
        totalPlanCost: 3000000,
        totalActualCost: 0,
        count: 3,
      };

      render(
        <MaintenanceCell
          item={mockItem}
          column={mockColumn}
          value={aggregatedStatus}
          viewMode="status"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      expect(screen.getByText('○(3)')).toBeInTheDocument();
    });

    it('実績のみの集約ステータスを●(2)形式で表示する', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: false,
        actual: true,
        totalPlanCost: 0,
        totalActualCost: 1900000,
        count: 2,
      };

      render(
        <MaintenanceCell
          item={mockItem}
          column={mockColumn}
          value={aggregatedStatus}
          viewMode="status"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      expect(screen.getByText('●(2)')).toBeInTheDocument();
    });

    it('計画も実績もない場合は空文字を表示する', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: false,
        actual: false,
        totalPlanCost: 0,
        totalActualCost: 0,
        count: 0,
      };

      const { container } = render(
        <MaintenanceCell
          item={mockItem}
          column={mockColumn}
          value={aggregatedStatus}
          viewMode="status"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      const cellContent = container.querySelector('.cell-content');
      expect(cellContent?.textContent).toBe('');
    });

    it('10個以上の作業を正しく表示する', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: true,
        actual: true,
        totalPlanCost: 15000000,
        totalActualCost: 14250000,
        count: 15,
      };

      render(
        <MaintenanceCell
          item={mockItem}
          column={mockColumn}
          value={aggregatedStatus}
          viewMode="status"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      expect(screen.getByText('◎(15)')).toBeInTheDocument();
    });
  });

  describe('コスト表示（機器ベースモード）', () => {
    const costColumn: GridColumn = {
      id: 'time_2025',
      label: '2025',
      width: 80,
      type: 'cost',
      editable: true,
    };

    it('集約されたコストを表示する（作業数付き）', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: true,
        actual: true,
        totalPlanCost: 2000000,
        totalActualCost: 1900000,
        count: 2,
      };

      const { container } = render(
        <MaintenanceCell
          item={mockItem}
          column={costColumn}
          value={aggregatedStatus}
          viewMode="cost"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      // 千円単位に変換: 2000000 -> 2,000
      expect(container.textContent).toContain('2,000');
      expect(container.textContent).toContain('1,900');
      expect(container.textContent).toContain('(2)');
    });

    it('作業数が1の場合はコストのみ表示する', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: true,
        actual: true,
        totalPlanCost: 1000000,
        totalActualCost: 950000,
        count: 1,
      };

      const { container } = render(
        <MaintenanceCell
          item={mockItem}
          column={costColumn}
          value={aggregatedStatus}
          viewMode="cost"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      // 千円単位に変換: 1000000 -> 1,000
      expect(container.textContent).toContain('1,000');
      expect(container.textContent).toContain('950');
      // 作業数は表示されない
      expect(container.textContent).not.toContain('(1)');
    });

    it('計画コストのみの場合、実績コストは表示しない', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: true,
        actual: false,
        totalPlanCost: 3000000,
        totalActualCost: 0,
        count: 3,
      };

      const { container } = render(
        <MaintenanceCell
          item={mockItem}
          column={costColumn}
          value={aggregatedStatus}
          viewMode="cost"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      expect(container.textContent).toContain('3,000');
      expect(container.textContent).toContain('(3)');
      // 実績コストは0なので表示されない
      const costActual = container.querySelector('.cost-actual');
      expect(costActual).not.toBeInTheDocument();
    });

    it('実績コストのみの場合、計画コストは表示しない', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: false,
        actual: true,
        totalPlanCost: 0,
        totalActualCost: 1900000,
        count: 2,
      };

      const { container } = render(
        <MaintenanceCell
          item={mockItem}
          column={costColumn}
          value={aggregatedStatus}
          viewMode="cost"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      expect(container.textContent).toContain('1,900');
      expect(container.textContent).toContain('(2)');
      // 計画コストは0なので表示されない
      const costPlan = container.querySelector('.cost-plan');
      expect(costPlan).not.toBeInTheDocument();
    });

    it('コストが0の場合は何も表示しない', () => {
      const aggregatedStatus: AggregatedStatus = {
        planned: false,
        actual: false,
        totalPlanCost: 0,
        totalActualCost: 0,
        count: 0,
      };

      const { container } = render(
        <MaintenanceCell
          item={mockItem}
          column={costColumn}
          value={aggregatedStatus}
          viewMode="cost"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={true}
          {...mockCallbacks}
        />
      );

      const cellContent = container.querySelector('.cell-content');
      expect(cellContent?.textContent).toBe('');
    });
  });

  describe('レガシーモード（非集約）', () => {
    it('レガシー形式のステータスを表示する', () => {
      const legacyStatus = {
        planned: true,
        actual: true,
      };

      render(
        <MaintenanceCell
          item={mockItem}
          column={mockColumn}
          value={legacyStatus}
          viewMode="status"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={false}
          {...mockCallbacks}
        />
      );

      expect(screen.getByText('◎')).toBeInTheDocument();
    });

    it('レガシー形式のコストを表示する', () => {
      const costColumn: GridColumn = {
        id: 'time_2025',
        label: '2025',
        width: 80,
        type: 'cost',
        editable: true,
      };

      const legacyCost = {
        planCost: 1000000,
        actualCost: 950000,
      };

      const { container } = render(
        <MaintenanceCell
          item={mockItem}
          column={costColumn}
          value={legacyCost}
          viewMode="cost"
          isSelected={false}
          isEditing={false}
          readOnly={false}
          width={80}
          isEquipmentBasedMode={false}
          {...mockCallbacks}
        />
      );

      expect(container.textContent).toContain('1,000');
      expect(container.textContent).toContain('950');
      // レガシーモードでは作業数は表示されない
      expect(container.textContent).not.toContain('(');
    });
  });
});
