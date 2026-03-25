/**
 * WorkOrderLineManager - WorkOrderLine（星取表セルデータ）のライフサイクルを管理
 *
 * WorkOrderLineは1 Task × 1 Asset × Scheduleの組み合わせを表し、
 * 星取表（Star Chart）のセルレベルデータを管理します。
 *
 * Requirements: WOL CRUD, schedule updates, bulk operations, queries
 */

import { WorkOrderLine } from '../types/maintenanceTask';
import { UndoRedoManager } from './UndoRedoManager';

export class WorkOrderLineManager {
    private lines: Map<string, WorkOrderLine>;
    private nextId: number;
    private undoRedoManager?: UndoRedoManager;

    constructor(undoRedoManager?: UndoRedoManager) {
        this.lines = new Map();
        this.nextId = 1;
        this.undoRedoManager = undoRedoManager;
    }

    /**
     * Set the UndoRedoManager instance
     */
    setUndoRedoManager(undoRedoManager: UndoRedoManager): void {
        this.undoRedoManager = undoRedoManager;
    }

    /**
     * IDから数値部分を抽出
     */
    private extractIdNumber(id: string): number {
        const match = id.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
    }

    /**
     * 一意のIDを生成
     */
    private generateId(): string {
        const id = `wol-${String(this.nextId).padStart(3, '0')}`;
        this.nextId++;
        return id;
    }

    /**
     * バリデーション
     */
    private validateLineData(data: {
        WorkOrderId?: string;
        name?: string;
        AssetId?: string;
        PlanScheduleStart?: Date;
    }): void {
        if (data.WorkOrderId !== undefined && data.WorkOrderId.trim() === '') {
            throw new Error('WorkOrder IDは必須です。');
        }
        if (data.name !== undefined && data.name.trim() === '') {
            throw new Error('作業名(name)は必須です。');
        }
        if (data.AssetId !== undefined && data.AssetId.trim() === '') {
            throw new Error('機器IDは必須です。');
        }
    }

    /**
     * WorkOrderLineを作成
     */
    createLine(
        data: Omit<WorkOrderLine, 'id' | 'CreatedAt' | 'UpdatedAt'> & { id?: string }
    ): WorkOrderLine {
        this.validateLineData(data);

        const now = new Date();
        const id = data.id || this.generateId();

        if (data.id) {
            const idNum = this.extractIdNumber(data.id);
            if (idNum >= this.nextId) {
                this.nextId = idNum + 1;
            }
        }

        // Duplicate check
        if (this.lines.has(id)) {
            throw new Error(`WorkOrderLine ID ${id} は既に存在します。`);
        }

        const line: WorkOrderLine = {
            ...data,
            id,
            CreatedAt: now,
            UpdatedAt: now,
        };

        this.lines.set(id, line);

        if (this.undoRedoManager) {
            this.undoRedoManager.pushState('CREATE_WORK_ORDER_LINE', {
                line: { ...line },
            });
        }

        return line;
    }

    /**
     * WorkOrderLineを更新
     */
    updateLine(
        id: string,
        updates: Partial<Omit<WorkOrderLine, 'id' | 'CreatedAt'>>
    ): WorkOrderLine {
        const existing = this.lines.get(id);
        if (!existing) {
            throw new Error(`WorkOrderLineが見つかりません: ${id}`);
        }

        // Validate updated data if critical fields change
        if (
            updates.WorkOrderId !== undefined ||
            updates.name !== undefined ||
            updates.AssetId !== undefined
        ) {
            const toValidate = {
                WorkOrderId: updates.WorkOrderId ?? existing.WorkOrderId,
                name: updates.name ?? existing.name,
                AssetId: updates.AssetId ?? existing.AssetId,
            };
            this.validateLineData(toValidate);
        }

        const updated: WorkOrderLine = {
            ...existing,
            ...updates,
            id: existing.id,
            CreatedAt: existing.CreatedAt,
            UpdatedAt: new Date(),
        };

        this.lines.set(id, updated);

        if (this.undoRedoManager) {
            this.undoRedoManager.pushState('UPDATE_WORK_ORDER_LINE', {
                previousLine: { ...existing },
                updatedLine: { ...updated },
            });
        }

        return updated;
    }

    /**
     * WorkOrderLineを削除
     */
    deleteLine(id: string): void {
        const line = this.lines.get(id);
        if (!line) {
            throw new Error(`WorkOrderLineが見つかりません: ${id}`);
        }

        if (this.undoRedoManager) {
            this.undoRedoManager.pushState('DELETE_WORK_ORDER_LINE', {
                line: { ...line },
            });
        }

        this.lines.delete(id);
    }

    /**
     * WorkOrderLineを取得
     */
    getLine(id: string): WorkOrderLine | null {
        return this.lines.get(id) || null;
    }

    /**
     * 機器IDで検索
     */
    getLinesByAsset(assetId: string): WorkOrderLine[] {
        return Array.from(this.lines.values()).filter(
            (line) => line.AssetId === assetId
        );
    }

