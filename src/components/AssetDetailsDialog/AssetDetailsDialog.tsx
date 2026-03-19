import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  TextField,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { SpecificationValue } from '../CommonEdit/types';

// Temporarily import types from wherever they are defined
// Assuming HierarchicalData is in '../../types' and HierarchyDefinition is in '../../types/maintenanceTask'
import { HierarchicalData } from '../../types';
import { HierarchyDefinition, HierarchyPath } from '../../types/maintenanceTask';
import { SpecificationEditDialog } from '../SpecificationEditDialog/SpecificationEditDialog';

// Re-using the embedded variant of SpecificationEditDialog
export interface AssetDetailsDialogProps {
  open: boolean;
  item: HierarchicalData | null;
  hierarchy: HierarchyDefinition | null;
  onSave: (updates: {
    assetName?: string;
    bomCode?: string;
    hierarchyPath?: HierarchyPath;
    specifications?: SpecificationValue[];
  }) => void;
  onClose: () => void;
  readOnly?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`asset-tabpanel-${index}`}
      aria-labelledby={`asset-tab-${index}`}
      {...other}
      style={{ height: '100%', display: value === index ? 'flex' : 'none', flexDirection: 'column' }}
    >
      {value === index && (
        <Box sx={{ p: 3, flexGrow: 1, overflow: 'auto' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const AssetDetailsDialog: React.FC<AssetDetailsDialogProps> = ({
  open,
  item,
  hierarchy,
  onSave,
  onClose,
  readOnly = false,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  // Basic Info State
  const [assetName, setAssetName] = useState('');
  const [bomCode, setBomCode] = useState('');
  const [hierarchyPath, setHierarchyPath] = useState<HierarchyPath>({});
  
  // Specifications State
  // We'll use the raw SpecificationValue[] for simplicity in this first iteration
  // or re-use SpecificationEditDialog if we abstract out its popover
  const [specifications, setSpecifications] = useState<SpecificationValue[]>([]);

  // Validation state from the embedded SpecificationEditDialog
  const [specsValid, setSpecsValid] = useState(true);

  // Initialize state when dialog opens
  useEffect(() => {
    if (open && item) {
      setAssetName(item.task || '');
      setBomCode(item.bomCode || '');
      
      // Attempt to parse hierarchy strings back to dict if we only have string
      // In HierarchicalData, hierarchyPath is often a string "A > B > C"
      // But we need the individual level keys
      if (item.hierarchyPath && typeof item.hierarchyPath === 'string' && hierarchy) {
        const parts = item.hierarchyPath.split(' > ');
        const pathObj: HierarchyPath = {};
        const sortedLevels = [...hierarchy.levels].sort((a, b) => a.order - b.order);
        sortedLevels.forEach((level, index) => {
          if (parts[index]) pathObj[level.key] = parts[index];
        });
        setHierarchyPath(pathObj);
      } else if (item.hierarchyPath && typeof item.hierarchyPath === 'object') {
        // Fallback just in case
        setHierarchyPath(item.hierarchyPath as unknown as HierarchyPath);
      } else {
        setHierarchyPath({});
      }

      setSpecifications(item.specifications ? [...item.specifications] : []);
      setActiveTab(0);
    }
  }, [open, item, hierarchy]);

  const sortedLevels = useMemo(() => {
    return hierarchy ? [...hierarchy.levels].sort((a, b) => a.order - b.order) : [];
  }, [hierarchy]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleLevelChange = (levelKey: string, value: string) => {
    setHierarchyPath(prev => ({ ...prev, [levelKey]: value }));
  };

  const handleSpecsChange = useCallback((newSpecs: SpecificationValue[], isValid: boolean) => {
    setSpecifications(newSpecs);
    setSpecsValid(isValid);
  }, []);

  const handleSave = () => {
    if (!item) return;

    // TODO: add validation before saving
    onSave({
      assetName,
      bomCode,
      hierarchyPath,
      specifications,
    });
  };

  if (!item) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">機器詳細</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mt: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<InfoIcon />} iconPosition="start" label="基本情報" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="機器仕様" />
        </Tabs>
      </DialogTitle>

      <DialogContent sx={{ p: 0, flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="機器名 (Asset Name)"
              fullWidth
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              disabled={readOnly}
              size="small"
            />
            <TextField
              label="機器コード (TAG No.)"
              fullWidth
              value={bomCode}
              onChange={(e) => setBomCode(e.target.value)}
              disabled={readOnly}
              size="small"
            />
            
            <Typography variant="subtitle2" sx={{ mt: 1, color: 'text.secondary', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              所属階層 (Hierarchy)
            </Typography>
            
            {hierarchy && sortedLevels.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sortedLevels.map((level) => (
                  <FormControl key={level.key} fullWidth size="small" disabled={readOnly}>
                    <InputLabel>{level.key}</InputLabel>
                    <Select
                      value={hierarchyPath[level.key] || ''}
                      onChange={(e) => handleLevelChange(level.key, e.target.value)}
                      label={level.key}
                    >
                      {level.values.map(val => (
                        <MenuItem key={val} value={val}>{val}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ))}
              </Box>
            ) : (
              <Alert severity="info">階層定義がありません</Alert>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <SpecificationEditDialog
              open={true}
              specifications={specifications}
              variant="embedded"
              onChange={handleSpecsChange}
              onSave={() => {}}
              onClose={() => {}}
              readOnly={readOnly}
            />
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose}>キャンセル</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={readOnly || !specsValid} 
          startIcon={<SaveIcon />}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetDetailsDialog;
