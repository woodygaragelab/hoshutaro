/**
 * グリッドコンポーネントにおける rowId (行ID) から実際の assetId と taskId を抽出する共通ユーティリティ
 *
 * 行IDの構造パターン:
 * - 'asset_{assetId}' : 基本的な機器行
 * - 'asset_{assetId}_wo_{workOrderId}' : 古いタスク付与パターン等
 * - 'workOrder_{taskId}_asset_{assetId}_wol_{wolId}' : 作業ベースの行
 * - 'task_{taskId}_asset_{assetId}_wol_{wolId}' : 作業ベースの行 (古いエイリアス)
 */

export interface ExtractedIds {
  assetId: string;
  taskId: string | null;
  wolId: string | null;
}

export const extractIdsFromRowId = (rowId: string, directAssetId?: string): ExtractedIds => {
  let assetId = rowId;
  let taskId: string | null = null;
  let wolId: string | null = null;

  if (rowId.startsWith('asset_') && rowId.includes('_wo_')) {
    assetId = rowId.split('_wo_')[0].replace('asset_', '');
  } else if (rowId.startsWith('asset_')) {
    assetId = rowId.replace('asset_', '');
  } else if (rowId.startsWith('task_') && rowId.includes('_asset_')) {
    const parts = rowId.split('_asset_');
    if (parts.length >= 2) {
      taskId = parts[0].replace('task_', '');
      const assetParts = parts[1].split('_wol_');
      assetId = assetParts[0];
      if (assetParts.length > 1) {
        wolId = assetParts[1];
      }
    }
  } else if (rowId.startsWith('workOrder_') && rowId.includes('_asset_')) {
    const parts = rowId.split('_asset_');
    if (parts.length >= 2) {
      taskId = parts[0].replace('workOrder_', '');
      
      // Check for wol suffix
      if (parts[1].includes('_wol_')) {
        const assetParts = parts[1].split('_wol_');
        assetId = assetParts[0];
        wolId = assetParts[1];
      } else {
        assetId = parts[1].split('_')[0] === parts[1] ? parts[1] : parts[1].split('_')[0];
      }
    }
  } else if (directAssetId) {
    // Fallback if the row itself provided an assetId property natively
    assetId = directAssetId;
  }

  return { assetId, taskId, wolId };
};
