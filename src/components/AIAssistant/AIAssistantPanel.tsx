import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  TextField,
  Button,
  Paper,
  List,
  ListItem,
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
import type { ChatMessage, MaintenanceSuggestion, AIAssistantPanelProps, FileAttachment, ExcelImportResult, DataMappingSuggestion } from './types';
import ExcelDropZone from './components/ExcelDropZone';
import DataPreview from './components/DataPreview';
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
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [dataMappings, setDataMappings] = useState<DataMappingSuggestion[]>([]);
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
      const { mockAIService } = await import('./services/MockAIService');
      const aiResponse = await mockAIService.generateResponse(currentInput);
      
      const responseMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
        suggestions: aiResponse.suggestions
      };

      setMessages(prev => [...prev, responseMessage]);
    } catch (error) {
      const { errorHandlingService } = await import('./services/ErrorHandlingService');
      const aiError = errorHandlingService.handleError(error);
      const errorMessage = errorHandlingService.createErrorMessage(aiError);
      
      errorHandlingService.logError(aiError, { input: currentInput, action: 'sendMessage' });
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExcelProcessed = (result: ExcelImportResult, file: File) => {
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
    let content = '';
    let suggestions: MaintenanceSuggestion[] = [];
    
    if (result.success) {
      content = `ファイル "${file.name}" を解析しました。\n\n📊 解析結果:\n- 処理行数: ${result.processedRows}行\n- データマッピング: ${result.suggestions.length}件\n- エラー/警告: ${result.errors.length}件\n\n設備情報のマッピングと保全計画の提案を行います。`;
      
      // サンプル提案を生成
      if (result.processedRows > 0) {
        suggestions = [
          {
            equipmentId: 'IMPORT_001',
            timeHeader: '2024-06',
            suggestedAction: 'plan',
            reason: 'インポートデータから新規設備の保全計画を提案',
            confidence: 0.88,
            cost: 65000
          }
        ];
      }
    } else {
      content = `ファイル "${file.name}" の処理中にエラーが発生しました。\n\n❌ エラー詳細:\n${result.errors.map(e => `- ${e.message}`).join('\n')}\n\nファイル形式や内容を確認してください。`;
    }
    
    const aiResponse: ChatMessage = {
      id: Date.now().toString(),
      type: 'assistant',
      content,
      timestamp: new Date(),
      suggestions
    };
    
    setMessages(prev => [...prev, aiResponse]);
  };

  const handlePreviewGenerated = (data: any[], mappings: DataMappingSuggestion[]) => {
    setPreviewData(data);
    setDataMappings(mappings);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // This is kept for backward compatibility but the main upload is handled by ExcelDropZone
    const file = event.target.files?.[0];
    if (file) {
      // Trigger the ExcelDropZone processing
      setShowExcelUpload(true);
    }
  };

  const handleApplySuggestion = async (suggestion: MaintenanceSuggestion) => {
    try {
      // 実際のアプリケーションでは、ここで既存のグリッドデータを取得
      // デモ用のモックデータを使用
      const mockGridData = await import('./services/MockMaintenanceData').then(m => m.mockMaintenanceData);
      
      const { maintenanceGridIntegration } = await import('./services/MaintenanceGridIntegration');
      
      const result = maintenanceGridIntegration.applySuggestionToGrid(
        suggestion,
        mockGridData,
        (updatedData) => {
          // 実際のアプリケーションでは、ここでグリッドデータを更新
          console.log('Grid data updated:', updatedData);
        }
      );

      onSuggestionApply(suggestion);
      
      const confirmMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: result.success 
          ? `✅ ${result.message}`
          : `❌ ${result.message}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, confirmMessage]);

      // 成功した場合、類似の提案も生成
      if (result.success) {
        const similarSuggestions = maintenanceGridIntegration.findSimilarSuggestions(suggestion, mockGridData);
        if (similarSuggestions.length > 0) {
          const suggestionMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'assistant',
            content: `類似の設備や時期についても保全提案があります。以下の提案もご検討ください。`,
            timestamp: new Date(),
            suggestions: similarSuggestions.slice(0, 2) // 最大2件の類似提案
          };
          
          setTimeout(() => {
            setMessages(prev => [...prev, suggestionMessage]);
          }, 1000);
        }
      }

    } catch (error) {
      const { errorHandlingService } = await import('./services/ErrorHandlingService');
      const aiError = errorHandlingService.handleError(error);
      const errorMessage = errorHandlingService.createErrorMessage(aiError);
      
      errorHandlingService.logError(aiError, { suggestion, action: 'applySuggestion' });
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';

    return (
      <ListItem
        key={message.id}
        sx={{
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          px: 2,
          py: 1
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            maxWidth: '85%',
            flexDirection: isUser ? 'row-reverse' : 'row'
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: isUser ? 'primary.main' : isSystem ? 'grey.500' : 'secondary.main'
            }}
          >
            {isUser ? <PersonIcon /> : <AIIcon />}
          </Avatar>
          
          <Paper
            elevation={1}
            sx={{
              p: 2,
              bgcolor: isUser ? 'primary.light' : isSystem ? 'grey.100' : 'background.paper',
              color: isUser ? 'primary.contrastText' : 'text.primary',
              borderRadius: 2,
              maxWidth: '100%'
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Typography>
            
            {message.attachments && (
              <Box sx={{ mt: 1 }}>
                {message.attachments.map((attachment: FileAttachment, index: number) => (
                  <Chip
                    key={index}
                    icon={<AttachFileIcon />}
                    label={attachment.name}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
            
            {message.suggestions && message.suggestions.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  提案された保全アクション:
                </Typography>
                {message.suggestions.map((suggestion: MaintenanceSuggestion, index: number) => (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{ p: 1.5, mb: 1, bgcolor: 'background.default' }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" color="primary">
                        {suggestion.equipmentId} - {suggestion.timeHeader}
                      </Typography>
                      <Chip
                        size="small"
                        label={`信頼度: ${Math.round(suggestion.confidence * 100)}%`}
                        color={suggestion.confidence > 0.8 ? 'success' : 'warning'}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {suggestion.reason}
                    </Typography>
                    {suggestion.cost && (
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        推定コスト: ¥{suggestion.cost.toLocaleString()}
                      </Typography>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => handleApplySuggestion(suggestion)}
                      sx={{ mt: 1 }}
                    >
                      星取表に適用
                    </Button>
                  </Paper>
                ))}
              </Box>
            )}
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {message.timestamp.toLocaleTimeString()}
            </Typography>
          </Paper>
        </Box>
      </ListItem>
    );
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          width: 400,
          maxWidth: '40vw',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'primary.main',
          color: 'primary.contrastText'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon />
          <Typography variant="h6">AIアシスタント</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'inherit' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'grey.50' }}>
        <List sx={{ p: 0 }}>
          {messages.map(renderMessage)}
          {isLoading && (
            <ListItem sx={{ justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 1 }} color="text.secondary">
                AIが回答を生成中...
              </Typography>
            </ListItem>
          )}
        </List>
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        {/* Quick Action Buttons */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setInputMessage('設備の保全計画について教えて')}
          >
            保全計画
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setInputMessage('故障予測を行って')}
          >
            故障予測
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setInputMessage('コスト最適化の提案をして')}
          >
            コスト最適化
          </Button>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AttachFileIcon />}
            onClick={() => setShowExcelUpload(!showExcelUpload)}
          >
            Excel
          </Button>
        </Box>
        
        {/* Excel Upload Interface */}
        {showExcelUpload && (
          <Box sx={{ mb: 2 }}>
            <ExcelDropZone
              onFileProcessed={handleExcelProcessed}
              onPreviewGenerated={handlePreviewGenerated}
            />
            {previewData.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <DataPreview
                  data={previewData}
                  mappings={dataMappings}
                  onApplyMappings={(mappings) => {
                    const message: ChatMessage = {
                      id: Date.now().toString(),
                      type: 'system',
                      content: `データマッピングを適用しました。${mappings.length}個のフィールドがマッピングされました。`,
                      timestamp: new Date()
                    };
                    setMessages(prev => [...prev, message]);
                  }}
                />
              </Box>
            )}
          </Box>
        )}
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="設備について質問してください..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            multiline
            maxRows={3}
            disabled={isLoading}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
};

export default AIAssistantPanel;