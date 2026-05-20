/**
 * UI コンテキスト store（プラン WS1-10）。
 *
 * 開いているダイアログ・ダイアログパラメタ・グリッド状態を一元管理し、
 * AgentBar が `/api/chat/completions` に送信する `ui_context` の単一情報源となる。
 *
 * バックエンドはこの値で intent ホワイトリストを適用し、現在の UI コンテキスト外の
 * 操作（例: HierarchyEditDialog 中の計画推論）を `out_of_scope` として拒否する。
 */

import { create } from 'zustand'

/** 現在開いているダイアログの種別。null はグリッド表示。 */
export type CurrentDialog =
  | 'hierarchy'
  | 'assetClassification'
  | 'workOrderClassification'
  | 'workOrderLine'
  | 'specification'
  | 'assetReassign'
  | null

/** 各ダイアログに渡されるパラメタ（部分集合）。 */
export interface DialogParams {
  assetId?: string
  dateKey?: string
  workOrderId?: string
  selectedAssetIds?: string[]
  tabIndex?: number
}

/** グリッド表示状態。 */
export interface GridState {
  viewMode?: 'asset-based' | 'workorder-based'
  timeScale?: 'year' | 'month' | 'week' | 'day'
  displayMode?: 'specifications' | 'maintenance' | 'both'
  editScope?: 'single-asset' | 'all-assets'
  selectedAssetIds?: string[]
  activeFilters?: Record<string, string>
}

export interface UIContextSnapshot {
  currentDialog: CurrentDialog
  dialogParams: DialogParams
  gridState: GridState
}

interface UIContextStore extends UIContextSnapshot {
  setCurrentDialog: (dialog: CurrentDialog, params?: DialogParams) => void
  closeDialog: () => void
  patchGridState: (patch: Partial<GridState>) => void
  /** チャット送信用にフラットな snapshot を返す。 */
  snapshot: () => UIContextSnapshot
}

export const useUIContextStore = create<UIContextStore>((set, get) => ({
  currentDialog: null,
  dialogParams: {},
  gridState: {},
  setCurrentDialog: (dialog, params = {}) =>
    set({ currentDialog: dialog, dialogParams: params }),
  closeDialog: () => set({ currentDialog: null, dialogParams: {} }),
  patchGridState: (patch) =>
    set((s) => ({ gridState: { ...s.gridState, ...patch } })),
  snapshot: () => {
    const s = get()
    return {
      currentDialog: s.currentDialog,
      dialogParams: s.dialogParams,
      gridState: s.gridState,
    }
  },
}))
