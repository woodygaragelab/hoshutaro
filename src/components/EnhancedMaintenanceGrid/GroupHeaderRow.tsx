import React from 'react';
import { Box, Typography } from '@mui/material';
import { GridColumn } from '../ExcelLikeGrid/types';

interface GroupHeaderRowProps {
  hierarchyPath: string;
  columns: GridColumn[];
  isFixedArea?: boolean;
}

export const GroupHeaderRow: React.FC<GroupHeaderRowProps> = ({
  hierarchyPath,
  columns,
  isFixedArea = false
}) => {
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

  // 固定エリアの場合は、固定エリアの幅のみを使用
  // スクロール可能エリアの場合は、そのエリアの幅を使用
  return (
    <Box
      className="group-header-row"
      sx={{
        display: 'flex',
        height: 32,
        backgroundColor: '#1e1e1e !important',
        borderBottom: '1px solid',
        borderColor: '#333333',
        position: 'relative',
        alignItems: 'center',
        width: isFixedArea ? totalWidth : '100%'
      }}
    >
      {/* 固定エリアの場合は、固定エリアの幅内でのみ表示 */}
      {isFixedArea ? (
        <Box
          sx={{
            width: totalWidth,
            minWidth: totalWidth,
            display: 'flex',
            alignItems: 'center',
            padding: '4px 12px',
            backgroundColor: '#1e1e1e !important',
            color: '#ffffff !important'
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: '#ffffff !important',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {hierarchyPath}
          </Typography>
        </Box>
      ) : (
        /* スクロール可能エリアの場合は、全幅を使用してスクロール可能エリアのみに表示 */
        <Box
          sx={{
            width: totalWidth,
            minWidth: totalWidth,
            display: 'flex',
            alignItems: 'center',
            padding: '4px 12px',
            backgroundColor: '#1e1e1e !important',
            color: '#ffffff !important'
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: '#ffffff !important',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {hierarchyPath}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default GroupHeaderRow;