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
        borderBottom: '1px solid #333333',
        position: 'relative',
        alignItems: 'center',
        width: isFixedArea ? totalWidth : '100%',
        boxSizing: 'border-box',
        flexShrink: 0
      }}
    >
      <Box
        sx={{
          width: isFixedArea ? totalWidth : '100%',
          minWidth: isFixedArea ? totalWidth : '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '4px 12px',
          backgroundColor: '#1e1e1e !important',
          color: '#ffffff !important'
        }}
      >
        {/* 固定エリアでのみ機器階層テキストを表示、スクロール可能エリアでは空白で行の高さのみ維持 */}
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: '#ffffff !important',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            visibility: isFixedArea ? 'visible' : 'hidden'
          }}
        >
          {isFixedArea ? hierarchyPath : '　'} {/* スクロール可能エリアでは全角スペースで高さを維持 */}
        </Typography>
      </Box>
    </Box>
  );
};

export default GroupHeaderRow;