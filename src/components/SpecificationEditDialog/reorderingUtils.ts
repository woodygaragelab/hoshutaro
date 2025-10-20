import { SpecificationEditItem } from './SpecificationEditDialog';

// ドラッグ&ドロップの状態
export interface DragState {
  isDragging: boolean;
  draggedIndex: number | null;
  draggedItem: SpecificationEditItem | null;
  dropTargetIndex: number | null;
  dragOffset: { x: number; y: number };
}

// タッチ操作の状態
export interface TouchReorderState {
  isReordering: boolean;
  selectedIndex: number | null;
  selectedItem: SpecificationEditItem | null;
  availablePositions: number[];
}

/**
 * 配列内のアイテムを移動
 */
export const moveItem = <T>(
  array: T[],
  fromIndex: number,
  toIndex: number
): T[] => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || 
      fromIndex >= array.length || toIndex >= array.length) {
    return array;
  }

  const newArray = [...array];
  const [movedItem] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, movedItem);
  
  return newArray;
};

/**
 * 仕様項目の順序を更新
 */
export const updateSpecificationOrder = (
  items: SpecificationEditItem[]
): SpecificationEditItem[] => {
  return items.map((item, index) => ({
    ...item,
    order: index + 1,
  }));
};

/**
 * アクティブな（削除されていない）項目のインデックスを取得
 */
export const getActiveItemIndices = (items: SpecificationEditItem[]): number[] => {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.isDeleted)
    .map(({ index }) => index);
};

/**
 * デスクトップ用ドラッグ&ドロップハンドラー
 */
export class DesktopDragHandler {
  private dragState: DragState = {
    isDragging: false,
    draggedIndex: null,
    draggedItem: null,
    dropTargetIndex: null,
    dragOffset: { x: 0, y: 0 },
  };

  private onDragStart?: (index: number) => void;
  private onDragEnd?: (fromIndex: number, toIndex: number) => void;
  private onDragOver?: (targetIndex: number) => void;

  constructor(handlers: {
    onDragStart?: (index: number) => void;
    onDragEnd?: (fromIndex: number, toIndex: number) => void;
    onDragOver?: (targetIndex: number) => void;
  }) {
    this.onDragStart = handlers.onDragStart;
    this.onDragEnd = handlers.onDragEnd;
    this.onDragOver = handlers.onDragOver;
  }

  handleDragStart = (event: React.DragEvent, index: number, item: SpecificationEditItem) => {
    this.dragState = {
      isDragging: true,
      draggedIndex: index,
      draggedItem: item,
      dropTargetIndex: null,
      dragOffset: { x: 0, y: 0 },
    };

    // ドラッグイメージの設定
    const dragImage = document.createElement('div');
    dragImage.innerHTML = `
      <div style="
        background: white;
        border: 2px solid #1976d2;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: system-ui;
        max-width: 300px;
      ">
        <strong>${item.key}</strong><br>
        <span style="color: #666; font-size: 0.9em;">${item.value}</span>
      </div>
    `;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);

    event.dataTransfer.setDragImage(dragImage, 150, 30);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());

    // クリーンアップ
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);

    if (this.onDragStart) {
      this.onDragStart(index);
    }
  };

  handleDragOver = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (this.dragState.dropTargetIndex !== targetIndex) {
      this.dragState.dropTargetIndex = targetIndex;
      if (this.onDragOver) {
        this.onDragOver(targetIndex);
      }
    }
  };

  handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
  };

  handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
  };

  handleDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();

    const fromIndex = this.dragState.draggedIndex;
    if (fromIndex !== null && fromIndex !== targetIndex) {
      if (this.onDragEnd) {
        this.onDragEnd(fromIndex, targetIndex);
      }
    }

    this.resetDragState();
  };

  handleDragEnd = () => {
    this.resetDragState();
  };

  private resetDragState = () => {
    this.dragState = {
      isDragging: false,
      draggedIndex: null,
      draggedItem: null,
      dropTargetIndex: null,
      dragOffset: { x: 0, y: 0 },
    };
  };

  getDragState = () => ({ ...this.dragState });
}

/**
 * タブレット・モバイル用タッチ順序変更ハンドラー
 */
export class TouchReorderHandler {
  private reorderState: TouchReorderState = {
    isReordering: false,
    selectedIndex: null,
    selectedItem: null,
    availablePositions: [],
  };

  private onReorderStart?: (index: number) => void;
  private onReorderEnd?: (fromIndex: number, toIndex: number) => void;
  private onReorderCancel?: () => void;

  constructor(handlers: {
    onReorderStart?: (index: number) => void;
    onReorderEnd?: (fromIndex: number, toIndex: number) => void;
    onReorderCancel?: () => void;
  }) {
    this.onReorderStart = handlers.onReorderStart;
    this.onReorderEnd = handlers.onReorderEnd;
    this.onReorderCancel = handlers.onReorderCancel;
  }

  startReordering = (index: number, item: SpecificationEditItem, items: SpecificationEditItem[]) => {
    const activeIndices = getActiveItemIndices(items);
    
    this.reorderState = {
      isReordering: true,
      selectedIndex: index,
      selectedItem: item,
      availablePositions: activeIndices.filter(i => i !== index),
    };

    if (this.onReorderStart) {
      this.onReorderStart(index);
    }
  };

