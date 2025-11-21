import React, { useState, useMemo } from 'react';
import {
  Popover,
  Box,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
} from '@mui/icons-material';

interface DateJumpDialogProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  timeScale: 'year' | 'month' | 'week' | 'day';
  currentYear: number;
  onJumpToDate: (year: number, month?: number, week?: number, day?: number) => void;
}

export const DateJumpDialog: React.FC<DateJumpDialogProps> = ({
  open,
  anchorEl,
  onClose,
  timeScale,
  currentYear,
  onJumpToDate,
}) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Generate year range (current year ± 5 years)
  const years = useMemo(() => {
    const startYear = currentYear - 5;
    const endYear = currentYear + 5;
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  }, [currentYear]);

  // Month names
  const months = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  // Generate weeks for the selected year
  const weeks = useMemo(() => {
    const weeksInYear = 52; // Simplified, could be 52 or 53
    return Array.from({ length: weeksInYear }, (_, i) => i + 1);
  }, []);

  // Generate days for the selected month
  const days = useMemo(() => {
    if (selectedMonth === null) return [];
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [selectedYear, selectedMonth]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    if (timeScale === 'year') {
      onJumpToDate(year);
      onClose();
    }
  };

  const handleMonthClick = (monthIndex: number) => {
    setSelectedMonth(monthIndex + 1);
    if (timeScale === 'month') {
      onJumpToDate(selectedYear, monthIndex + 1);
      onClose();
    }
  };

  const handleWeekClick = (week: number) => {
    setSelectedWeek(week);
    if (timeScale === 'week') {
      onJumpToDate(selectedYear, undefined, week);
      onClose();
    }
  };

  const handleDayClick = (day: number) => {
    if (selectedMonth === null) return;
    if (timeScale === 'day') {
      onJumpToDate(selectedYear, selectedMonth, undefined, day);
      onClose();
    }
  };

  const renderYearSelector = () => (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <IconButton size="small" onClick={() => setSelectedYear(selectedYear - 1)}>
          <PrevIcon />
        </IconButton>
        <Typography variant="h6">{selectedYear}年</Typography>
        <IconButton size="small" onClick={() => setSelectedYear(selectedYear + 1)}>
          <NextIcon />
        </IconButton>
      </Box>
      <Grid container spacing={1}>
        {years.map((year) => (
          <Grid item xs={4} key={year}>
            <Button
              fullWidth
              variant={year === selectedYear ? 'contained' : 'outlined'}
              onClick={() => handleYearChange(year)}
              sx={{ fontSize: '0.875rem' }}
            >
              {year}
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderMonthSelector = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        {selectedYear}年
      </Typography>
      <Grid container spacing={1}>
        {months.map((month, index) => (
          <Grid item xs={3} key={index}>
            <Button
              fullWidth
              variant={selectedMonth === index + 1 ? 'contained' : 'outlined'}
              onClick={() => handleMonthClick(index)}
              sx={{ fontSize: '0.875rem' }}
            >
              {month}
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderWeekSelector = () => (
    <Box sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        {selectedYear}年
      </Typography>
      <Grid container spacing={1}>
        {weeks.map((week) => (
          <Grid item xs={3} key={week}>
            <Button
              fullWidth
              variant={selectedWeek === week ? 'contained' : 'outlined'}
              onClick={() => handleWeekClick(week)}
              sx={{ fontSize: '0.875rem' }}
            >
              第{week}週
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderDaySelector = () => {
    if (selectedMonth === null) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            まず月を選択してください
          </Typography>
          {renderMonthSelector()}
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Button
            size="small"
            onClick={() => setSelectedMonth(null)}
            sx={{ fontSize: '0.75rem' }}
          >
            ← 月選択に戻る
          </Button>
          <Typography variant="subtitle2">
            {selectedYear}年{selectedMonth}月
          </Typography>
        </Box>
        <Grid container spacing={0.5}>
          {days.map((day) => (
            <Grid item xs={12 / 7} key={day}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleDayClick(day)}
                sx={{ 
                  fontSize: '0.75rem',
                  minWidth: 0,
                  p: 0.5
                }}
              >
                {day}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  const renderContent = () => {
    switch (timeScale) {
      case 'year':
        return renderYearSelector();
      case 'month':
        return (
          <>
            {renderYearSelector()}
            {renderMonthSelector()}
          </>
        );
      case 'week':
        return (
          <>
            {renderYearSelector()}
            {renderWeekSelector()}
          </>
        );
      case 'day':
        return (
          <>
            {renderYearSelector()}
            {renderDaySelector()}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      sx={{
        '& .MuiPopover-paper': {
          maxWidth: 400,
          maxHeight: 600,
        }
      }}
    >
      <Box sx={{ minWidth: 300 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            日付ジャンプ
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content */}
        {renderContent()}
      </Box>
    </Popover>
  );
};

export default DateJumpDialog;
