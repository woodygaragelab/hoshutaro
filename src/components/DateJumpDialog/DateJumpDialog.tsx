/**
 * Date Jump Dialog
 * Dialog for quickly jumping to a specific date in the grid
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

export interface DateJumpDialogProps {
  open: boolean;
  currentDate?: string;
  onJump?: (date: string) => void;
  onClose: () => void;
  timeScale?: 'day' | 'week' | 'month' | 'year';
  currentYear?: number;
  onJumpToDate?: (year: number, month?: number, week?: number, day?: number) => void;
}

/**
 * Date Jump Dialog Component
 */
const DateJumpDialog: React.FC<DateJumpDialogProps> = ({
  open,
  currentDate = '',
  onJump,
  onClose,
  timeScale = 'day',
  currentYear,
  onJumpToDate,
}) => {
  const [date, setDate] = useState(currentDate);
  const [year, setYear] = useState(currentYear || new Date().getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [day, setDay] = useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (open) {
      setDate(currentDate);
      if (currentYear) {
        setYear(currentYear);
      }
    }
  }, [open, currentDate, currentYear]);

  const handleJump = () => {
    if (onJumpToDate) {
      onJumpToDate(year, month, undefined, day);
      onClose();
    } else if (onJump && date) {
      onJump(date);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>日付ジャンプ</DialogTitle>
      <DialogContent>
        {onJumpToDate ? (
          <>
            <TextField
              autoFocus
              margin="dense"
              label="年"
              type="number"
              fullWidth
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              onKeyPress={handleKeyPress}
            />
            {(timeScale === 'month' || timeScale === 'day') && (
              <TextField
                margin="dense"
                label="月"
                type="number"
                fullWidth
                value={month || ''}
                onChange={(e) => setMonth(e.target.value ? parseInt(e.target.value) : undefined)}
                onKeyPress={handleKeyPress}
                inputProps={{ min: 1, max: 12 }}
              />
            )}
            {timeScale === 'day' && (
              <TextField
                margin="dense"
                label="日"
                type="number"
                fullWidth
                value={day || ''}
                onChange={(e) => setDay(e.target.value ? parseInt(e.target.value) : undefined)}
                onKeyPress={handleKeyPress}
                inputProps={{ min: 1, max: 31 }}
              />
            )}
          </>
        ) : (
          <TextField
            autoFocus
            margin="dense"
            label="日付"
            type="date"
            fullWidth
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyPress={handleKeyPress}
            InputLabelProps={{
              shrink: true,
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleJump} variant="contained" color="primary">
          ジャンプ
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DateJumpDialog;
