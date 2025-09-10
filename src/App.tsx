import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import rawData from './data/equipments.json';
import { HierarchicalData, RawEquipment } from './types';
import TableRow from './components/TableRow';
import { transformData } from './utils/dataTransformer';
import { Switch, FormControlLabel, TextField, Button, Menu, MenuItem, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, InputLabel, Snackbar, Alert } from '@mui/material';

import { BsDownload, BsUpload } from 'react-icons/bs';
import { MdRefresh } from 'react-icons/md';

const App: React.FC = () => {
  const [maintenanceData, setMaintenanceData] = useState<HierarchicalData[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');
  const [displaySettingsAnchorEl, setDisplaySettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [yearOperationsAnchorEl, setYearOperationsAnchorEl] = useState<null | HTMLElement>(null);
  const [dataOperationsAnchorEl, setDataOperationsAnchorEl] = useState<null | HTMLElement>(null);

  const [addYearDialogOpen, setAddYearDialogOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState<string>('');
  const [addYearError, setAddYearError] = useState<string>('');

  const [deleteYearDialogOpen, setDeleteYearDialogOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | string>('');
  const [deleteYearError, setDeleteYearError] = useState<string>('');

  const [importConfirmDialogOpen, setImportConfirmDialogOpen] = useState(false);
  const [importedFileData, setImportedFileData] = useState<any>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [resetConfirmDialogOpen, setResetConfirmDialogOpen] = useState(false);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');

  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const [transformed, sortedYears] = transformData(rawData as { [id: string]: RawEquipment });
    setMaintenanceData(transformed);
    setYears(sortedYears);
  }, []);

  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    const updateRecursively = (items: HierarchicalData[]): HierarchicalData[] => {
      return items.map(item => {
        if (item.id === updatedItem.id) {
          return updatedItem;
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: updateRecursively(item.children) };
        }
        return item;
      });
    };
    setMaintenanceData(prevData => updateRecursively(prevData));
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleViewModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setViewMode(event.target.checked ? 'cost' : 'status');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, setter: React.Dispatch<React.SetStateAction<HTMLElement | null>>) => {
    setter(event.currentTarget);
  };

  const handleMenuClose = (setter: React.Dispatch<React.SetStateAction<HTMLElement | null>>) => {
    setter(null);
  };

  // --- Year Operations ---
  const handleAddYearClick = () => {
    setAddYearDialogOpen(true);
    setNewYearInput('');
    setAddYearError('');
    handleMenuClose(setYearOperationsAnchorEl);
  };

  const handleAddYearConfirm = () => {
    const year = parseInt(newYearInput, 10);
    if (isNaN(year) || year < 1000 || year > 9999) {
      setAddYearError('無効な年度です。4桁の数字で入力してください。');
      return;
    }
    if (years.includes(year)) {
      setAddYearError('その年度は既に存在します。');
      return;
    }
    setYears(prevYears => [...prevYears, year].sort((a, b) => a - b));
    setAddYearDialogOpen(false);
    showSnackbar('年度が追加されました。', 'success');
  };

  const handleDeleteYearClick = () => {
    setDeleteYearDialogOpen(true);
    setYearToDelete('');
    setDeleteYearError('');
    handleMenuClose(setYearOperationsAnchorEl);
  };

  const handleDeleteYearConfirm = () => {
    if (!yearToDelete) {
      setDeleteYearError('削除する年度を選択してください。');
      return;
    }
    const year = parseInt(yearToDelete as string, 10);
    // Check if the year has any data before deleting
    const hasData = maintenanceData.some(item => {
      if (item.results && item.results[year]) return true;
      if (item.children) {
        return item.children.some((child: any) => child.results && child.results[year]);
      }
      return false;
    });

    if (hasData) {
      setDeleteYearError('この年度にはデータが存在するため削除できません。');
      return;
    }

    setYears(prevYears => prevYears.filter(y => y !== year));
    setDeleteYearDialogOpen(false);
    showSnackbar('年度が削除されました。', 'success');
  };

  // --- Data Operations ---
  const handleExportData = () => {
    const dataToExport = { years, maintenanceData };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hoshitori_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    handleMenuClose(setDataOperationsAnchorEl);
    showSnackbar('データをエクスポートしました。', 'success');
  };

  const handleImportDataClick = () => {
    importFileInputRef.current?.click();
    handleMenuClose(setDataOperationsAnchorEl);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (!imported.years || !Array.isArray(imported.years) || !imported.maintenanceData || !Array.isArray(imported.maintenanceData)) {
          throw new Error('Invalid file format.');
        }
        setImportedFileData(imported);
        setImportConfirmDialogOpen(true);
      } catch (error: any) {
        showSnackbar(`インポートエラー: ${error.message}`, 'error');
      } finally {
        if (importFileInputRef.current) {
          importFileInputRef.current.value = ''; // Clear the input to allow re-importing the same file
        }
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    if (importedFileData) {
      setYears(importedFileData.years);
      setMaintenanceData(importedFileData.maintenanceData);
      setImportConfirmDialogOpen(false);
      setImportedFileData(null);
      showSnackbar('データをインポートしました。', 'success');
    }
  };

  const handleResetDataClick = () => {
    setResetConfirmDialogOpen(true);
    handleMenuClose(setDataOperationsAnchorEl);
  };

  const handleResetConfirm = () => {
    const [transformed, sortedYears] = transformData(rawData as { [id: string]: RawEquipment });
    setMaintenanceData(transformed);
    setYears(sortedYears);
    setResetConfirmDialogOpen(false);
    showSnackbar('データを初期化しました。', 'success');
  };

  const filterData = (data: HierarchicalData[], term: string): HierarchicalData[] => {
    if (!term) return data;

    return data.filter(item => {
      const matches = item.task.toLowerCase().includes(term);
      const childrenMatches = item.children ? filterData(item.children, term).length > 0 : false;
      return matches || childrenMatches;
    }).map(item => ({
      ...item,
      children: item.children ? filterData(item.children, term) : []
    }));
  };

  const displayedMaintenanceData = filterData(maintenanceData, searchTerm.toLowerCase());

  return (
    <div className="container-fluid">
      <h1 className="mb-4">星取表</h1>
      <div className="top-controls-wrapper">
        <div className="search-container">
          <TextField
            id="search-input"
            label="実施項目を検索..."
            variant="outlined"
            size="small"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <FormControlLabel
          control={<Switch checked={viewMode === 'cost'} onChange={handleViewModeChange} />}
          label={viewMode === 'status' ? '星取' : 'コスト'}
          labelPlacement="start"
        />

        {/* Display Settings Dropdown */}
        <Button
          variant="outlined"
          size="small"
          onClick={(e) => handleMenuOpen(e, setDisplaySettingsAnchorEl)}
        >
          表示設定
        </Button>
        <Menu
          anchorEl={displaySettingsAnchorEl}
          open={Boolean(displaySettingsAnchorEl)}
          onClose={() => handleMenuClose(setDisplaySettingsAnchorEl)}
        >
          <MenuItem disabled>表示設定</MenuItem>
          <FormControlLabel control={<Switch defaultChecked />} label="BOMコード" />
          <FormControlLabel control={<Switch defaultChecked />} label="周期" />
        </Menu>

        {/* Year Operations Dropdown */}
        <Button
          variant="outlined"
          size="small"
          onClick={(e) => handleMenuOpen(e, setYearOperationsAnchorEl)}
        >
          年度操作
        </Button>
        <Menu
          anchorEl={yearOperationsAnchorEl}
          open={Boolean(yearOperationsAnchorEl)}
          onClose={() => handleMenuClose(setYearOperationsAnchorEl)}
        >
          <MenuItem onClick={handleAddYearClick}>追加</MenuItem>
          <MenuItem onClick={handleDeleteYearClick}>削除</MenuItem>
        </Menu>

        {/* Data Operations Dropdown */}
        <Button
          variant="outlined"
          size="small"
          onClick={(e) => handleMenuOpen(e, setDataOperationsAnchorEl)}
        >
          データ操作
        </Button>
        <Menu
          anchorEl={dataOperationsAnchorEl}
          open={Boolean(dataOperationsAnchorEl)}
          onClose={() => handleMenuClose(setDataOperationsAnchorEl)}
        >
          <MenuItem onClick={handleExportData}>
            <BsDownload className="me-2" />エクスポート (JSON)
          </MenuItem>
          <MenuItem onClick={handleImportDataClick}>
            <BsUpload className="me-2" />インポート (JSON)
          </MenuItem>
          <MenuItem divider />
          <MenuItem onClick={handleResetDataClick} style={{ color: 'red' }}>
            <MdRefresh className="me-2" />データを初期化
          </MenuItem>
        </Menu>

        <div id="legend-status" className="legend-container ms-auto" style={{ display: viewMode === 'status' ? 'flex' : 'none' }}>
          <small><strong>凡例:</strong><span className="mx-2">〇: 計画</span><span className="actual-mark mx-2">●: 実績</span><span className="summary-mark mx-2">〇 ●: 集計</span></small>
        </div>
        <div id="legend-cost" className="legend-container ms-auto" style={{ display: viewMode === 'cost' ? 'flex' : 'none' }}>
          <small><strong>凡例 (単位: 千円):</strong><span className="mx-2 cost-plan">(123)</span>: 計画<span className="mx-2 cost-actual">(123)</span>: 実績</small>
        </div>
      </div>

      <div className="table-container">
        <table className="table table-bordered table-hover">
          <thead>
            <tr>
              <th className="task-name-col">
                <div className="task-header-content">
                  <span>実施項目</span>
                </div>
              </th>
              <th className="bom-code-col">BOMコード</th>
              <th className="cycle-col">周期(年)</th>
              {years.map(year => (
                <th key={year} className="year-col">{`${year}年度`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedMaintenanceData.map(item => <TableRow key={item.id} item={item} allYears={years} viewMode={viewMode} onUpdateItem={handleUpdateItem} />)}
          </tbody>
        </table>
      </div>

      {/* Add Year Dialog */}
      <Dialog open={addYearDialogOpen} onClose={() => setAddYearDialogOpen(false)}>
        <DialogTitle>年度の追加</DialogTitle>
        <DialogContent>
          <DialogContentText>
            追加する年度を4桁の数字で入力してください。
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="new-year"
            label="年度 (例: 2026)"
            type="number"
            fullWidth
            variant="standard"
            value={newYearInput}
            onChange={(e) => setNewYearInput(e.target.value)}
            error={!!addYearError}
            helperText={addYearError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddYearDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleAddYearConfirm}>追加</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Year Dialog */}
      <Dialog open={deleteYearDialogOpen} onClose={() => setDeleteYearDialogOpen(false)}>
        <DialogTitle>年度の削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            削除する年度を選択してください。データが存在する年度は削除できません。
          </DialogContentText>
          <InputLabel id="delete-year-select-label">年度</InputLabel>
          <Select
            labelId="delete-year-select-label"
            id="delete-year-select"
            value={yearToDelete}
            label="年度"
            onChange={(e) => setYearToDelete(e.target.value as number)}
            fullWidth
            error={!!deleteYearError}
          >
            {years.map(year => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
          {deleteYearError && <DialogContentText color="error">{deleteYearError}</DialogContentText>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteYearDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleDeleteYearConfirm} color="error">削除</Button>
        </DialogActions>
      </Dialog>

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={importFileInputRef}
        onChange={handleFileImport}
        style={{ display: 'none' }}
        accept=".json,application/json"
      />

      {/* Import Confirmation Dialog */}
      <Dialog open={importConfirmDialogOpen} onClose={() => setImportConfirmDialogOpen(false)}>
        <DialogTitle>データのインポート</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ファイルからデータをインポートします。現在の作業内容は上書きされますが、よろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportConfirmDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleImportConfirm}>インポート実行</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetConfirmDialogOpen} onClose={() => setResetConfirmDialogOpen(false)}>
        <DialogTitle>データの初期化</DialogTitle>
        <DialogContent>
          <DialogContentText>
            すべてのデータを初期状態に戻します。この操作は元に戻せません。よろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetConfirmDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleResetConfirm} color="error">初期化する</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => handleSnackbarClose()}>
        <Alert onClose={() => handleSnackbarClose()} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default App;