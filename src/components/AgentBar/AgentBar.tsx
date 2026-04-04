import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, IconButton, Typography, CircularProgress, Avatar, Paper, Button, Chip
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Settings as SettingsIcon,
  CalendarMonth as CalendarIcon,
  ViewList as DisplayModeIcon,
  SwapHoriz as ViewModeIcon,
  Star as AIIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  AccountTree as HierarchyIcon,
  ImportExport as SyncIcon,
  FileUpload as UploadFileIcon,
  FileDownload as DownloadFileIcon,
  ChatBubbleOutline as ChatIcon,
  Apps as ToolsIcon
} from '@mui/icons-material';
import type { ChatMessage, MaintenanceSuggestion } from '../AIAssistant/types';
import { startChatStream, SSEEvent } from '../../services/sseClient';
import { uploadExcelFile, confirmExcelImport, formatMappingSummary, cancelExcelImport } from '../../services/ExcelProcessingService';
import { LLMSettingsDialog } from '../AIAssistant/components/LLMSettingsDialog';
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
  
  // AI related passing upwards if necessary
  onSuggestionApply: (suggestion: MaintenanceSuggestion) => void;
  onExcelImport: (file: File) => void;
  onImportComplete: (dataModel: any) => void;
  dataContext: any;
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
  onSuggestionApply,
  onExcelImport,
  onImportComplete,
  dataContext
}) => {
  // --- AI Assistant State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substr(2, 9));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);

  // --- Hover Menu States ---
  const [showTimeScaleMenu, setShowTimeScaleMenu] = useState(false);
  const [showDisplayModeMenu, setShowDisplayModeMenu] = useState(false);
  const [showDataSyncMenu, setShowDataSyncMenu] = useState(false);

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
  const handleSendMessage = async () => {
    if (!inputMessage.trim() && !pendingFile) return;
    if (isLoading) return;

    const currentInput = inputMessage;
    const currentFile = pendingFile;

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
      } catch (error: any) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `[エラー]: ${error.message}`,
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
              suggestions.push(event.suggestion);
              return { ...m, suggestions };
            }
            return m;
          }));
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
      dataContext
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

  const handleAction = async (actionId: string, messageId: string) => {
    // Hide actions for clicked message
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, actions: undefined } : m));

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
        const result = await confirmExcelImport(sessionId);
        setMessages(prev => prev.map(m => m.id === statusMsg.id ? {
          ...m,
          content: `✅ インポート完了！\n機器: ${result.imported_assets}件\n作業: ${result.imported_work_orders}件\n明細: ${result.imported_lines}件` 
            + (result.error_count > 0 ? `\n⚠️ エラー: ${result.error_count}件` : '')
        } : m));
        
        if (result.data_model && onImportComplete) {
          onImportComplete(result.data_model);
        }
      } catch (error: any) {
        setMessages(prev => prev.map(m => m.id === statusMsg.id ? { ...m, content: `[エラー]: ${error.message}` } : m));
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
      
      {/* Floating Agent Bar */}
      <div className="agent-bar-container">
        {/* Expandable Chat History */}
        {isChatExpanded && (
          <div className="agent-chat-window animate-float-up">
            <div className="agent-chat-header">
              <span className="agent-chat-title"><AIIcon sx={{ fontSize: 18, mr: 1}}/> HOSHUTARO</span>
              <IconButton size="small" sx={{color: '#999'}} onClick={() => setIsChatExpanded(false)}>
                <CloseIcon fontSize="small"/>
              </IconButton>
            </div>
            <div className="agent-chat-messages">
              {messages.map((message) => (
                <div key={message.id} className={`agent-msg-row ${message.type}`}>
                  <Avatar sx={{ width: 24, height: 24, bgcolor: message.type === 'user' ? '#444' : '#111', mr: 1 }}>
                    {message.type === 'user' ? <PersonIcon fontSize="small"/> : <AIIcon fontSize="small"/>}
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
                   <Avatar sx={{ width: 24, height: 24, bgcolor: '#111', mr: 1 }}><AIIcon fontSize="small"/></Avatar>
                   <CircularProgress size={16} sx={{color: '#999', mt: 0.5, mr: 1}} />
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
                        } catch(e) {
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
        )}

        {/* Main Bar */}
        <div className="agent-bar-surface shadow-bar">
          
          {/* Controls Cluster */}
          <div className="agent-bar-controls" style={{ position: 'relative' }}>
            
            <IconButton 
              className={`tb-icon ${isToolsExpanded ? 'active' : ''}`}
              onClick={() => setIsToolsExpanded(!isToolsExpanded)}
              title="グリッドツール"
            >
              <ToolsIcon fontSize="small" />
            </IconButton>

            <div className={`expandable-tools-pill ${isToolsExpanded ? 'expanded' : ''}`}>
              {/* Display Mode Toggle */}
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

              {/* Time Scale Toggle */}
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

              {/* View Mode Toggle */}
              <IconButton 
                className="tb-icon" 
                onClick={() => onDataViewModeChange(dataViewMode === 'asset-based' ? 'workorder-based' : 'asset-based')}
                title={dataViewMode === 'asset-based' ? '現在：機器ベース (クリックで作業ベースへ)' : '現在：作業ベース (クリックで機器ベースへ)'}
              >
                <ViewModeIcon fontSize="small" />
              </IconButton>

              {/* Hierarchy Edit Toggle */}
              {onHierarchyEdit && (
                <IconButton 
                  className="tb-icon" 
                  onClick={onHierarchyEdit}
                  title="機器階層設定"
                >
                  <HierarchyIcon fontSize="small" />
                </IconButton>
              )}

              {/* Data Sync Toggle */}
              <div 
                className="control-hover-group"
                onMouseEnter={() => setShowDataSyncMenu(true)}
                onMouseLeave={() => setShowDataSyncMenu(false)}
              >
                <IconButton className={`tb-icon ${showDataSyncMenu ? 'active' : ''}`} title="データ入出力">
                  <SyncIcon fontSize="small"/>
                </IconButton>
                {showDataSyncMenu && (
                  <div className="hover-menu-vertical">
                    <div className="menu-item" onClick={onImportData} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UploadFileIcon fontSize="small" sx={{mr: 1}}/> アップロード
                    </div>
                    <div className="menu-item" onClick={onExportData} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DownloadFileIcon fontSize="small" sx={{mr: 1}}/> ダウンロード
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="divider"></div>

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
              <Chip label={pendingFile.name} size="small" onDelete={() => setPendingFile(null)} sx={{color: '#fff', bgcolor: '#333', mr: 1, height: '20px', fontSize: '11px'}}/>
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
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && !pendingFile) || isLoading}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </div>

          <div className="divider"></div>

          {/* Right Controls */}
          <div className="agent-bar-right">
             <IconButton 
               className={`tb-icon ${isChatExpanded ? 'active' : ''}`}
               onClick={() => setIsChatExpanded(!isChatExpanded)} 
               title="AIチャット履歴の表示切替"
             >
               <ChatIcon fontSize="small"/>
             </IconButton>
             <IconButton className="tb-icon" onClick={() => setIsSettingsOpen(true)} title="LLM設定">
               <SettingsIcon fontSize="small"/>
             </IconButton>
          </div>

        </div>
      </div>
    </>
  );
};
