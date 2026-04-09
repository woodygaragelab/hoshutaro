/**
 * SkillRunner — スキル実行ダイアログ
 *
 * Phase 4C: Skill の一覧表示・パラメータ入力・実行・進捗表示
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // Group skills by type
  const builtinSkills = skills.filter(s => s.type === 'builtin');
  const userSkills = skills.filter(s => s.type === 'user');

  if (!open) return null;

  return (
    <div className="skill-runner-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="skill-runner-dialog">

        {/* Header */}
        <div className="sr-header">
          <div className="sr-header-title">
            <SkillIcon sx={{ fontSize: 18 }} />
            スキル実行
          </div>
          <button className="sr-close-btn" onClick={onClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Content */}
        <div className="sr-content">
          {loading && <div className="pm-empty">読み込み中...</div>}

          {!loading && (
            <>
              {/* Built-in Skills */}
              {builtinSkills.length > 0 && (
                <>
                  <div className="sr-section-label">ビルトインスキル</div>
                  {builtinSkills.map(skill => (
                    <div
                      key={skill.id}
                      className={`sr-skill-card ${selectedSkill?.id === skill.id ? 'selected' : ''}`}
                      onClick={() => handleSelectSkill(skill)}
                    >
                      <div className="sr-skill-icon">{getSkillIcon(skill.icon)}</div>
                      <div className="sr-skill-body">
                        <div className="sr-skill-name">{skill.name}</div>
                        <div className="sr-skill-desc">{skill.description}</div>
                      </div>
                      <span className="sr-skill-type-badge builtin">builtin</span>
                    </div>
                  ))}
                </>
              )}

              {/* User Skills */}
              {userSkills.length > 0 && (
                <>
                  <div className="sr-section-label">ユーザースキル</div>
                  {userSkills.map(skill => (
                    <div
                      key={skill.id}
                      className={`sr-skill-card ${selectedSkill?.id === skill.id ? 'selected' : ''}`}
                      onClick={() => handleSelectSkill(skill)}
                    >
                      <div className="sr-skill-icon">{getSkillIcon(skill.icon)}</div>
                      <div className="sr-skill-body">
                        <div className="sr-skill-name">{skill.name}</div>
                        <div className="sr-skill-desc">{skill.description}</div>
                      </div>
                      <span className="sr-skill-type-badge user">user</span>
                    </div>
                  ))}
                </>
              )}

              {skills.length === 0 && (
                <div className="pm-empty">利用可能なスキルがありません。</div>
              )}

              {/* Parameters Form */}
              {selectedSkill && selectedSkill.parameters.length > 0 && (
                <div className="sr-params-section">
                  <div className="sr-params-title">
                    パラメータ — {selectedSkill.name}
                  </div>
                  {selectedSkill.parameters.map(param => (
                    <div key={param.name} className="sr-param-field">
                      <label className="sr-param-label">
                        {param.label} {param.required && '*'}
                      </label>

                      {param.type === 'text' && (
                        <input
                          className="sr-param-input"
                          type="text"
                          value={(paramValues[param.name] as string) || ''}
                          onChange={(e) => setParamValues(prev => ({
                            ...prev,
                            [param.name]: e.target.value,
                          }))}
                        />
                      )}

                      {param.type === 'number' && (
                        <input
                          className="sr-param-input"
                          type="number"
                          value={(paramValues[param.name] as number) || ''}
                          onChange={(e) => setParamValues(prev => ({
                            ...prev,
                            [param.name]: Number(e.target.value),
                          }))}
                        />
                      )}

                      {param.type === 'select' && (
                        <select
                          className="sr-param-select"
                          value={(paramValues[param.name] as string) || ''}
                          onChange={(e) => setParamValues(prev => ({
                            ...prev,
                            [param.name]: e.target.value,
                          }))}
                        >
                          <option value="">選択してください</option>
                          {param.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {param.type === 'multi_select' && (
                        <div className="sr-param-checkbox-group">
                          {param.options?.map(opt => (
                            <label key={opt} className="sr-param-checkbox">
                              <input
                                type="checkbox"
                                checked={
                                  Array.isArray(paramValues[param.name])
                                    ? (paramValues[param.name] as string[]).includes(opt)
                                    : false
                                }
                                onChange={(e) => {
                                  const current = Array.isArray(paramValues[param.name])
                                    ? [...(paramValues[param.name] as string[])]
                                    : [];
                                  if (e.target.checked) {
                                    current.push(opt);
                                  } else {
                                    const idx = current.indexOf(opt);
                                    if (idx >= 0) current.splice(idx, 1);
                                  }
                                  setParamValues(prev => ({
                                    ...prev,
                                    [param.name]: current,
                                  }));
                                }}
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      )}

                      {param.type === 'boolean' && (
                        <label className="sr-param-checkbox">
                          <input
                            type="checkbox"
                            checked={!!paramValues[param.name]}
                            onChange={(e) => setParamValues(prev => ({
                              ...prev,
                              [param.name]: e.target.checked,
                            }))}
                          />
                          有効
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Execution Progress */}
              {executionProgress && (
                <div className="sr-execution-section">
                  <div className="sr-execution-header">
                    <span style={{ fontSize: 12, color: '#aaa' }}>
                      {executionProgress.currentStep || '実行中...'}
                    </span>
                    <span style={{ fontSize: 11, color: '#666' }}>
                      {executionProgress.progress}%
                    </span>
                  </div>
                  <div className="sr-progress-bar">
                    <div
                      className="sr-progress-fill"
                      style={{ width: `${executionProgress.progress}%` }}
                    />
                  </div>
                  {executionProgress.logs && executionProgress.logs.length > 0 && (
                    <div className="sr-log-container">
                      {executionProgress.logs.map((log: SkillExecutionLog, i: number) => (
                        <div key={i} className="sr-log-entry">
                          <span className="sr-log-time">{formatTime(log.timestamp)}</span>
                          <span className={`sr-log-msg ${log.level}`}>{log.message}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Execute Bar */}
        {selectedSkill && (
          <div className="sr-execute-bar">
            <button
              className="sr-execute-btn"
              onClick={handleExecute}
              disabled={executing}
            >
              <PlayIcon sx={{ fontSize: 16 }} />
              {executing ? '実行中...' : '実行'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
