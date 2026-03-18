/**
 * WorkOrderLineManager - WorkOrderLine（星取表セルデータ）のライフサイクルを管理
 *
 * WorkOrderLineは1 Task × 1 Asset × Scheduleの組み合わせを表し、
 * 星取表（Star Chart）のセルレベルデータを管理します。
 *
 * Requirements: WOL CRUD, schedule updates, bulk operations, queries
 */

import { WorkOrderLine, WorkOrderSchedule } from '../types/maintenanceTask';
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
        workOrderId: string;
        taskId: string;
        assetId: string;
        schedule?: WorkOrderSchedule;
    }): void {
        if (!data.workOrderId || data.workOrderId.trim() === '') {
            throw new Error('WorkOrder IDは必須です。');
        }
        if (!data.taskId || data.taskId.trim() === '') {
            throw new Error('作業IDは必須です。');
        }
        if (!data.assetId || data.assetId.trim() === '') {
            throw new Error('機器IDは必須です。');
        }
        if (data.schedule) {
            this.validateSchedule(data.schedule);
        }
    }

    /**
     * スケジュールのバリデーション
     */
    private validateSchedule(schedule: WorkOrderSchedule): void {
        for (const [dateKey, entry] of Object.entries(schedule)) {
            if (!dateKey || dateKey.trim() === '') {
                throw new Error('日付キーは空にできません。');
            }
            if (!entry || typeof entry !== 'object') {
                throw new Error(`スケジュールエントリ ${dateKey} が無効です。`);
            }
            if (typeof entry.planned !== 'boolean') {
                throw new Error(`スケジュールエントリ ${dateKey} のplannedはbooleanである必要があります。`);
            }
            if (typeof entry.actual !== 'boolean') {
                throw new Error(`スケジュールエントリ ${dateKey} のactualはbooleanである必要があります。`);
            }
            if (typeof entry.planCost !== 'number' || entry.planCost < 0) {
                throw new Error(`スケジュールエントリ ${dateKey} のplanCostが無効です。`);
            }
            if (typeof entry.actualCost !== 'number' || entry.actualCost < 0) {
                throw new Error(`スケジュールエントリ ${dateKey} のactualCostが無効です。`);
            }
        }
    }

    /**
     * WorkOrderLineを作成
     */
    createLine(
        data: Omit<WorkOrderLine, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
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
            id,
            workOrderId: data.workOrderId,
            taskId: data.taskId,
            assetId: data.assetId,
            schedule: data.schedule || {},
            manhours: data.manhours,
            createdAt: now,
            updatedAt: now,
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
        updates: Partial<Omit<WorkOrderLine, 'id' | 'createdAt'>>
    ): WorkOrderLine {
        const existing = this.lines.get(id);
        if (!existing) {
            throw new Error(`WorkOrderLineが見つかりません: ${id}`);
        }

        // Validate updated data if critical fields change
        if (
            updates.workOrderId !== undefined ||
            updates.taskId !== undefined ||
            updates.assetId !== undefined
        ) {
            const toValidate = {
                workOrderId: updates.workOrderId ?? existing.workOrderId,
                taskId: updates.taskId ?? existing.taskId,
                assetId: updates.assetId ?? existing.assetId,
            };
            this.validateLineData(toValidate);
        }

        if (updates.schedule) {
            this.validateSchedule(updates.schedule);
        }

        const updated: WorkOrderLine = {
            ...existing,
            ...updates,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: new Date(),
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
            (line) => line.assetId === assetId
        );
    }

    /**
     * 作業IDで検索
     */
    getLinesByTask(taskId: string): WorkOrderLine[] {
        return Array.from(this.lines.values()).filter(
            (line) => line.taskId === taskId
        );
    }

    /**
     * WorkOrder IDで検索
     */
    getLinesByWorkOrder(workOrderId: string): WorkOrderLine[] {
        return Array.from(this.lines.values()).filter(
            (line) => line.workOrderId === workOrderId
        );
    }

    /**
     * 機器ID + 作業IDで検索
     */
    getLineByAssetAndTask(assetId: string, taskId: string): WorkOrderLine | null {
        for (const line of this.lines.values()) {
            if (line.assetId === assetId && line.taskId === taskId) {
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
            (line) => line.assetId === assetId && line.workOrderId === workOrderId
        );
    }

    /**
     * 特定日付のスケジュールを更新
     */
    updateSchedule(
        id: string,
        dateKey: string,
        scheduleEntry: WorkOrderSchedule[string]
    ): void {
        const line = this.lines.get(id);
        if (!line) {
            throw new Error(`WorkOrderLineが見つかりません: ${id}`);
        }

        // Validate schedule entry
        if (typeof scheduleEntry.planned !== 'boolean') {
            throw new Error('plannedフラグはbooleanである必要があります。');
        }
        if (typeof scheduleEntry.actual !== 'boolean') {
            throw new Error('actualフラグはbooleanである必要があります。');
        }
        if (typeof scheduleEntry.planCost !== 'number' || scheduleEntry.planCost < 0) {
            throw new Error('planCostは0以上の数値である必要があります。');
        }
        if (typeof scheduleEntry.actualCost !== 'number' || scheduleEntry.actualCost < 0) {
            throw new Error('actualCostは0以上の数値である必要があります。');
        }

        // Save previous state for undo
        if (this.undoRedoManager) {
            this.undoRedoManager.pushState('UPDATE_WORK_ORDER_LINE', {
                previousLine: { ...line, schedule: { ...line.schedule } },
                updatedLine: null, // will be set after update
            });
        }

        // Update schedule
        line.schedule = {
            ...line.schedule,
            [dateKey]: { ...scheduleEntry },
        };
        line.updatedAt = new Date();
    }

    /**
     * 同じ作業を持つすべてのWorkOrderLineのスケジュールを更新
     * （作業ベースモード用 — linked updates）
     */
    updateScheduleForAllLines(
        taskId: string,
        dateKey: string,
        scheduleEntry: WorkOrderSchedule[string]
    ): number {
        const lines = this.getLinesByTask(taskId);
        let updatedCount = 0;

        for (const line of lines) {
            this.updateSchedule(line.id, dateKey, scheduleEntry);
            updatedCount++;
        }

        return updatedCount;
    }

    /**
     * 一括スケジュール更新
     */
    bulkUpdateSchedule(
        lineIds: string[],
        dateKey: string,
        scheduleEntry: WorkOrderSchedule[string]
    ): number {
        let updated = 0;
        for (const id of lineIds) {
            try {
                this.updateSchedule(id, dateKey, scheduleEntry);
                updated++;
            } catch {
                console.warn(`WorkOrderLine ${id} のスケジュール更新に失敗しました。`);
            }
        }
        return updated;
    }

    /**
     * 工数を更新
     */
    updateManhours(id: string, manhours: number): void {
        const line = this.lines.get(id);
        if (!line) {
            throw new Error(`WorkOrderLineが見つかりません: ${id}`);
        }
        if (manhours < 0) {
            throw new Error('工数は0以上である必要があります。');
        }

        if (this.undoRedoManager) {
            this.undoRedoManager.pushState('UPDATE_WORK_ORDER_LINE', {
                previousLine: { ...line },
                updatedLine: { ...line, manhours },
            });
        }

        line.manhours = manhours;
        line.updatedAt = new Date();
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
        data: Omit<WorkOrderLine, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): WorkOrderLine {
        return this.createLine(data);
    }

    /**
     * WorkOrderLineを更新（エイリアス — App.tsx互換）
     */
    updateWorkOrderLine(
        id: string,
        updates: Partial<Omit<WorkOrderLine, 'id' | 'createdAt'>>
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
     * 機器と作業の組合せが存在するかチェック
     */
    hasLineForAssetAndTask(assetId: string, taskId: string): boolean {
        for (const line of this.lines.values()) {
            if (line.assetId === assetId && line.taskId === taskId) {
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
     * 作業に関連する全WorkOrderLineを削除
     */
    deleteByTask(taskId: string): number {
        const toDelete = this.getLinesByTask(taskId);
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
