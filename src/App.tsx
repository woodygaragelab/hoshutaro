import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import './styles/responsive.css';
import './styles/grid-text-fix.css';
import './styles/performance.css';
import rawData from './data/equipments.json';
import { HierarchicalData, RawEquipment } from './types';
import { usePerformanceMonitor } from './utils/performanceMonitor';
import { useAccessibility } from './utils/accessibility';
import PerformanceMonitor from './components/PerformanceMonitor';


import EnhancedMaintenanceGrid from './components/EnhancedMaintenanceGrid/EnhancedMaintenanceGrid';
import AIAssistantPanel from './components/AIAssistant/AIAssistantPanel';
import { transformData } from './utils/dataTransformer';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, Snackbar, Alert, SelectChangeEvent, FormControl, Button, TextField, ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme } from './theme/darkTheme';

const App: React.FC = () => {
  // Performance and accessibility hooks
  const { measureAsync, recordMetric } = usePerformanceMonitor();
  const { announce, setupGridKeyboardNavigation } = useAccessibility();
  
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

  // UI component states (dialogs only)
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
  
  // Display area mode for EnhancedMaintenanceGrid
  const [displayMode, setDisplayMode] = useState<'specifications' | 'maintenance' | 'both'>('both');

  // AI Assistant states
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [aiAssistantWidth] = useState(400);

  useEffect(() => {
    const loadData = async () => {
      const [flatData, headers, filterTree] = transformData(rawData as { [id: string]: RawEquipment }, timeScale);
      setMaintenanceData(flatData);
      setTimeHeaders(headers);
      setHierarchyFilterTree(filterTree);
      
      // Announce data load completion for screen readers
      announce(`データが読み込まれました。${flatData.length}件の設備データが表示されています。`);
    };

    measureAsync('data-transformation', 'render', loadData);
  }, [timeScale]); // Remove measureAsync and announce from dependencies

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



  // Handle specification editing
  const handleSpecificationEdit = (rowId: string, specIndex: number, key: string, value: string) => {
    setMaintenanceData(prevData => 
      prevData.map(item => {
        if (item.id === rowId) {
          const updatedSpecs = [...(item.specifications || [])];
          
          // Ensure the specification exists
          while (updatedSpecs.length <= specIndex) {
            updatedSpecs.push({ key: '', value: '', order: updatedSpecs.length });
          }
          
          // Update the specification
          if (key === 'key') {
            updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], key: value };
          } else if (key === 'value') {
            updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], value: value };
          }
          
          return { ...item, specifications: updatedSpecs };
        }
        return item;
      })
    );
  };

  // Handle cell editing for EnhancedMaintenanceGrid
  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    setMaintenanceData(prevData => 
      prevData.map(item => {
        if (item.id === rowId) {
          if (columnId === 'task') {
            return { ...item, task: value };
          } else if (columnId === 'cycle') {
            return { ...item, cycle: value };
          } else if (columnId.startsWith('time_')) {
            const timeHeader = columnId.replace('time_', '');
            const updatedResults = { ...item.results };
            
            if (viewMode === 'cost') {
              updatedResults[timeHeader] = {
                ...updatedResults[timeHeader],
                planCost: value.planCost || 0,
                actualCost: value.actualCost || 0
              };
            } else {
              updatedResults[timeHeader] = {
                ...updatedResults[timeHeader],
                planned: value.planned || false,
                actual: value.actual || false
              };
            }
            
            return { ...item, results: updatedResults };
          }
        }
        return item;
      })
    );
  };



  // --- Year Operations ---
  const handleAddYearClick = () => {
    setAddYearDialogOpen(true);
    setNewYearInput('');
    setAddYearError('');
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
    showSnackbar('データをエクスポートしました。', 'success');
  };

  const handleImportDataClick = () => {
    importFileInputRef.current?.click();
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
  };

  const handleResetConfirm = () => {
    const [flatData, headers, filterTree] = transformData(rawData as { [id: string]: RawEquipment }, timeScale);
    setMaintenanceData(flatData);
    setTimeHeaders(headers);
    setHierarchyFilterTree(filterTree);
    setResetConfirmDialogOpen(false);
    showSnackbar('データを初期化しました。', 'success');
  };



  // AI Assistant handlers
  const handleAIAssistantToggle = () => {
    setIsAIAssistantOpen(!isAIAssistantOpen);
  };

  const handleAIAssistantClose = () => {
    setIsAIAssistantOpen(false);
  };

  // Desktop-only layout calculations
  const containerPadding = 16;
  const gridHeight = 'calc(100vh - 140px)';
  const mainContentWidth = isAIAssistantOpen ? `calc(100% - ${aiAssistantWidth}px)` : '100%';

  // Set up keyboard navigation for the grid
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gridRef.current) {
      const cleanup = setupGridKeyboardNavigation(gridRef.current, {
        enableArrowKeys: true,
        enableTabNavigation: true,
        enableEnterActivation: true,
        enableEscapeClose: true,
        announceChanges: true,
      });
      return cleanup;
    }
  }, [setupGridKeyboardNavigation]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <PerformanceMonitor enabled={false} />
      <div 
        className="responsive-container critical-loading desktop-layout"
        role="application"
        aria-label="HOSHUTARO 保全管理システム"
      >

      
        {/* Main Content Area */}
        <div 
          style={{ 
            display: 'flex',
            width: '100%',
            height: gridHeight,
          }}
        >
          {/* Enhanced Maintenance Grid */}
          <div 
            ref={gridRef}
            className="grid-container-responsive grid-performance"
            style={{ 
              padding: `${containerPadding}px`, 
              height: '100%',
              overflow: 'hidden',
              width: mainContentWidth,
              transition: 'width 0.3s ease',
            }}
            role="grid"
            aria-label="保全計画データグリッド"
            aria-rowcount={displayedMaintenanceData.length}
            aria-colcount={timeHeaders.length + 3}
          >
            <EnhancedMaintenanceGrid
              data={displayedMaintenanceData}
              timeHeaders={timeHeaders}
              viewMode={viewMode}
              displayMode={displayMode}
              showBomCode={showBomCode}
              showCycle={showCycle}
              onCellEdit={handleCellEdit}
              onSpecificationEdit={handleSpecificationEdit}
              onUpdateItem={handleUpdateItem}
              groupedData={groupedData}
              virtualScrolling={displayedMaintenanceData.length > 100}
              readOnly={false}
              // Integrated toolbar props
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              level1Filter={level1Filter}
              level2Filter={level2Filter}
              level3Filter={level3Filter}
              onLevel1FilterChange={handleLevel1FilterChange}
              onLevel2FilterChange={handleLevel2FilterChange}
              onLevel3FilterChange={(e) => setLevel3Filter(e.target.value)}
              hierarchyFilterTree={hierarchyFilterTree}
              level2Options={level2Options}
              level3Options={level3Options}
              onViewModeChange={handleViewModeChange}
              timeScale={timeScale}
              onTimeScaleChange={(e: SelectChangeEvent) => setTimeScale(e.target.value as 'year' | 'month' | 'week' | 'day')}
              onShowBomCodeChange={setShowBomCode}
              onShowCycleChange={setShowCycle}
              onDisplayModeChange={setDisplayMode}
              onAddYear={handleAddYearClick}
              onDeleteYear={handleDeleteYearClick}
              onExportData={handleExportData}
              onImportData={handleImportDataClick}
              onResetData={handleResetDataClick}
              onAIAssistantToggle={handleAIAssistantToggle}
              isAIAssistantOpen={isAIAssistantOpen}
            />
          </div>

          {/* AI Assistant Panel - Desktop only */}
          {isAIAssistantOpen && (
            <div 
              style={{ 
                width: aiAssistantWidth,
                height: '100%',
                borderLeft: '1px solid #333333',
                backgroundColor: '#000000',
              }}
            >
              <AIAssistantPanel
                isOpen={isAIAssistantOpen}
                onClose={handleAIAssistantClose}
                onSuggestionApply={(suggestion) => {
                  // Apply AI suggestion to maintenance data
                  handleCellEdit(
                    suggestion.equipmentId,
                    `time_${suggestion.timeHeader}`,
                    suggestion.suggestedAction === 'plan' 
                      ? { planned: true, actual: false }
                      : suggestion.suggestedAction === 'actual'
                      ? { planned: false, actual: true }
                      : { planned: true, actual: true }
                  );
                }}
                onExcelImport={(file) => {
                  // Handle Excel file import
                  console.log('Excel file imported:', file.name);
                  showSnackbar(`Excelファイル "${file.name}" をインポートしました`, 'success');
                }}
              />
            </div>
          )}
        </div>

      {/* Add Year Dialog */}
      <Dialog open={addYearDialogOpen} onClose={() => setAddYearDialogOpen(false)}>
        <DialogTitle>年度追加</DialogTitle>
        <DialogContent>
          <DialogContentText>
            追加する年度を入力してください。
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="年度"
            type="number"
            fullWidth
            variant="outlined"
            value={newYearInput}
            onChange={(e) => setNewYearInput(e.target.value)}
            error={!!addYearError}
            helperText={addYearError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddYearDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleAddYearConfirm} variant="contained">追加</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Year Dialog */}
      <Dialog open={deleteYearDialogOpen} onClose={() => setDeleteYearDialogOpen(false)}>
        <DialogTitle>年度削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            削除する年度を選択してください。
          </DialogContentText>
          <FormControl fullWidth margin="dense">
            <Select
              value={yearToDelete}
              onChange={(e) => setYearToDelete(e.target.value)}
              displayEmpty
            >
              <option value="">選択してください</option>
              {timeHeaders.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </Select>
          </FormControl>
          {deleteYearError && (
            <DialogContentText color="error">
              {deleteYearError}
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteYearDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleDeleteYearConfirm} variant="contained" color="error">削除</Button>
        </DialogActions>
      </Dialog>

      {/* Import File Input */}
      <input 
        type="file" 
        ref={importFileInputRef} 
        onChange={handleFileImport} 
        style={{ display: 'none' }} 
        accept=".json,application/json" 
      />

      {/* Import Confirmation Dialog */}
      <Dialog open={importConfirmDialogOpen} onClose={() => setImportConfirmDialogOpen(false)}>
        <DialogTitle>データインポート確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            インポートしたデータで現在のデータを置き換えますか？この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportConfirmDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleImportConfirm} variant="contained" color="warning">インポート</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetConfirmDialogOpen} onClose={() => setResetConfirmDialogOpen(false)}>
        <DialogTitle>データ初期化確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            すべてのデータを初期状態に戻しますか？この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetConfirmDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleResetConfirm} variant="contained" color="error">初期化</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000} 
        onClose={() => handleSnackbarClose()}
      >
        <Alert 
          onClose={() => handleSnackbarClose()} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
      </div>
    </ThemeProvider>
  );
};

export default App;
