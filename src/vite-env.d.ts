/// <reference types="vite/client" />

import type { AssetManager } from './services/AssetManager';
import type { WorkOrderLineManager } from './services/WorkOrderLineManager';
import type { WorkOrderManager } from './services/WorkOrderManager';
import type { WorkOrderLine } from './types/maintenanceTask';

declare global {
  /**
   * Browser console から E2E / 整合性テスト用に internal manager を読めるようにする
   * dev-only の debug shim。本番ビルドでは `if (import.meta.env.DEV)` ガードで
   * 書き込み自体が走らない想定。
   */
  interface Window {
    __wolManager?: WorkOrderLineManager;
    __assetManager?: AssetManager;
    __woManager?: WorkOrderManager;
    __debug_wol?: {
      existingWorkOrderLines: unknown[];
      postCreationLines: WorkOrderLine[];
      wolSuccessCount: number;
      wolErrorCount: number;
    };
    __DEBUG_EQUIPMENT?: unknown;
    __DEBUG_TRANS?: unknown;
  }
}

export {};
