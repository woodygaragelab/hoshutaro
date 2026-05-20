import React, { useState, useRef, useEffect } from 'react';
import {
  IconButton, Typography, CircularProgress, Avatar, Button, Chip,
  Dialog, DialogContent, DialogTitle
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  CalendarMonth as CalendarIcon,
  ViewList as DisplayModeIcon,
  SwapHoriz as ViewModeIcon,
  Star as AIIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  AccountTree as HierarchyIcon,
  FileUpload as UploadFileIcon,
  FileDownload as DownloadFileIcon,
  ChatBubbleOutline as ChatIcon,
  Build as ToolsIcon,
  Event as DateRangeIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import type { ChatMessage, MaintenanceSuggestion } from '../AIAssistant/types';
import type { Asset, WorkOrder, WorkOrderLine, DataModel } from '../../types/maintenanceTask';
import { startChatStream, SSEEvent } from '../../services/sseClient';
import { useUIContextStore } from '../../state/uiContextStore';
import { uploadExcelFile, confirmExcelImport, formatMappingSummary, cancelExcelImport } from '../../services/ExcelProcessingService';
import { LLMSettingsDialog } from '../AIAssistant/components/LLMSettingsDialog';
import DateJumpDialog from '../DateJumpDialog/DateJumpDialog';
import { useAuth } from '../../hooks/useAuth';
import { ProfileScreen } from '../Auth/ProfileScreen';
import { MfaSetupScreen } from '../Auth/MfaSetupScreen';
import './AgentBar.css';

interface AgentBarProps {
  // Grid Controls
  onTimeScaleChange: (scale: 'year' | 'month' | 'week' | 'day') => void;
  timeScale: 'year' | 'month' | 'week' | 'day';
  onDisplayModeChange: (mode: 'specifications' | 'maintenance' | 'both') => void;
  displayMode: 'specifications' | 'maintenance' | 'both';
  onDataViewModeChange: (mode: 'asset-based' | 'workorder-based') => void;
  dataViewMode: 'asset-based' | 'workorder-based';

  // Data Operations
  onImportData: () => void;
  onExportData: () => void;
  onHierarchyEdit?: () => void;
  onAssetClassificationEdit?: () => void;
  onWorkOrderClassificationEdit?: () => void;

  // AI related passing upwards if necessary
  onSuggestionApply: (suggestion: MaintenanceSuggestion) => void;
  onExcelImport: (file: File) => void;
  onImportComplete: (dataModel: DataModel) => void;
  dataContext: {
    assets: Asset[];
    workOrders: WorkOrder[];
    workOrderLines: WorkOrderLine[];
  };
  timeHeaders?: string[];
  activeTimeHeaders?: string[];

  // Undo/Redo
  canUndo?: boolean;
  onUndo?: () => void;
  canRedo?: boolean;
  onRedo?: () => void;

  // Graph Toggle
  showGraph?: boolean;
  onToggleGraph?: () => void;

  // Plugin & Skill
  onPluginManager?: () => void;
  onSkillRunner?: () => void;

  // Date jump current focus
  currentVisibleDate?: string;

  // Knowledge Base (Project Mu)
  onKnowledgeBase?: () => void;
}

export const AgentBar: React.FC<AgentBarProps> = ({
  onTimeScaleChange,
  timeScale,
  onDisplayModeChange,
  displayMode,
  onDataViewModeChange,
  dataViewMode,
  onImportData,
  onExportData,
  onHierarchyEdit,
  onAssetClassificationEdit,
  onWorkOrderClassificationEdit,
  onSuggestionApply: _onSuggestionApply,
  onExcelImport,
  onImportComplete,
  dataContext,
  timeHeaders = [],
  activeTimeHeaders = [],
  canUndo = false,
  onUndo,
  canRedo = false,
  onRedo,
  showGraph = false,
  onToggleGraph,
  onPluginManager,
  onSkillRunner,
  onKnowledgeBase
}) => {
  // --- AI Assistant State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substr(2, 9));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isAIAreaExpanded, setIsAIAreaExpanded] = useState(false);
  const hasData = !!dataContext?.assets?.length;

  // --- Hover Menu States ---
  const [showTimeScaleMenu, setShowTimeScaleMenu] = useState(false);
  const [showDisplayModeMenu, setShowDisplayModeMenu] = useState(false);
  const [showDateJumpMenu, setShowDateJumpMenu] = useState(false);
  const [showMasterMenu, setShowMasterMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  // Scroll to bottom when messages update
  useEffect(() => {
    if (isChatExpanded && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatExpanded]);

  // Expand chat automatically if there are messages
  useEffect(() => {
    if (messages.length > 0) {
      setIsChatExpanded(true);
    }
  }, [messages]);

  // AI Send logic (Adapted from AIAssistantPanel)
  // overrideText 指定時はテキスト送信を強制（提案確認ボタン等から利用、プラン WS1-9）
  const handleSendMessage = async (overrideText?: string) => {
    const hasOverride = typeof overrideText === 'string' && overrideText.trim().length > 0;
    if (!hasOverride && !inputMessage.trim() && !pendingFile) return;
    if (isLoading) return;

    const currentInput = hasOverride ? overrideText! : inputMessage;
    const currentFile = hasOverride ? null : pendingFile;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentInput || 'ファイル解析を依頼します',
      timestamp: new Date(),
      attachments: currentFile ? [{
        name: currentFile.name,
        size: currentFile.size,
        type: currentFile.type
      }] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setPendingFile(null);
    setIsLoading(true);
    setIsChatExpanded(true);

    if (currentFile) {
      try {
        onExcelImport(currentFile);
        const result = await uploadExcelFile(currentFile, sessionId);
        const summaryText = formatMappingSummary(result);
        const aiResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: summaryText,
          timestamp: new Date(),
          actions: [
            { id: 'confirm_import', label: 'このマッピングでインポート実行', variant: 'confirm' },
            { id: 'cancel_import', label: 'キャンセル', variant: 'cancel' },
          ]
        };
        setMessages(prev => [...prev, aiResponse]);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `[エラー]: ${errMsg}`,
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      type: 'assistant',
      content: '',
      timestamp: new Date()
    };

    const messageHistory = messages
      .filter(m => m.type !== 'system')
      .map(m => ({
        role: m.type === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
      .concat([{ role: 'user', content: currentInput }]);

    setMessages(prev => [...prev, assistantMessage]);

    startChatStream(
      sessionId,
      messageHistory,
      (event: SSEEvent) => {
        if (event.type === 'text_delta' && event.delta) {
          setMessages(prev => prev.map(m => {
            if (m.id === assistantMsgId) {
              return { ...m, content: m.content + event.delta! };
            }
            return m;
          }));
        } else if (event.type === 'suggestion' && event.suggestion) {
          setMessages(prev => prev.map(m => {
            if (m.id === assistantMsgId) {
              const suggestions = m.suggestions ? [...m.suggestions] : [];
              // SSE-borne payload comes through as `unknown`; assume backend-issued shape matches MaintenanceSuggestion
              suggestions.push(event.suggestion as MaintenanceSuggestion);
              return { ...m, suggestions };
            }
            return m;
          }));
        } else if (event.type === 'intent_classified') {
          // UI コンテキスト外の指示は out_of_scope_reason を表示（プラン WS1-10）
          if (event.out_of_scope_reason) {
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + `\n\n⚠️ ${event.out_of_scope_reason}` }
                : m
            ));
          }
        } else if (event.type === 'dialog_open_request' && event.dialog) {
          // バックエンドの要求で該当ダイアログを起動（プラン WS1-10）
          openDialogByKey(event.dialog);
        } else if (event.type === 'proposal_pending') {
          // 計画推論などユーザー確認待ちの提案 — 確認/取消ボタンを表示（プラン WS1-9）
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  actions: [
                    { id: 'confirm_proposal', label: 'この内容で実行', variant: 'confirm' },
                    { id: 'cancel_proposal', label: 'キャンセル', variant: 'cancel' },
                  ],
                }
              : m
          ));
        } else if (event.type === 'tool_result') {
          // ダイアログ操作などの構造化結果を補足表示
          const ops = event.operations as { dialog?: string; action?: string }[] | undefined;
          if (ops && ops.length > 0 && ops[0]?.action) {
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + `\n\n🔧 提案された操作: ${ops[0].action}` }
                : m
            ));
          }
        } else if (event.type === 'proposal_executed') {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: m.content + '\n\n✅ 実行しました。' }
              : m
          ));
        }
      },
      () => setIsLoading(false),
      (err: string) => {
        setMessages(prev => prev.map(m => {
          if (m.id === assistantMsgId) {
            return { ...m, content: m.content + `\n\n[システムエラー: ${err}]` };
          }
          return m;
        }));
        setIsLoading(false);
      },
      dataContext,
      // プラン WS1-10: 現在の UI コンテキスト（開いているダイアログ + グリッド状態）を送信
      useUIContextStore.getState().snapshot()
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPendingFile(file);
      if (!inputMessage.trim()) {
        setInputMessage('このExcelを読み込んでください');
      }
      setIsChatExpanded(true);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // バックエンドの dialog_open_request に応じて該当ダイアログを起動（プラン WS1-10）
  const openDialogByKey = (dialogKey: string) => {
    switch (dialogKey) {
      case 'hierarchy':
        onHierarchyEdit?.();
        break;
      case 'assetClassification':
        onAssetClassificationEdit?.();
        break;
      case 'workOrderClassification':
        onWorkOrderClassificationEdit?.();
        break;
      default:
        // workOrderLine / specification / assetReassign はグリッド操作起点のため
        // AgentBar から直接は開けない。ユーザーに導線を案内する。
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          content: `「${dialogKey}」の編集はグリッド上の対象セル/機器から開いてください。`,
          timestamp: new Date(),
        }]);
    }
  };

  const handleAction = async (actionId: string, messageId: string) => {
    // Hide actions for clicked message
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, actions: undefined } : m));

    if (actionId === 'confirm_proposal') {
      // 提案の確認 — 確認メッセージを送信し、orchestrator 側で pending 操作を実行させる
      await handleSendMessage('はい、お願いします');
      return;
    }
    if (actionId === 'cancel_proposal') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: '提案をキャンセルしました。',
        timestamp: new Date(),
      }]);
      return;
    }

    if (actionId === 'confirm_import') {
      setIsLoading(true);
      const statusMsg: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'インポートを実行中...',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, statusMsg]);

      try {
        const result = await confirmExcelImport(sessionId) as {
          imported_assets?: number;
          imported_work_orders?: number;
          imported_lines?: number;
          error_count?: number;
          data_model?: unknown;
        };
        setMessages(prev => prev.map(m => m.id === statusMsg.id ? {
          ...m,
          content: `✅ インポート完了！\n機器: ${result.imported_assets}件\n作業: ${result.imported_work_orders}件\n明細: ${result.imported_lines}件`
            + ((result.error_count ?? 0) > 0 ? `\n⚠️ エラー: ${result.error_count}件` : '')
        } : m));

        if (result.data_model && onImportComplete) {
          // confirmExcelImport の戻り data_model は API 由来の unknown。
          // 実体は DataModel 形状を前提に渡しているので boundary 越しに cast する。
          onImportComplete(result.data_model as DataModel);
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        setMessages(prev => prev.map(m => m.id === statusMsg.id ? { ...m, content: `[エラー]: ${errMsg}` } : m));
      } finally {
        setIsLoading(false);
      }
    } else if (actionId === 'cancel_import') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'インポートをキャンセルしました。',
        timestamp: new Date()
      }]);
    }
  };

  return (
    <>
      <LLMSettingsDialog open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <Dialog
        open={profileOpen || mfaSetupOpen}
        onClose={() => {
          setProfileOpen(false);
          setMfaSetupOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {mfaSetupOpen ? '多要素認証 (MFA) の設定' : 'プロフィール'}
        </DialogTitle>
        <DialogContent dividers>
          {mfaSetupOpen && user ? (
            <MfaSetupScreen
              noLayout
              username={user.username}
              onSetupSuccess={() => {
                setMfaSetupOpen(false);
                setProfileOpen(true);
              }}
            />
          ) : (
            <ProfileScreen
              onMfaSetupRequested={() => {
                setProfileOpen(false);
                setMfaSetupOpen(true);
              }}
              onClose={() => setProfileOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Agent Bar */}
      <div className="agent-bar-container">
        {/* Main Bar */}
        <div className="agent-bar-surface shadow-bar">

          {/* Expandable Chat History */}
          <div className={`agent-chat-window ${isChatExpanded ? 'expanded' : ''}`}>
            <div className="agent-chat-header">
              <span className="agent-chat-title"><AIIcon sx={{ fontSize: 18, mr: 1 }} /> HOSHUTARO</span>
              <IconButton size="small" sx={{ color: '#999' }} onClick={() => setIsChatExpanded(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </div>
            <div className="agent-chat-messages">
              {messages.map((message) => (
                <div key={message.id} className={`agent-msg-row ${message.type}`}>
                  <Avatar sx={{ width: 24, height: 24, bgcolor: message.type === 'user' ? '#444' : '#111', mr: 1 }}>
                    {message.type === 'user' ? <PersonIcon fontSize="small" /> : <AIIcon fontSize="small" />}
                  </Avatar>
                  <div className="agent-msg-content">
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#fff', fontSize: '13px' }}>
                      {message.content}
                    </Typography>

                    {/* Render actions/suggestions if any */}
                    {message.actions && (
                      <div className="agent-msg-actions">
                        {message.actions.map(action => (
                          <Button
                            key={action.id}
                            size="small"
                            variant={action.variant === 'confirm' ? 'contained' : 'outlined'}
                            onClick={() => handleAction(action.id, message.id)}
                            sx={{ mt: 1, mr: 1, textTransform: 'none', fontSize: '11px', p: '2px 8px' }}
                            color={action.variant === 'confirm' ? 'success' : 'inherit'}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="agent-msg-row assistant">
                  <Avatar sx={{ width: 24, height: 24, bgcolor: '#111', mr: 1 }}><AIIcon fontSize="small" /></Avatar>
                  <CircularProgress size={16} sx={{ color: '#999', mt: 0.5, mr: 1 }} />
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={async () => {
                      try {
                        await cancelExcelImport(sessionId);
                        setMessages(prev => [...prev, {
                          id: Date.now().toString(),
                          type: 'system',
                          content: '処理を中止しました。',
                          timestamp: new Date()
                        }]);
                      } catch (e) {
                        console.error(e);
                      }
                      setIsLoading(false);
                    }}
                    sx={{ textTransform: 'none', fontSize: '11px', p: '2px 8px', borderColor: '#444', color: '#ffaaaa' }}
                  >
                    🛑 中止
                  </Button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Expandable AI Row (Middle) */}
          <div className={`agent-bar-ai-row ${isAIAreaExpanded ? 'expanded' : ''}`}>

            {/* AI Input Box */}
            <div className="agent-input-wrapper">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
              />
              <IconButton
                className="tb-icon attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="ファイル添付"
              >
                <AttachFileIcon fontSize="small" />
              </IconButton>

              {pendingFile && (
                <Chip label={pendingFile.name} size="small" onDelete={() => setPendingFile(null)} sx={{ color: '#fff', bgcolor: '#333', mr: 1, height: '20px', fontSize: '11px' }} />
              )}

              <input
                className="agent-text-input"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="指示を入力するかファイルを添付..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <IconButton
                className="send-btn"
                onClick={() => handleSendMessage()}
                disabled={(!inputMessage.trim() && !pendingFile) || isLoading}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </div>

            <div className="agent-bar-right">
              <IconButton
                className={`tb-icon ${isChatExpanded ? 'active' : ''}`}
                onClick={() => setIsChatExpanded(!isChatExpanded)}
                title="AIチャット履歴の表示切替"
              >
                <ChatIcon fontSize="small" />
              </IconButton>
              
              <div
                className="control-hover-group"
                onMouseEnter={() => setShowToolsMenu(true)}
                onMouseLeave={() => setShowToolsMenu(false)}
              >
                <IconButton className={`tb-icon ${showToolsMenu ? 'active' : ''}`} title="ツールと設定">
                  <ToolsIcon fontSize="small" />
                </IconButton>
                {showToolsMenu && (
                  <div className="hover-menu-vertical plugin-menu-override">
                    <div
                      className="menu-mode"
                      title={user ? `クラウドモード${user.email ? ` — ${user.email}` : ''}` : 'ローカルモード（未ログイン）'}
                    >
                      <span className={`menu-mode-dot ${user ? 'cloud' : 'local'}`} />
                      {user ? 'クラウドモード' : 'ローカルモード'}
                    </div>
                    <div className="menu-separator" />
                    <div className="menu-item" onClick={() => { setIsSettingsOpen(true); setShowToolsMenu(false); }}>LLM設定</div>
                    <div className="menu-item" onClick={() => { onSkillRunner?.(); setShowToolsMenu(false); }}>スキル設定</div>
                    <div className="menu-item" onClick={() => { onPluginManager?.(); setShowToolsMenu(false); }}>プラグイン管理</div>
                    <div className="menu-item" onClick={() => { onKnowledgeBase?.(); setShowToolsMenu(false); }}>ナレッジベース</div>
                    <div className="menu-separator" />
                    <div
                      className="menu-item"
                      onClick={() => {
                        setProfileOpen(true);
                        setShowToolsMenu(false);
                      }}
                      title={user?.email ?? 'プロフィール'}
                    >
                      プロフィール
                    </div>
                    <div
                      className="menu-item"
                      onClick={() => {
                        void signOut();
                        setShowToolsMenu(false);
                      }}
                      title={user?.email ? `サインアウト (${user.email})` : 'サインアウト'}
                    >
                      サインアウト
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grid Tools Row (Bottom) */}
          <div className="agent-bar-grid-row">
            {/* Undo / Redo Buttons */}
            <div className={`agent-tool-anim-wrapper ${!canUndo && !canRedo && !hasData ? 'hidden' : ''}`}>
              <IconButton
                className="tb-icon"
                onClick={onUndo}
                disabled={!canUndo}
                title="元に戻す (Ctrl+Z)"
                sx={{ color: canUndo ? '#ffffff !important' : '#666666 !important' }}
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </div>
            <div className={`agent-tool-anim-wrapper ${!canUndo && !canRedo && !hasData ? 'hidden' : ''}`}>
              <IconButton
                className="tb-icon"
                onClick={onRedo}
                disabled={!canRedo}
                title="やり直す (Ctrl+Y)"
                sx={{ color: canRedo ? '#ffffff !important' : '#666666 !important' }}
              >
                <RedoIcon fontSize="small" />
              </IconButton>
            </div>

            {/* Display Mode Toggle */}
            <div className={`agent-tool-anim-wrapper ${!hasData ? 'hidden' : ''}`}>
              <div
                className="control-hover-group"
                onMouseEnter={() => setShowDisplayModeMenu(true)}
                onMouseLeave={() => setShowDisplayModeMenu(false)}
              >
                <IconButton className={`tb-icon ${showDisplayModeMenu ? 'active' : ''}`} title="表示モード">
                  <DisplayModeIcon fontSize="small" />
                </IconButton>
                {showDisplayModeMenu && (
                  <div className="hover-menu-vertical">
                    <div className={`menu-item ${displayMode === 'maintenance' ? 'selected' : ''}`} onClick={() => onDisplayModeChange('maintenance')}>星取表</div>
                    <div className={`menu-item ${displayMode === 'specifications' ? 'selected' : ''}`} onClick={() => onDisplayModeChange('specifications')}>機器仕様</div>
                    <div className={`menu-item ${displayMode === 'both' ? 'selected' : ''}`} onClick={() => onDisplayModeChange('both')}>両方</div>
                  </div>
                )}
              </div>
            </div>

            {/* Time Scale Toggle */}
            <div className={`agent-tool-anim-wrapper ${!hasData ? 'hidden' : ''}`}>
              <div
                className="control-hover-group"
                onMouseEnter={() => setShowTimeScaleMenu(true)}
                onMouseLeave={() => setShowTimeScaleMenu(false)}
              >
                <IconButton className={`tb-icon ${showTimeScaleMenu ? 'active' : ''}`} title="時間スケール">
                  <CalendarIcon fontSize="small" />
                </IconButton>
                {showTimeScaleMenu && (
                  <div className="hover-menu-vertical">
                    <div className={`menu-item ${timeScale === 'day' ? 'selected' : ''}`} onClick={() => onTimeScaleChange('day')}>日</div>
                    <div className={`menu-item ${timeScale === 'week' ? 'selected' : ''}`} onClick={() => onTimeScaleChange('week')}>週</div>
                    <div className={`menu-item ${timeScale === 'month' ? 'selected' : ''}`} onClick={() => onTimeScaleChange('month')}>月</div>
                    <div className={`menu-item ${timeScale === 'year' ? 'selected' : ''}`} onClick={() => onTimeScaleChange('year')}>年</div>
                  </div>
                )}
              </div>
            </div>

            {/* Date Jump Toggle (Hidden in Year mode) */}
            {timeScale !== 'year' && (
              <div
                className={`agent-tool-anim-wrapper ${!hasData ? 'hidden' : ''} control-hover-group`}
                onMouseEnter={() => setShowDateJumpMenu(true)}
                onMouseLeave={() => setShowDateJumpMenu(false)}
              >
                <IconButton
                  className={`tb-icon ${showDateJumpMenu ? 'active' : ''}`}
                  title="指定日付へジャンプ"
                >
                  <DateRangeIcon fontSize="small" />
                </IconButton>
                {showDateJumpMenu && (
                  <DateJumpDialog
                    timeScale={timeScale}
                    timeHeaders={timeHeaders}
                    activeTimeHeaders={activeTimeHeaders}
                    onJump={(dateStr) => {
                      const event = new CustomEvent('jumpToColumn', { detail: { header: dateStr } });
                      window.dispatchEvent(event);
                      setShowDateJumpMenu(false);
                    }}
                  />
                )}
              </div>
            )}



            {/* View Mode Toggle */}
            <div className={`agent-tool-anim-wrapper ${!hasData ? 'hidden' : ''}`}>
              <IconButton
                className="tb-icon"
                onClick={() => onDataViewModeChange(dataViewMode === 'asset-based' ? 'workorder-based' : 'asset-based')}
                title={dataViewMode === 'asset-based' ? '現在：機器ベース (クリックで作業ベースへ)' : '現在：作業ベース (クリックで機器ベースへ)'}
              >
                <ViewModeIcon fontSize="small" />
              </IconButton>
            </div>

            {/* Graph Toggle */}
            <div className={`agent-tool-anim-wrapper ${!hasData ? 'hidden' : ''}`}>
              <IconButton
                className={`tb-icon ${showGraph ? 'active' : ''}`}
                onClick={onToggleGraph}
                title={showGraph ? 'グラフを非表示' : 'コスト推移グラフを表示'}
              >
                <BarChartIcon fontSize="small" />
              </IconButton>
            </div>



            {/* Master Data Management Menu */}
            <div className={`agent-tool-anim-wrapper ${!hasData ? 'hidden' : ''}`}>
              <div
                className="control-hover-group"
                onMouseEnter={() => setShowMasterMenu(true)}
                onMouseLeave={() => setShowMasterMenu(false)}
              >
                <IconButton className={`tb-icon ${showMasterMenu ? 'active' : ''}`} title="マスタ管理">
                  <HierarchyIcon fontSize="small" />
                </IconButton>
                {showMasterMenu && (
                  <div className="hover-menu-vertical">
                    <div className="menu-item" onClick={() => { onHierarchyEdit?.(); setShowMasterMenu(false); }}>機器階層</div>
                    <div className="menu-item" onClick={() => { onAssetClassificationEdit?.(); setShowMasterMenu(false); }}>機器分類</div>
                    <div className="menu-item" onClick={() => { onWorkOrderClassificationEdit?.(); setShowMasterMenu(false); }}>作業分類</div>
                  </div>
                )}
              </div>
            </div>

            {/* Download Data Toggle */}
            <div className={`agent-tool-anim-wrapper ${!hasData ? 'hidden' : ''}`}>
              <IconButton
                className="tb-icon"
                onClick={onExportData}
                title="データをダウンロード"
              >
                <DownloadFileIcon fontSize="small" />
              </IconButton>
            </div>

            {/* Upload Data Toggle (Always visible) */}
            <div className="agent-tool-anim-wrapper">
              <IconButton
                onClick={onImportData}
                className="tb-icon"
                title="データをアップロード"
                sx={{
                  bgcolor: !hasData ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' }
                }}
              >
                <UploadFileIcon fontSize="small" />
              </IconButton>
            </div>

            {/* AI Toggle / Favicon (Always visible) */}
            <div className="agent-tool-anim-wrapper">
              <IconButton
                className={`tb-icon favicon-toggle ${isAIAreaExpanded ? 'active' : ''}`}
                onClick={() => setIsAIAreaExpanded(!isAIAreaExpanded)}
                title="HOSHUTARO AI アシスタント"
              >
                <img src="/favicon.svg" alt="AI Agent" style={{ width: 24, height: 24, filter: isAIAreaExpanded ? 'none' : 'grayscale(100%) brightness(2)' }} />
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
