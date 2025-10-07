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

  return (
    <Box
      className="group-header-row"
      sx={{
        display: 'flex',
        height: 32, // Fixed height instead of minHeight
        backgroundColor: '#1e1e1e !important',
        borderBottom: '1px solid',
        borderColor: '#333333',
        position: isFixedArea ? 'sticky' : 'relative',
        left: 0,
        zIndex: isFixedArea ? 2 : 1,
        alignItems: 'center' // Ensure vertical alignment
      }}
    >
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
    </Box>
  );
};

export default GroupHeaderRow;