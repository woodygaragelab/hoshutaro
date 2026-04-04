import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Badge
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import dayjs, { Dayjs } from 'dayjs';
import { getTimeKey, parseTimeKey } from '../../utils/dateUtils';

function CustomDay(props: PickersDayProps<Dayjs> & { activeTimeHeaders?: string[], timeScale?: string }) {
  const { activeTimeHeaders, timeScale, day, outsideCurrentMonth, ...other } = props;

  const isDataPresent = useMemo(() => {
    if (!activeTimeHeaders || outsideCurrentMonth) return false;
    const dateStr = getTimeKey(day.toDate(), (timeScale as any) || 'day');
    return activeTimeHeaders.includes(dateStr);
  }, [activeTimeHeaders, day, timeScale, outsideCurrentMonth]);

  return (
    <Badge
      key={day.toString()}
      overlap="circular"
      badgeContent={isDataPresent ? '•' : undefined}
      sx={{ 
        '& .MuiBadge-badge': { 
          color: '#00e5ff', 
          fontSize: '1.2rem', 
          padding: 0,
          right: '50%',
          top: '85%',
          transform: 'translateX(50%)' 
        } 
      }}
    >
      <PickersDay {...other} outsideCurrentMonth={outsideCurrentMonth} day={day} />
    </Badge>
  );
}

export interface DateJumpDialogProps {
  timeScale?: 'day' | 'week' | 'month' | 'year';
  timeHeaders?: string[];
  activeTimeHeaders?: string[];
  onJump?: (date: string) => void;
  // Fallbacks for older props
  currentDate?: string;
  currentYear?: number;
  onJumpToDate?: (year: number, month?: number, week?: number, day?: number) => void;
}

const DateJumpDialog: React.FC<DateJumpDialogProps> = ({
  timeScale = 'day',
  timeHeaders = [],
  activeTimeHeaders = [],
  onJump,
  currentDate,
  onJumpToDate,
}) => {
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(currentDate ? dayjs(currentDate) : dayjs());

  React.useEffect(() => {
    if (currentDate) {
      setSelectedDate(dayjs(currentDate));
    }
  }, [currentDate]);

  // Determine views based on timescale
  let views: ('year' | 'month' | 'day')[] = ['year', 'month', 'day'];
  let openTo: ('year' | 'month' | 'day') = 'day';
  
  if (timeScale === 'year') {
    views = ['year'];
    openTo = 'year';
  } else if (timeScale === 'month') {
    views = ['year', 'month'];
    openTo = 'month';
  }

  // Track the current calendar view to prevent jumping prematurely during drill-down
  const [currentView, setCurrentView] = useState<any>(openTo);

  React.useEffect(() => {
    setCurrentView(openTo);
  }, [openTo]);

  const { minDate, maxDate } = useMemo(() => {
    if (!timeHeaders || timeHeaders.length === 0) {
      return { minDate: undefined, maxDate: undefined };
    }
    const safeHeaders = [...timeHeaders].filter(h => !h.startsWith('spec_') && !h.startsWith('info_') && !h.startsWith('bomCode'));
    if (safeHeaders.length === 0) {
      return { minDate: undefined, maxDate: undefined };
    }
    const sortedHeaders = safeHeaders.sort();
    
    // Parse oldest and newest time key bounds
    const minParsed = parseTimeKey(sortedHeaders[0], timeScale as any);
    const maxParsed = parseTimeKey(sortedHeaders[sortedHeaders.length - 1], timeScale as any);

    return { 
      minDate: minParsed ? dayjs(minParsed) : undefined, 
      maxDate: maxParsed ? dayjs(maxParsed) : undefined 
    };
  }, [timeHeaders, timeScale]);

  const handleJump = (newValue: Dayjs | null) => {
    if (newValue) {
      setSelectedDate(newValue);

      // Only jump if the user selected the final view for this timescale
      const targetView = views[views.length - 1]; // e.g. 'day' for week/day, 'month' for month
      if (currentView !== targetView) {
        return; // Prevent closing the menu during navigation drill-down
      }

      if (onJump) {
        const formatted = getTimeKey(newValue.toDate(), timeScale);
        onJump(formatted);
      } else if (onJumpToDate) {
        onJumpToDate(newValue.year(), newValue.month() + 1, undefined, newValue.date());
      }
    }
  };

  const timeScaleLabel = {
    year: '年',
    month: '月',
    week: '週',
    day: '日'
  }[timeScale];

  return (
    <Box className="hover-menu-vertical" sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      minWidth: 320,
      cursor: 'default',
    }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'primary.main' }}>
        指定した{timeScaleLabel}へジャンプ
      </Typography>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ 
          width: '100%',
          '& .MuiPickersCalendarHeader-root': { color: 'white', pt: 1 },
          '& .MuiDayCalendar-weekDayLabel': { color: 'rgba(255,255,255,0.6)' },
          '& .MuiPickersDay-root': { color: 'white' },
          '& .MuiPickersDay-root.Mui-selected': { backgroundColor: 'primary.main' },
          '& .MuiPickersDay-root:not(.Mui-selected):not(.Mui-disabled):hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
          '& .MuiPickersDay-root.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
          '& .MuiPickersArrowSwitcher-button': { color: 'white' },
          '& .MuiPickersYear-yearButton': { color: 'white' },
          '& .MuiPickersYear-yearButton.Mui-selected': { backgroundColor: 'primary.main' },
          '& .MuiPickersYear-yearButton.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
          '& .MuiPickersMonth-monthButton': { color: 'white' },
          '& .MuiPickersMonth-monthButton.Mui-selected': { backgroundColor: 'primary.main' },
          '& .MuiPickersMonth-monthButton.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
        }}>
          <DateCalendar 
            value={selectedDate} 
            onChange={handleJump}
            onViewChange={(newView) => setCurrentView(newView)}
            views={views as any}
            openTo={openTo}
            minDate={minDate}
            maxDate={maxDate}
            slots={{ day: CustomDay }}
            slotProps={{
              day: {
                activeTimeHeaders,
                timeScale,
              } as any
            }}
          />
        </Box>
      </LocalizationProvider>
    </Box>
  );
};

export default DateJumpDialog;
