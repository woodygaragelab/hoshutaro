import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Paper,
  Avatar,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Star as AIIcon,
  Person as PersonIcon,
  AttachFile as AttachFileIcon,
  CheckCircle as CheckCircleIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import type { ChatMessage, MaintenanceSuggestion, AIAssistantPanelProps } from './types';
import { LLMSettingsDialog } from './components/LLMSettingsDialog';
import { startChatStream, SSEEvent } from '../../services/sseClient';
import { uploadExcelFile, confirmExcelImport, formatMappingSummary, cancelExcelImport } from '../../services/ExcelProcessingService';
import './AIAssistantPanel.css';

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  isOpen,
  onClose,
  onSuggestionApply,
  onExcelImport,
  onImportComplete,
  dataContext
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'HOSHUTAROへようこそ！設備の保全計画や故障予測について何でもお聞きください。Excelファイルのアップロードも可能です。',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substr(2, 9));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const currentInput = inputMessage;
    const currentFile = pendingFile;

    // ユーザーメッセージ表示（添付ファイルがある場合はそれも表示）
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentInput,
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

    // ── 添付ファイルがある場合: Excel解析 → 結果表示 ──
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
        const errorResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `[エラー]: ${error.message}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorResponse]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ── 通常メッセージ: SSEチャットストリーム ──
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
      () => {
        setIsLoading(false);
      },
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
      
      // 入力欄にヒントを表示
      if (!inputMessage.trim()) {
        setInputMessage('このExcelを読み込んでください');
      }
      
      // チャットにファイル添付の通知を表示
      const fileNotice: ChatMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: `📎 "${file.name}" (${Math.round(file.size / 1024)}KB) を添付しました。メッセージを送信すると解析を開始します。`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fileNotice]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAction = async (actionId: string, messageId: string) => {
    // アクションボタンを消す（使用済みにする）
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return { ...m, actions: undefined };
      }
      return m;
    }));

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
        
        setMessages(prev => prev.map(m => {
          if (m.id === statusMsg.id) {
            return {
              ...m,
              content: `✅ インポート完了！\n機器: ${result.imported_assets}件\n作業: ${result.imported_work_orders}件\n明細: ${result.imported_lines}件` 
                + (result.error_count > 0 ? `\n⚠️ エラー: ${result.error_count}件` : '')
            };
          }
          return m;
        }));
        
        if (result.data_model && onImportComplete) {
          onImportComplete(result.data_model);
        }
      } catch (error: any) {
        setMessages(prev => prev.map(m => {
          if (m.id === statusMsg.id) {
            return { ...m, content: `[エラー]: ${error.message}` };
          }
          return m;
        }));
      } finally {
        setIsLoading(false);
      }
    } else if (actionId === 'cancel_import') {
      const cancelMsg: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'インポートをキャンセルしました。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, cancelMsg]);
    }
  };

  const handleHiddenSendMessage = (text: string) => {
    setIsLoading(true);
    const assistantMsgId = (Date.now() + 2).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      type: 'assistant',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);

    const messageHistory = messages
      .filter(m => m.type !== 'system')
      .map(m => ({
        role: m.type === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
      .concat([{ role: 'user', content: text }]);

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
      () => {
        setIsLoading(false);
      },
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

  const handleApplySuggestion = (suggestion: MaintenanceSuggestion) => {
    onSuggestionApply(suggestion);
    
    const confirmMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'system',
      content: `✅ 提案を適用しました: ${suggestion.reason}`,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, confirmMessage]);

    // インポート等でバックエンドへの進行トリガーが必要な場合
    if (suggestion.equipmentId === "IMPORT-ALL" || suggestion.suggestedAction === "plan") {
      handleHiddenSendMessage(`提案（${suggestion.equipmentId}）を承認します。処理を続行してください。`);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    return (
      <div key={message.id} className={`ai-assistant-message ${message.type}`}>
        <div className={`message-bubble ${message.type}`}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: message.type === 'user' ? '#333333' : '#000000', color: '#ffffff' }}>
              {message.type === 'user' ? <PersonIcon /> : <AIIcon />}
            </Avatar>
            <div style={{ flex: 1 }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#ffffff' }}>
                {message.content}
              </Typography>
              {message.attachments && message.attachments.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {message.attachments.map((attachment, index) => (
                    <Chip
                      key={index}
                      icon={<AttachFileIcon />}
                      label={`${attachment.name} (${Math.round(attachment.size / 1024)}KB)`}
                      size="small"
                      className="attachment-chip"
                    />
                  ))}
                </div>
              )}
              {message.suggestions && message.suggestions.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {message.suggestions.map((suggestion, index) => (
                    <Paper key={index} className="suggestion-card" sx={{ backgroundColor: '#1e1e1e', border: '1px solid #666666' }}>
                      <div className="suggestion-header">
                        <Typography className="suggestion-title" sx={{ color: '#90caf9' }}>
                          保全提案 #{index + 1}
                        </Typography>
                        <Chip
                          label={`信頼度: ${Math.round(suggestion.confidence * 100)}%`}
                          size="small"
                          className={suggestion.confidence > 0.8 ? "confidence-badge" : "confidence-badge warning"}
                        />
                      </div>
                      <Typography className="suggestion-reason" sx={{ color: '#b3b3b3' }}>
                        {suggestion.reason}
                      </Typography>
                      {suggestion.cost && (
                        <Typography className="suggestion-cost" sx={{ color: '#b3b3b3' }}>
                          推定コスト: ¥{suggestion.cost.toLocaleString()}
                        </Typography>
                      )}
                      <Button
                        className="apply-suggestion-btn"
                        onClick={() => handleApplySuggestion(suggestion)}
                        startIcon={<CheckCircleIcon />}
                        sx={{ 
                          backgroundColor: '#4caf50', 
                          color: '#ffffff',
                          '&:hover': { backgroundColor: '#45a049' }
                        }}
                      >
                        提案を適用
                      </Button>
                    </Paper>
                  ))}
                </div>
              )}
              {message.actions && message.actions.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {message.actions.map((action) => (
                    <Button
                      key={action.id}
                      size="small"
                      variant={action.variant === 'confirm' ? 'contained' : 'outlined'}
                      onClick={() => handleAction(action.id, message.id)}
                      disabled={isLoading}
                      sx={{
                        backgroundColor: action.variant === 'confirm' ? '#4caf50' : 'transparent',
                        color: '#ffffff',
                        borderColor: action.variant === 'cancel' ? '#666' : undefined,
                        '&:hover': {
                          backgroundColor: action.variant === 'confirm' ? '#45a049' : '#333',
                        },
                        textTransform: 'none',
                      }}
                    >
                      {action.variant === 'confirm' && <CheckCircleIcon sx={{ mr: 0.5, fontSize: 18 }} />}
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
              <Typography variant="caption" className="message-timestamp" sx={{ color: '#b3b3b3' }}>
                {message.timestamp.toLocaleTimeString()}
              </Typography>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ai-assistant-panel">
      <div className="ai-assistant-header">
        <Typography variant="h6" sx={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AIIcon sx={{ color: '#ffffff' }} />
          HOSHUTARO
        </Typography>
        <Box>
          <IconButton onClick={() => setIsSettingsOpen(true)} sx={{ color: '#ffffff', mr: 1 }}>
            <SettingsIcon />
          </IconButton>
          <IconButton onClick={onClose} sx={{ color: '#ffffff' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </div>

      <div className="ai-assistant-messages">
        {messages.map(renderMessage)}
        {isLoading && (
          <div className="loading-indicator" style={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} sx={{ color: '#ffffff', mr: 2 }} />
            <Typography variant="body2" sx={{ color: '#b3b3b3', flex: 1 }}>
              動作中...
            </Typography>
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
              sx={{ borderColor: '#555', color: '#ffaaaa', fontSize: '11px', textTransform: 'none' }}
            >
              🛑 中止する
            </Button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-assistant-input">
        <div className="input-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />
          <button
            className="file-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <AttachFileIcon sx={{ fontSize: 16, mr: 0.5 }} />
            ファイル添付
          </button>
        </div>

        {pendingFile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '4px 12px', backgroundColor: '#1a3a1a', borderRadius: '4px',
            margin: '0 8px 4px', fontSize: '12px', color: '#90caf9',
          }}>
            <AttachFileIcon sx={{ fontSize: 14 }} />
            <span style={{ flex: 1 }}>{pendingFile.name}</span>
            <button
              onClick={() => { setPendingFile(null); setInputMessage(''); }}
              style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '14px' }}
            >✕</button>
          </div>
        )}

        <div className="message-input-container">
          <textarea
            className="message-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="保全計画や故障予測について質問してください..."
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
          >
            <SendIcon />
          </button>
        </div>
      </div>
      
      <LLMSettingsDialog 
        open={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};

export default AIAssistantPanel;