import React, { useMemo } from 'react';
import { Box, Table, TableHead, TableBody, TableRow, TableCell, Typography } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridState } from './types';
import { SpecificationEditCell } from './SpecificationEditCell';
import { SpecificationEditManager, SpecificationEditHandlers } from './SpecificationEditManager';

interface SpecificationTableProps {
  data: HierarchicalData[];
  gridState: GridState;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  onSpecificationEdit: (rowId: string, specIndex: number, key: string, value: string) => void;
  readOnly: boolean;
  showBomCode: boolean;
  groupedData?: { [key: string]: HierarchicalData[] };
}

export const SpecificationTable: React.FC<SpecificationTableProps> = ({
  data,
  gridState,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  onSpecificationEdit,
  readOnly,
  showBomCode,
  groupedData
}) => {
  // Group data for rendering if not already grouped
  const displayGroupedData = useMemo(() => {
    if (groupedData) {
      return groupedData;
    }
    
    return data.reduce((acc, item) => {
      const path = item.hierarchyPath || 'Uncategorized';
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(item);
      return acc;
    }, {} as { [key: string]: HierarchicalData[] });
  }, [data, groupedData]);



  const renderSpecificationRow = (item: HierarchicalData, handlers: SpecificationEditHandlers) => {
    const maxSpecs = Math.max(item.specifications?.length || 1, 1);
    
    return Array.from({ length: maxSpecs }, (_, specIndex) => {
      const spec = item.specifications?.[specIndex];
      const rowKey = `${item.id}_spec_${specIndex}`;
      
      return (
        <TableRow key={rowKey} className="specification-row">
          {/* Equipment Name (only show for first specification row) */}
          {specIndex === 0 && (
            <TableCell 
              rowSpan={maxSpecs}
              className="equipment-name-cell"
              sx={{ 
                verticalAlign: 'top',
                borderRight: '2px solid #ddd',
                backgroundColor: '#f8f9fa',
                fontWeight: 'medium'
              }}
            >
              {item.task}
            </TableCell>
          )}
          
          {/* BOM Code (only show for first specification row) */}
          {specIndex === 0 && showBomCode && (
            <TableCell 
              rowSpan={maxSpecs}
              className="bom-code-cell"
              sx={{ 
                verticalAlign: 'top',
                borderRight: '2px solid #ddd',
                backgroundColor: '#f8f9fa'
              }}
            >
              {item.bomCode}
            </TableCell>
          )}
          
          {/* Specification Key */}
          <SpecificationEditCell
            item={item}
            specIndex={specIndex}
            field="key"
            value={spec?.key || ''}
            isSelected={
              gridState.selectedCell?.rowId === item.id && 
              gridState.selectedCell?.columnId === `spec_${specIndex}_key`
            }
            isEditing={
              gridState.editingCell?.rowId === item.id && 
              gridState.editingCell?.columnId === `spec_${specIndex}_key`
            }
            onEdit={handlers.handleSpecificationEdit}
            onSelect={onSelectedCellChange}
            onEditingChange={onEditingCellChange}
            onSpecificationAdd={handlers.handleSpecificationAdd}
            onSpecificationDelete={handlers.handleSpecificationDelete}
            onSpecificationReorder={handlers.handleSpecificationReorder}
            readOnly={readOnly}
          />
          
          {/* Specification Value */}
          <SpecificationEditCell
            item={item}
            specIndex={specIndex}
            field="value"
            value={spec?.value || ''}
            isSelected={
              gridState.selectedCell?.rowId === item.id && 
              gridState.selectedCell?.columnId === `spec_${specIndex}_value`
            }
            isEditing={
              gridState.editingCell?.rowId === item.id && 
              gridState.editingCell?.columnId === `spec_${specIndex}_value`
            }
            onEdit={handlers.handleSpecificationEdit}
            onSelect={onSelectedCellChange}
            onEditingChange={onEditingCellChange}
            onSpecificationAdd={handlers.handleSpecificationAdd}
            onSpecificationDelete={handlers.handleSpecificationDelete}
            onSpecificationReorder={handlers.handleSpecificationReorder}
            readOnly={readOnly}
          />
          
          {/* Specification Order */}
          <SpecificationEditCell
            item={item}
            specIndex={specIndex}
            field="order"
            value={spec?.order || specIndex}
            isSelected={
              gridState.selectedCell?.rowId === item.id && 
              gridState.selectedCell?.columnId === `spec_${specIndex}_order`
            }
            isEditing={
              gridState.editingCell?.rowId === item.id && 
              gridState.editingCell?.columnId === `spec_${specIndex}_order`
            }
            onEdit={handlers.handleSpecificationEdit}
            onSelect={onSelectedCellChange}
            onEditingChange={onEditingCellChange}
            onSpecificationAdd={handlers.handleSpecificationAdd}
            onSpecificationDelete={handlers.handleSpecificationDelete}
            onSpecificationReorder={handlers.handleSpecificationReorder}
            readOnly={readOnly}
          />
        </TableRow>
      );
    });
  };

  return (
    <SpecificationEditManager
      data={data}
      onUpdateItem={onUpdateItem}
      onSpecificationEdit={onSpecificationEdit}
    >
      {(handlers) => (
        <Box sx={{ 
          width: '100%', 
          height: '100%', 
          overflow: 'auto',
          border: '1px solid #ddd'
        }}>
          <Table 
            stickyHeader 
            size="small"
            sx={{ 
              '& .MuiTableCell-root': {
                padding: '4px 8px',
                borderRight: '1px solid #ddd'
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    backgroundColor: '#f5f5f5',
                    fontWeight: 'bold',
                    minWidth: 200
                  }}
                >
                  機器名
                </TableCell>
                {showBomCode && (
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#f5f5f5',
                      fontWeight: 'bold',
                      minWidth: 120
                    }}
                  >
                    TAG No.
                  </TableCell>
                )}
                <TableCell 
                  sx={{ 
                    backgroundColor: '#f5f5f5',
                    fontWeight: 'bold',
                    minWidth: 150
                  }}
                >
                  仕様項目
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: '#f5f5f5',
                    fontWeight: 'bold',
                    minWidth: 200
                  }}
                >
                  値
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: '#f5f5f5',
                    fontWeight: 'bold',
                    minWidth: 80
                  }}
                >
                  順序
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(displayGroupedData).map(([hierarchyPath, items]) => (
                <React.Fragment key={hierarchyPath}>
                  {/* Group Header */}
                  <TableRow className="group-header-row">
                    <TableCell
                      colSpan={4 + (showBomCode ? 1 : 0)}
                      sx={{
                        backgroundColor: '#e3f2fd',
                        fontWeight: 'bold',
                        borderBottom: '2px solid #1976d2'
                      }}
                    >
                      <Typography variant="subtitle2" color="primary">
                        {hierarchyPath}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  
                  {/* Equipment Specification Rows */}
                  {items.map(item => renderSpecificationRow(item, handlers))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          
          {/* Instructions */}
          {!readOnly && (
            <Box sx={{ 
              p: 2, 
              backgroundColor: '#f8f9fa', 
              borderTop: '1px solid #ddd',
              fontSize: '0.875rem',
              color: '#666'
            }}>
              <Typography variant="caption" display="block">
                操作方法: ダブルクリックで編集 | Enter/F2で編集開始 | Tab/Enterで次のセル | Escで編集キャンセル
              </Typography>
              <Typography variant="caption" display="block">
                仕様項目: 右クリックまたは選択時のメニューボタンで追加・削除・並び替え | Insertキーで追加 | Deleteキーで削除
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </SpecificationEditManager>
  );
};

export default SpecificationTable;