/**
 * SkillRunner — スキル実行ダイアログ
 *
 * Phase 4C: Skill の一覧表示・パラメータ入力・実行・進捗表示
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Button,
  Chip,
  Card,
  CardActionArea,
  TextField,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  FormGroup,
} from '@mui/material';
import {
  Close as CloseIcon,
  AutoFixHigh as SkillIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import type { SkillDefinition, SkillExecutionProgress, SkillExecutionLog } from '../../services/integration/types';
import {
  fetchSkills,
  executeSkill,
  getSkillExecutionStatus,
} from '../../services/integration/pluginApi';
import './SkillRunner.css';

interface SkillRunnerProps {
  open: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, string> = {
  download: '📥',
  upload: '📤',
  chart: '📊',
  search: '🔍',
  sync: '🔄',
  default: '⚡',
};

export const SkillRunner: React.FC<SkillRunnerProps> = ({ open, onClose }) => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<SkillExecutionProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load skills
  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSkills();
      setSkills(data);
    } catch (e) {
      console.error('Failed to load skills:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSkills();
      setSelectedSkill(null);
      setExecutionProgress(null);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [open, loadSkills]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executionProgress?.logs]);

  // Select a skill
  const handleSelectSkill = (skill: SkillDefinition) => {
    setSelectedSkill(skill);
    setExecutionProgress(null);
    // Initialize default param values
    const defaults: Record<string, unknown> = {};
    skill.parameters.forEach(p => {
      if (p.default !== undefined) {
        defaults[p.name] = p.default;
      }
    });
    setParamValues(defaults);
  };

  // Execute
  const handleExecute = async () => {
    if (!selectedSkill) return;

    // Safety: confirmation if required
    if (selectedSkill.safety?.requires_confirmation) {
      if (!window.confirm(`「${selectedSkill.name}」を実行しますか？\nこの操作はデータを変更する可能性があります。`)) {
        return;
      }
    }

    setExecuting(true);
    try {
      const result = await executeSkill(selectedSkill.id, paramValues);
      const executionId = result.execution_id;

      // Start polling
      pollingRef.current = setInterval(async () => {
        try {
          const status = await getSkillExecutionStatus(executionId);
          setExecutionProgress(status);

          if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setExecuting(false);
          }
        } catch (e) {
          console.error('Failed to poll execution status:', e);
        }
      }, 1000);
    } catch (e) {
      console.error('Failed to execute skill:', e);
      setExecuting(false);
    }
  };

  const getSkillIcon = (icon: string) => ICON_MAP[icon] || ICON_MAP.default;

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('ja-JP', { hour12: false });
    } catch {
      return '';
    }
  };

  const builtinSkills = skills.filter(s => s.type === 'builtin');
  const userSkills = skills.filter(s => s.type === 'user');

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
        スキル実行
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2, pt: 1, minHeight: '380px' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <>
            {builtinSkills.length > 0 && (
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  ビルトインスキル
                </Typography>
                {builtinSkills.map(skill => (
                  <Card 
                    key={skill.id} 
                    variant="outlined"
                    sx={{ 
                      mb: 1, 
                      borderColor: selectedSkill?.id === skill.id ? 'primary.main' : 'divider',
                      bgcolor: selectedSkill?.id === skill.id ? 'action.selected' : 'background.paper'
                    }}
                  >
                    <CardActionArea onClick={() => handleSelectSkill(skill)} sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start' }}>
                      <Box sx={{ fontSize: 28, mr: 2, display: 'flex', alignItems: 'center' }}>
                        {getSkillIcon(skill.icon)}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold">{skill.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{skill.description}</Typography>
                      </Box>
                      <Chip size="small" label="builtin" color="success" variant="outlined" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            )}

            {userSkills.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  ユーザースキル
                </Typography>
                {userSkills.map(skill => (
                  <Card 
                    key={skill.id} 
                    variant="outlined"
                    sx={{ 
                      mb: 1, 
                      borderColor: selectedSkill?.id === skill.id ? 'primary.main' : 'divider',
                      bgcolor: selectedSkill?.id === skill.id ? 'action.selected' : 'background.paper'
                    }}
                  >
                    <CardActionArea onClick={() => handleSelectSkill(skill)} sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start' }}>
                      <Box sx={{ fontSize: 28, mr: 2, display: 'flex', alignItems: 'center' }}>
                        {getSkillIcon(skill.icon)}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold">{skill.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{skill.description}</Typography>
                      </Box>
                      <Chip size="small" label="user" color="secondary" variant="outlined" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            )}

            {skills.length === 0 && (
              <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                利用可能なスキルがありません。
              </Typography>
            )}

            {selectedSkill && selectedSkill.parameters.length > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 'bold' }}>
                  パラメータ — {selectedSkill.name}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {selectedSkill.parameters.map(param => (
                    <Box key={param.name}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {param.label} {param.required && '*'}
                      </Typography>

                      {param.type === 'text' && (
                        <TextField
                          size="small"
                          fullWidth
                          value={(paramValues[param.name] as string) || ''}
                          onChange={(e) => setParamValues(prev => ({
                            ...prev,
                            [param.name]: e.target.value,
                          }))}
                        />
                      )}

                      {param.type === 'number' && (
                        <TextField
                          size="small"
                          fullWidth
                          type="number"
                          value={(paramValues[param.name] as number) || ''}
                          onChange={(e) => setParamValues(prev => ({
                            ...prev,
                            [param.name]: Number(e.target.value),
                          }))}
                        />
                      )}

                      {param.type === 'select' && (
                        <Select
                          size="small"
                          fullWidth
                          displayEmpty
                          value={(paramValues[param.name] as string) || ''}
                          onChange={(e) => setParamValues(prev => ({
                            ...prev,
                            [param.name]: e.target.value,
                          }))}
                        >
                          <MenuItem value="" disabled>選択してください</MenuItem>
                          {param.options?.map(opt => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                          ))}
                        </Select>
                      )}

                      {param.type === 'multi_select' && (
                        <FormGroup row>
                          {param.options?.map(opt => (
                            <FormControlLabel
                              key={opt}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={
                                    Array.isArray(paramValues[param.name])
                                      ? (paramValues[param.name] as string[]).includes(opt)
                                      : false
                                  }
                                  onChange={(e) => {
                                    const current = Array.isArray(paramValues[param.name])
                                      ? [...(paramValues[param.name] as string[])]
                                      : [];
                                    if (e.target.checked) current.push(opt);
                                    else {
                                      const idx = current.indexOf(opt);
                                      if (idx >= 0) current.splice(idx, 1);
                                    }
                                    setParamValues(prev => ({ ...prev, [param.name]: current }));
                                  }}
                                />
                              }
                              label={<Typography variant="body2">{opt}</Typography>}
                            />
                          ))}
                        </FormGroup>
                      )}

                      {param.type === 'boolean' && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={!!paramValues[param.name]}
                              onChange={(e) => setParamValues(prev => ({
                                ...prev,
                                [param.name]: e.target.checked,
                              }))}
                            />
                          }
                          label={<Typography variant="body2">有効</Typography>}
                        />
                       )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {executionProgress && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {executionProgress.currentStep || '実行中...'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {executionProgress.progress}%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={executionProgress.progress} sx={{ height: 6, borderRadius: 3, mb: 2 }} />
                
                {executionProgress.logs && executionProgress.logs.length > 0 && (
                  <Box sx={{ bgcolor: '#0a0a0a', p: 1.5, borderRadius: 1, border: 1, borderColor: '#1a1a1a', maxHeight: 200, overflowY: 'auto' }}>
                    {executionProgress.logs.map((log: SkillExecutionLog, i: number) => (
                      <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {formatTime(log.timestamp)}
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: log.level === 'error' ? 'error.main' : log.level === 'warning' ? 'warning.main' : 'text.primary',
                          fontFamily: 'monospace' 
                        }}>
                          {log.message}
                        </Typography>
                      </Box>
                    ))}
                    <div ref={logEndRef} />
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={executing}>
          キャンセル
        </Button>
        {selectedSkill && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleExecute}
            disabled={executing}
            startIcon={executing ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
          >
            {executing ? '実行中...' : '実行'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