  moveToPosition = (targetIndex: number) => {
    const fromIndex = this.reorderState.selectedIndex;
    if (fromIndex !== null && fromIndex !== targetIndex) {
      if (this.onReorderEnd) {
        this.onReorderEnd(fromIndex, targetIndex);
      }
    }
    this.cancelReordering();
  };

  cancelReordering = () => {
    this.reorderState = {
      isReordering: false,
      selectedIndex: null,
      selectedItem: null,
      availablePositions: [],
    };

    if (this.onReorderCancel) {
      this.onReorderCancel();
    }
  };

  getReorderState = () => ({ ...this.reorderState });
}

/**
 * キーボード操作による順序変更
 */
export const handleKeyboardReorder = (
  event: React.KeyboardEvent,
  currentIndex: number,
  items: SpecificationEditItem[],
  onMove: (fromIndex: number, toIndex: number) => void
) => {
  const activeIndices = getActiveItemIndices(items);
  const currentActiveIndex = activeIndices.indexOf(currentIndex);
  
  if (currentActiveIndex === -1) return;

  let targetActiveIndex = currentActiveIndex;
  let handled = false;

  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'ArrowUp':
        if (currentActiveIndex > 0) {
          targetActiveIndex = currentActiveIndex - 1;
          handled = true;
        }
        break;
      case 'ArrowDown':
        if (currentActiveIndex < activeIndices.length - 1) {
          targetActiveIndex = currentActiveIndex + 1;
          handled = true;
        }
        break;
      case 'Home':
        if (currentActiveIndex > 0) {
          targetActiveIndex = 0;
          handled = true;
        }
        break;
      case 'End':
        if (currentActiveIndex < activeIndices.length - 1) {
          targetActiveIndex = activeIndices.length - 1;
          handled = true;
        }
        break;
    }
  }

  if (handled) {
    event.preventDefault();
    const targetIndex = activeIndices[targetActiveIndex];
    onMove(currentIndex, targetIndex);
  }
};

/**
 * 順序変更のアニメーション設定
 */
export const getReorderAnimationConfig = (deviceType: 'desktop' | 'tablet' | 'mobile') => {
  return {
    desktop: {
      dragPreview: {
        scale: 1.05,
        opacity: 0.9,
        shadow: '0 8px 24px rgba(0,0,0,0.15)',
        transition: 'all 0.2s ease-out',
      },
      dropTarget: {
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.08)',
        transition: 'all 0.15s ease-in-out',
      },
      placeholder: {
        height: '60px',
        backgroundColor: 'rgba(25, 118, 210, 0.12)',
        borderRadius: '8px',
        border: '2px dashed #1976d2',
        transition: 'all 0.2s ease-in-out',
      },
    },
    tablet: {
      selection: {
        scale: 1.02,
        backgroundColor: 'rgba(25, 118, 210, 0.12)',
        borderColor: '#1976d2',
        transition: 'all 0.25s ease-in-out',
      },
      positionIndicator: {
        backgroundColor: '#1976d2',
        height: '3px',
        borderRadius: '2px',
        transition: 'all 0.2s ease-in-out',
      },
    },
    mobile: {
      selection: {
        scale: 1.01,
        backgroundColor: 'rgba(25, 118, 210, 0.08)',
        borderColor: '#1976d2',
        transition: 'all 0.3s ease-in-out',
      },
      positionButton: {
        backgroundColor: '#1976d2',
        color: 'white',
        minHeight: '48px',
        borderRadius: '24px',
        transition: 'all 0.25s ease-in-out',
      },
    },
  }[deviceType];
};

/**
 * アクセシビリティ用のARIA属性を生成
 */
export const getReorderAriaAttributes = (
  index: number,
  totalItems: number,
  isSelected: boolean = false,
  isDragTarget: boolean = false
) => {
  return {
    'aria-label': `項目 ${index + 1} / ${totalItems}${isSelected ? ' (選択中)' : ''}${isDragTarget ? ' (ドロップ対象)' : ''}`,
    'aria-describedby': 'reorder-instructions',
    'aria-grabbed': isSelected,
    'aria-dropeffect': (isDragTarget ? 'move' : 'none') as 'move' | 'none',
    'tabIndex': 0,
    'role': 'listitem',
  };
};

/**
 * 順序変更の操作説明テキストを生成
 */
export const getReorderInstructions = (deviceType: 'desktop' | 'tablet' | 'mobile') => {
  switch (deviceType) {
    case 'desktop':
      return 'ドラッグ&ドロップで順序を変更できます。キーボードの場合は、Ctrl+矢印キーで移動、Ctrl+Home/Endで先頭/末尾に移動できます。';
    case 'tablet':
      return '項目をタップして選択し、移動先をタップして順序を変更できます。上下ボタンでも移動できます。';
    case 'mobile':
      return '項目をタップして選択し、移動先の位置ボタンをタップして順序を変更できます。';
    default:
      return '';
  }
};