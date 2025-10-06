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
  SmartToy as AIIcon,
  Person as PersonIcon,
  AttachFile as AttachFileIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import type { ChatMessage, MaintenanceSuggestion, AIAssistantPanelProps } from './types';
import { MockAIService } from './services/MockAIService';
import './AIAssistantPanel.css';

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  isOpen,
  onClose,
  onSuggestionApply,
  onExcelImport
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'AIアシスタントへようこそ！設備の保全計画や故障予測について何でもお聞きください。Excelファイルのアップロードも可能です。',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiService = useRef(new MockAIService());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      // Use mock AI service for response generation
      const aiResponse = await aiService.current.generateResponse(currentInput);
      
      const responseMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
        suggestions: aiResponse.suggestions
      };

      setMessages(prev => [...prev, responseMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: '申し訳ございません。エラーが発生しました。もう一度お試しください。',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onExcelImport(file);
      
      const fileMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: `Excelファイル "${file.name}" をアップロードしました。`,
        timestamp: new Date(),
        attachments: [{
          name: file.name,
          size: file.size,
          type: file.type
        }]
      };

      setMessages(prev => [...prev, fileMessage]);
      
      // AI応答を生成
      const aiResponse: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `ファイル "${file.name}" を解析しました。設備情報のマッピングと保全計画の提案を行います。`,
        timestamp: new Date(),
        suggestions: [
          {
            equipmentId: 'IMPORT_001',
            timeHeader: '2024-06',
            suggestedAction: 'plan',
            reason: 'インポートデータから新規設備の保全計画を提案',
            confidence: 0.88,
            cost: 65000
          }
        ]
      };
      
      setMessages(prev => [...prev, aiResponse]);
    }
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
  };

  const renderMessage = (message: ChatMessage) => {
    return (
      <div key={message.id} className={`ai-assistant-message ${message.type}`}>
        <div className={`message-bubble ${message.type}`}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: message.type === 'user' ? '#333333' : '#1e1e1e' }}>
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
        <Typography variant="h6" sx={{ color: '#ffffff' }}>
          AIアシスタント
        </Typography>
        <IconButton onClick={onClose} sx={{ color: '#ffffff' }}>
          <CloseIcon />
        </IconButton>
      </div>

      <div className="ai-assistant-messages">
        {messages.map(renderMessage)}
        {isLoading && (
          <div className="loading-indicator">
            <CircularProgress size={20} sx={{ color: '#ffffff' }} />
            <Typography variant="body2" sx={{ color: '#b3b3b3' }}>
              AIが回答を生成中...
            </Typography>
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
    </div>
  );
};

export default AIAssistantPanel;