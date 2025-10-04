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
      sx={{
        display: 'flex',
        height: 32, // Fixed height instead of minHeight
        backgroundColor: 'grey.100',
        borderBottom: '1px solid',
        borderColor: 'divider',
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
          backgroundColor: 'inherit'
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: '#333333 !important',
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