    /**
     * 作業名で検索
     */
    getLinesByName(name: string): WorkOrderLine[] {
        return Array.from(this.lines.values()).filter(
            (line) => line.name === name
        );
    }

    /**
     * WorkOrder IDで検索
     */
    getLinesByWorkOrder(workOrderId: string): WorkOrderLine[] {
        return Array.from(this.lines.values()).filter(
            (line) => line.WorkOrderId === workOrderId
        );
    }

    /**
     * 機器ID + 作業名で検索
     */
    getLineByAssetAndName(assetId: string, name: string): WorkOrderLine | null {
        for (const line of this.lines.values()) {
            if (line.AssetId === assetId && line.name === name) {
                return line;
            }
        }
        return null;
    }

    /**
     * 機器ID + WorkOrder IDで検索
     */
    getLinesByAssetAndWorkOrder(
        assetId: string,
        workOrderId: string
    ): WorkOrderLine[] {
        return Array.from(this.lines.values()).filter(
            (line) => line.AssetId === assetId && line.WorkOrderId === workOrderId
        );
    }

    /**
     * 計画工数・実績工数を一括更新
     */
    updateManhours(id: string, plannedManhours?: number, actualManhours?: number): void {
        const line = this.lines.get(id);
        if (!line) {
            throw new Error(`WorkOrderLineが見つかりません: ${id}`);
        }

        const updates: Partial<WorkOrderLine> = {};
        if (plannedManhours !== undefined) updates.PlannedManhours = plannedManhours;
        if (actualManhours !== undefined) updates.ActualManhours = actualManhours;

        this.updateLine(id, updates);
    }

    /**
     * 全WorkOrderLineを取得
     */
    getAllLines(): WorkOrderLine[] {
        return Array.from(this.lines.values());
    }

    /**
     * 全WorkOrderLineを取得（エイリアス）
     */
    getAllWorkOrderLines(): WorkOrderLine[] {
        return this.getAllLines();
    }

    /**
     * 機器IDで検索（エイリアス — App.tsx互換）
     */
    getWorkOrderLinesByAsset(assetId: string): WorkOrderLine[] {
        return this.getLinesByAsset(assetId);
    }

    /**
     * WorkOrderLineを作成（エイリアス — App.tsx互換）
     */
    createWorkOrderLine(
        data: Omit<WorkOrderLine, 'id' | 'CreatedAt' | 'UpdatedAt'> & { id?: string }
    ): WorkOrderLine {
        return this.createLine(data);
    }

    /**
     * WorkOrderLineを更新（エイリアス — App.tsx互換）
     */
    updateWorkOrderLine(
        id: string,
        updates: Partial<Omit<WorkOrderLine, 'id' | 'CreatedAt'>>
    ): WorkOrderLine {
        return this.updateLine(id, updates);
    }

    /**
     * WorkOrderLineを削除（エイリアス — App.tsx互換）
     */
    deleteWorkOrderLine(id: string): void {
        return this.deleteLine(id);
    }

    /**
     * WorkOrderLineを取得（エイリアス — App.tsx互換）
     */
    getWorkOrderLine(id: string): WorkOrderLine | null {
        return this.getLine(id);
    }

    /**
     * 存在チェック
     */
    hasLine(id: string): boolean {
        return this.lines.has(id);
    }

    /**
     * 機器と作業名の組合せが存在するかチェック
     */
    hasLineForAssetAndName(assetId: string, name: string): boolean {
        for (const line of this.lines.values()) {
            if (line.AssetId === assetId && line.name === name) {
                return true;
            }
        }
        return false;
    }

    /**
     * 件数を取得
     */
    getCount(): number {
        return this.lines.size;
    }

    /**
     * すべてクリア（テスト用）
     */
    clear(): void {
        this.lines.clear();
        this.nextId = 1;
    }

    /**
     * データから一括読み込み
     */
    loadLines(lines: WorkOrderLine[]): void {
        this.lines.clear();
        for (const line of lines) {
            this.lines.set(line.id, line);
            const idNum = this.extractIdNumber(line.id);
            if (idNum >= this.nextId) {
                this.nextId = idNum + 1;
            }
        }
    }

    /**
     * WorkOrderに関連する全WorkOrderLineを削除（cascade delete用）
     */
    deleteByWorkOrder(workOrderId: string): number {
        const toDelete = this.getLinesByWorkOrder(workOrderId);
        for (const line of toDelete) {
            this.deleteLine(line.id);
        }
        return toDelete.length;
    }

    /**
     * 作業名に関連する全WorkOrderLineを削除
     */
    deleteByName(name: string): number {
        const toDelete = this.getLinesByName(name);
        for (const line of toDelete) {
            this.deleteLine(line.id);
        }
        return toDelete.length;
    }

    /**
     * 機器に関連する全WorkOrderLineを削除
     */
    deleteByAsset(assetId: string): number {
        const toDelete = this.getLinesByAsset(assetId);
        for (const line of toDelete) {
            this.deleteLine(line.id);
        }
        return toDelete.length;
    }
}

export default WorkOrderLineManager;
