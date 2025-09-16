import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import rawData from './data/equipments.json';
import { HierarchicalData, RawEquipment } from './types';
import TableRow from './components/TableRow';
import { transformData } from './utils/dataTransformer';
import { Switch, FormControlLabel, TextField, Button, Menu, MenuItem, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, InputLabel, Snackbar, Alert, SelectChangeEvent, FormControl, Grid } from '@mui/material';
import { BsDownload, BsUpload } from 'react-icons/bs';
import { MdRefresh } from 'react-icons/md';

const App: React.FC = () => {
  // Data states
  const [maintenanceData, setMaintenanceData] = useState<HierarchicalData[]>([]);
  const [timeHeaders, setTimeHeaders] = useState<string[]>([]);
  const [hierarchyFilterTree, setHierarchyFilterTree] = useState<any>(null);

  // Control states
  const [timeScale, setTimeScale] = useState<'year' | 'month' | 'week' | 'day'>('year');
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Filter states
  const [level1Filter, setLevel1Filter] = useState<string>('all');
  const [level2Filter, setLevel2Filter] = useState<string>('all');
  const [level3Filter, setLevel3Filter] = useState<string>('all');

  // UI component states
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

  // Display toggles
  const [showBomCode, setShowBomCode] = useState(true);
  const [showCycle, setShowCycle] = useState(true);

  useEffect(() => {
    const [flatData, headers, filterTree] = transformData(rawData as { [id: string]: RawEquipment }, timeScale);
    setMaintenanceData(flatData);
    setTimeHeaders(headers);
    setHierarchyFilterTree(filterTree);
  }, [timeScale]);

  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    setMaintenanceData(prevData => 
      prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
  };

  // --- Filtering Logic ---
  const level2Options = level1Filter !== 'all' && hierarchyFilterTree ? Object.keys(hierarchyFilterTree.children[level1Filter]?.children || {}) : [];
  const level3Options = level1Filter !== 'all' && level2Filter !== 'all' && hierarchyFilterTree ? Object.keys(hierarchyFilterTree.children[level1Filter]?.children[level2Filter]?.children || {}) : [];

  const handleLevel1FilterChange = (event: SelectChangeEvent) => {
    setLevel1Filter(event.target.value);
    setLevel2Filter('all');
    setLevel3Filter('all');
  };
  const handleLevel2FilterChange = (event: SelectChangeEvent) => {
    setLevel2Filter(event.target.value);
    setLevel3Filter('all');
  };

  const displayedMaintenanceData = maintenanceData.filter(item => {
    const searchTermMatch = item.task.toLowerCase().includes(searchTerm.toLowerCase());

    const hierarchyPath = item.hierarchyPath || '';
    const pathParts = hierarchyPath.split(' > ');

    const level1Match = level1Filter === 'all' || pathParts[0] === level1Filter;
    const level2Match = level2Filter === 'all' || pathParts[1] === level2Filter;
    const level3Match = level3Filter === 'all' || pathParts[2] === level3Filter;

    return searchTermMatch && level1Match && level2Match && level3Match;
  });

  // Group data for rendering
  const groupedData = useMemo(() => {
    return displayedMaintenanceData.reduce((acc, item) => {
      const path = item.hierarchyPath || 'Uncategorized';
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(item);
      return acc;
    }, {} as { [key: string]: HierarchicalData[] });
  }, [displayedMaintenanceData]);


  // --- UI Handlers ---
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (reason?: string) => {
    if (reason === 'clickaway') return;
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
    if (timeHeaders.includes(String(year))) {
      setAddYearError('その年度は既に存在します。');
      return;
    }
    setTimeHeaders(prev => [...prev, String(year)].sort());
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
    const year = yearToDelete as string;
    const hasData = maintenanceData.some(item => Object.keys(item.results).some(timeKey => timeKey.startsWith(year)));
    if (hasData) {
      setDeleteYearError('この年度にはデータが存在するため削除できません。');
      return;
    }
    setTimeHeaders(prev => prev.filter(y => y !== year));
    setDeleteYearDialogOpen(false);
    showSnackbar('年度が削除されました。', 'success');
  };

  // --- Data Operations ---
  const handleExportData = () => {
    const dataToExport = { timeHeaders, maintenanceData, timeScale };
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
        if (!imported.timeHeaders || !Array.isArray(imported.timeHeaders) || !imported.maintenanceData || !Array.isArray(imported.maintenanceData)) {
          throw new Error('Invalid file format.');
        }
        setImportedFileData(imported);
        setImportConfirmDialogOpen(true);
      } catch (error: any) {
        showSnackbar(`インポートエラー: ${error.message}`, 'error');
      } finally {
        if (importFileInputRef.current) {
          importFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    if (importedFileData) {
      // This needs to be adapted for the new flat structure if we want to keep import/export
      setTimeHeaders(importedFileData.timeHeaders);
      setMaintenanceData(importedFileData.maintenanceData);
      setTimeScale(importedFileData.timeScale || 'year');
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
    const [flatData, headers, filterTree] = transformData(rawData as { [id: string]: RawEquipment }, timeScale);
    setMaintenanceData(flatData);
    setTimeHeaders(headers);
    setHierarchyFilterTree(filterTree);
    setResetConfirmDialogOpen(false);
    showSnackbar('データを初期化しました。', 'success');
  };

  const totalColumns = (showBomCode ? 1 : 0) + (showCycle ? 1 : 0) + timeHeaders.length + 1; // +1 for task name

  return (
    <div className="container-fluid">
      <h1 className="mb-4">星取表</h1>
      <div className="top-controls-wrapper">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              id="search-input"
              label="機器を検索..."
              variant="outlined"
              size="small"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Grid>

          {/* Hierarchy Filters */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>階層レベル1</InputLabel>
              <Select value={level1Filter} label="階層レベル1" onChange={handleLevel1FilterChange}>
                <MenuItem value="all">すべて</MenuItem>
                {hierarchyFilterTree && Object.keys(hierarchyFilterTree.children).map(name => (
                  <MenuItem key={name} value={name}>{name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small" disabled={level1Filter === 'all'}>
              <InputLabel>階層レベル2</InputLabel>
              <Select value={level2Filter} label="階層レベル2" onChange={handleLevel2FilterChange}>
                <MenuItem value="all">すべて</MenuItem>
                {level2Options.map(name => (
                  <MenuItem key={name} value={name}>{name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small" disabled={level2Filter === 'all'}>
              <InputLabel>階層レベル3</InputLabel>
              <Select value={level3Filter} label="階層レベル3" onChange={(e) => setLevel3Filter(e.target.value)}>
                <MenuItem value="all">すべて</MenuItem>
                {level3Options.map(name => (
                  <MenuItem key={name} value={name}>{name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={12} md="auto" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span>星取</span>
              <Switch checked={viewMode === 'cost'} onChange={handleViewModeChange} color="primary" />
              <span>コスト</span>
            </div>

            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel>スケール</InputLabel>
              <Select value={timeScale} label="スケール" onChange={(e: SelectChangeEvent) => setTimeScale(e.target.value as 'year' | 'month' | 'week' | 'day')}>
                <MenuItem value="year">年度</MenuItem>
                <MenuItem value="month">月</MenuItem>
                <MenuItem value="week">週</MenuItem>
                <MenuItem value="day">日</MenuItem>
              </Select>
            </FormControl>

            <Button variant="outlined" size="small" onClick={(e) => handleMenuOpen(e, setDisplaySettingsAnchorEl)}>表示設定</Button>
            <Menu anchorEl={displaySettingsAnchorEl} open={Boolean(displaySettingsAnchorEl)} onClose={() => handleMenuClose(setDisplaySettingsAnchorEl)}>
              <MenuItem>
                <FormControlLabel control={<Switch checked={showBomCode} onChange={(e) => setShowBomCode(e.target.checked)} />} label="TAG No." />
              </MenuItem>
              <MenuItem>
                <FormControlLabel control={<Switch checked={showCycle} onChange={(e) => setShowCycle(e.target.checked)} />} label="周期" />
              </MenuItem>
            </Menu>

            <Button variant="outlined" size="small" onClick={(e) => handleMenuOpen(e, setYearOperationsAnchorEl)} disabled={timeScale !== 'year'}>年度操作</Button>
            <Menu anchorEl={yearOperationsAnchorEl} open={Boolean(yearOperationsAnchorEl)} onClose={() => handleMenuClose(setYearOperationsAnchorEl)}>
              <MenuItem onClick={handleAddYearClick}>追加</MenuItem>
              <MenuItem onClick={handleDeleteYearClick}>削除</MenuItem>
            </Menu>

            <Button variant="outlined" size="small" onClick={(e) => handleMenuOpen(e, setDataOperationsAnchorEl)}>データ操作</Button>
            <Menu anchorEl={dataOperationsAnchorEl} open={Boolean(dataOperationsAnchorEl)} onClose={() => handleMenuClose(setDataOperationsAnchorEl)}>
              <MenuItem onClick={handleExportData}><BsDownload className="me-2" />エクスポート (JSON)</MenuItem>
              <MenuItem onClick={handleImportDataClick}><BsUpload className="me-2" />インポート (JSON)</MenuItem>
              <MenuItem divider />
              <MenuItem onClick={handleResetDataClick} style={{ color: 'red' }}><MdRefresh className="me-2" />データを初期化</MenuItem>
            </Menu>
          </Grid>

          <Grid item xs={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div id="legend-status" className="legend-container" style={{ display: viewMode === 'status' ? 'flex' : 'none' }}>
              <small><strong>凡例:</strong><span className="mx-2">〇: 計画</span><span className="actual-mark mx-2">●: 実績</span><span className="mx-2">◎: 計画と実績</span></small>
            </div>
            <div id="legend-cost" className="legend-container" style={{ display: viewMode === 'cost' ? 'flex' : 'none' }}>
              <small><strong>凡例 (単位: 千円):</strong><span className="mx-2 cost-plan">(123)</span>: 計画<span className="mx-2 cost-actual">(123)</span>: 実績</small>
            </div>
          </Grid>
        </Grid>
      </div>

      <div className="table-container">
        <table className="table table-bordered table-hover">
          <thead>
            <tr>
              <th className="task-name-col">機器</th>
              {showBomCode && <th className="bom-code-col">TAG No.</th>}
              {showCycle && <th className="cycle-col">周期(年)</th>}
              {timeHeaders.map(header => (
                <th key={header} className="year-col">{timeScale === 'year' ? `${header}年度` : header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedData).map(([hierarchyPath, items]) => (
              <React.Fragment key={hierarchyPath}>
                <tr className="group-header-row">
                  <td colSpan={totalColumns}>{
                    hierarchyPath
                  }</td>
                </tr>
                {items.map(item => (
                  <TableRow key={item.id} item={item} allTimeHeaders={timeHeaders} viewMode={viewMode} onUpdateItem={handleUpdateItem} showBomCode={showBomCode} showCycle={showCycle} />
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialogs and other components... (no changes) */}
      <Dialog open={addYearDialogOpen} onClose={() => setAddYearDialogOpen(false)}>{/*...*/}</Dialog>
      <Dialog open={deleteYearDialogOpen} onClose={() => setDeleteYearDialogOpen(false)}>{/*...*/}</Dialog>
      <input type="file" ref={importFileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".json,application/json" />
      <Dialog open={importConfirmDialogOpen} onClose={() => setImportConfirmDialogOpen(false)}>{/*...*/}</Dialog>
      <Dialog open={resetConfirmDialogOpen} onClose={() => setResetConfirmDialogOpen(false)}>{/*...*/}</Dialog>
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => handleSnackbarClose()}><Alert onClose={() => handleSnackbarClose()} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert></Snackbar>
    </div>
  );
};

export default App;
