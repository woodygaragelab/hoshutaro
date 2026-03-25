/**
 * WorkOrderManager - WorkOrder（作業指示）のライフサイクルを管理
 *
 * WorkOrderは発注/管理単位であり、複数のTask × Assetを
 * 1つのパッケージとしてグルーピングします。
 *
 * Requirements: WO CRUD, cascade delete of WorkOrderLines
 */

import { WorkOrder } from '../types/maintenanceTask';
import { UndoRedoManager } from './UndoRedoManager';

export class WorkOrderManager {
    private workOrders: Map<string, WorkOrder>;
    private nextId: number;
    private undoRedoManager?: UndoRedoManager;

    constructor(undoRedoManager?: UndoRedoManager) {
        this.workOrders = new Map();
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
        const id = `wo-${String(this.nextId).padStart(3, '0')}`;
        this.nextId++;
        return id;
    }

    /**
     * バリデーション
     */
    private validateWorkOrderData(data: {
        name: string;
        ClassificationId: string;
    }): void {
        if (!data.name || data.name.trim() === '') {
            throw new Error('WorkOrder名は必須です。');
        }
        if (!data.ClassificationId || data.ClassificationId.trim() === '') {
            throw new Error('作業分類IDは必須です。');
        }
        // 分類IDは01-20の範囲
        const classNum = parseInt(data.ClassificationId, 10);
        if (isNaN(classNum) || classNum < 1 || classNum > 20) {
            throw new Error(
                `無効な作業分類IDです: ${data.ClassificationId}。01から20の範囲で指定してください。`
            );
        }
        if (!/^\d{2}$/.test(data.ClassificationId)) {
            throw new Error(
                `作業分類IDは2桁の形式で指定してください（例: 01）。入力値: ${data.ClassificationId}`
            );
        }
    }

    /**
     * WorkOrderを作成
     */
    createWorkOrder(
        data: Omit<WorkOrder, 'id' | 'CreatedAt' | 'UpdatedAt'> & { id?: string }
    ): WorkOrder {
        this.validateWorkOrderData(data as any); // validate

        const now = new Date();
        const id = data.id || this.generateId();

        if (data.id) {
            const idNum = this.extractIdNumber(data.id);
            if (idNum >= this.nextId) {
                this.nextId = idNum + 1;
            }
        }

        // Duplicate check
        if (this.workOrders.has(id)) {
            throw new Error(`WorkOrder ID ${id} は既に存在します。`);
        }

        const workOrder: WorkOrder = {
            id,
            name: data.name.trim(),
            ClassificationId: data.ClassificationId,
            CreatedAt: now,
            UpdatedAt: now,
        };

        this.workOrders.set(id, workOrder);

        if (this.undoRedoManager) {
            this.undoRedoManager.pushState('CREATE_WORK_ORDER', {
                workOrder: { ...workOrder },
            });
        }

        return workOrder;
    }

    /**
     * WorkOrderを更新
     */
    updateWorkOrder(
        id: string,
        updates: Partial<Omit<WorkOrder, 'id' | 'CreatedAt'>>
    ): WorkOrder {
        const existing = this.workOrders.get(id);
        if (!existing) {
            throw new Error(`WorkOrderが見つかりません: ${id}`);
        }

        if (updates.name !== undefined || updates.ClassificationId !== undefined) {
            const toValidate = {
                name: updates.name ?? existing.name,
                ClassificationId:
                    updates.ClassificationId ?? existing.ClassificationId,
            };
            this.validateWorkOrderData(toValidate);
        }

        const updated: WorkOrder = {
            ...existing,
            ...updates,
            id: existing.id,
            CreatedAt: existing.CreatedAt,
            UpdatedAt: new Date(),
        };

        this.workOrders.set(id, updated);

        if (this.undoRedoManager) {
            this.undoRedoManager.pushState('UPDATE_WORK_ORDER', {
                previousWorkOrder: { ...existing },
                updatedWorkOrder: { ...updated },
            });
        }

        return updated;
    }

    /**
     * WorkOrderを削除
     * 注: 関連WorkOrderLineの削除はWorkOrderLineManagerが担当
     * （呼び出し側でcascade deleteを実装）
     */
    deleteWorkOrder(id: string): void {
        const wo = this.workOrders.get(id);
        if (!wo) {
            throw new Error(`WorkOrderが見つかりません: ${id}`);
        }

        if (this.undoRedoManager) {
            this.undoRedoManager.pushState('DELETE_WORK_ORDER', {
                workOrder: { ...wo },
            });
        }

        this.workOrders.delete(id);
    }

    /**
     * WorkOrderを取得
     */
    getWorkOrder(id: string): WorkOrder | null {
        return this.workOrders.get(id) || null;
    }

    /**
     * 全WorkOrderを取得
     */
    getAllWorkOrders(): WorkOrder[] {
        return Array.from(this.workOrders.values());
    }

    /**
     * 作業分類でフィルタリング
     */
    getWorkOrdersByClassification(classificationId: string): WorkOrder[] {
        return Array.from(this.workOrders.values()).filter(
            (wo) => wo.ClassificationId === classificationId
        );
    }

    /**
     * WorkOrderが存在するかチェック
     */
    hasWorkOrder(id: string): boolean {
        return this.workOrders.has(id);
    }

    /**
     * WorkOrder数を取得
     */
    getCount(): number {
        return this.workOrders.size;
    }

    /**
     * すべてクリア（テスト用）
     */
    clear(): void {
        this.workOrders.clear();
        this.nextId = 1;
    }

    /**
     * データからWorkOrderを一括読み込み
     */
    loadWorkOrders(workOrders: WorkOrder[]): void {
        this.workOrders.clear();
        for (const wo of workOrders) {
            this.workOrders.set(wo.id, wo);
            const idNum = this.extractIdNumber(wo.id);
            if (idNum >= this.nextId) {
                this.nextId = idNum + 1;
            }
        }
    }
}

export default WorkOrderManager;
