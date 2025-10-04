import { ChatMessage, MaintenanceSuggestion, AIResponse } from '../types';

export class MockAIService {
  private responsePatterns: ResponsePattern[] = [
    {
      keywords: ['保全', 'メンテナンス', 'maintenance'],
      responses: [
        '設備の保全計画についてお答えします。定期的な点検とメンテナンスは設備の寿命を延ばし、予期しない故障を防ぐために重要です。',
        '保全計画の最適化には、設備の稼働状況、過去の故障履歴、メーカー推奨事項を総合的に考慮する必要があります。',
        '予防保全と事後保全のバランスを取ることで、コスト効率の良い保全戦略を構築できます。'
      ],
      suggestions: [
        {
          equipmentId: 'EQ001',
          timeHeader: '2024-04',
          suggestedAction: 'plan',
          reason: '前回メンテナンスから6ヶ月経過のため定期点検を推奨',
          confidence: 0.85,
          cost: 50000
        },
        {
          equipmentId: 'EQ003',
          timeHeader: '2024-05',
          suggestedAction: 'plan',
          reason: '運転時間が推奨メンテナンス間隔に到達',
          confidence: 0.78,
          cost: 75000
        }
      ]
    },
    {
      keywords: ['故障', 'トラブル', 'failure', '異常'],
      responses: [
        '故障予測について分析いたします。過去のデータから、以下の設備で注意が必要です。',
        '設備の異常兆候を早期に検出することで、計画外停止を防ぐことができます。',
        '振動、温度、電流値などのセンサーデータから故障の前兆を捉えることが重要です。'
      ],
      suggestions: [
        {
          equipmentId: 'EQ002',
          timeHeader: '2024-05',
          suggestedAction: 'both',
          reason: '振動データの異常値検出により早期対応を推奨',
          confidence: 0.92,
          cost: 120000
        },
        {
          equipmentId: 'EQ004',
          timeHeader: '2024-04',
          suggestedAction: 'actual',
          reason: '温度センサーの値が正常範囲を超過',
          confidence: 0.88,
          cost: 80000
        }
      ]
    },
    {
      keywords: ['コスト', '費用', 'cost', '予算'],
      responses: [
        'コスト最適化の観点から分析いたします。予防保全により長期的なコスト削減が期待できます。',
        '保全コストの削減には、適切な部品在庫管理と作業効率の向上が重要です。',
        '設備のライフサイクルコストを考慮した保全戦略をご提案します。'
      ],
      suggestions: [
        {
          equipmentId: 'EQ005',
          timeHeader: '2024-06',
          suggestedAction: 'plan',
          reason: 'コスト効率を考慮した部品交換時期の最適化',
          confidence: 0.75,
          cost: 45000
        }
      ]
    },
    {
      keywords: ['周期', 'cycle', '頻度', 'frequency'],
      responses: [
        'メンテナンス周期の最適化についてご説明します。設備の使用状況と重要度に応じて周期を調整することが重要です。',
        '過去の故障データと稼働時間を分析し、最適なメンテナンス間隔をご提案します。',
        '設備の信頼性要求レベルに応じて、メンテナンス周期を設定することをお勧めします。'
      ],
      suggestions: [
        {
          equipmentId: 'EQ006',
          timeHeader: '2024-07',
          suggestedAction: 'plan',
          reason: '稼働データ分析により周期短縮を推奨',
          confidence: 0.82,
          cost: 35000
        }
      ]
    },
    {
      keywords: ['部品', 'parts', '交換', 'replacement'],
      responses: [
        '部品交換計画についてアドバイスいたします。消耗部品の適切な交換タイミングが重要です。',
        '部品の在庫管理と調達リードタイムを考慮した交換計画をご提案します。',
        '重要部品については予備品の確保と定期的な点検が必要です。'
      ],
      suggestions: [
        {
          equipmentId: 'EQ007',
          timeHeader: '2024-08',
          suggestedAction: 'plan',
          reason: '消耗部品の交換時期が近づいています',
          confidence: 0.90,
          cost: 25000
        }
      ]
    }
  ];

  private equipmentDatabase = [
    { id: 'EQ001', name: 'ポンプA-1', type: 'ポンプ', location: 'プラント1' },
    { id: 'EQ002', name: 'コンプレッサーB-2', type: 'コンプレッサー', location: 'プラント2' },
    { id: 'EQ003', name: 'モーターC-3', type: 'モーター', location: 'プラント1' },
    { id: 'EQ004', name: 'バルブD-4', type: 'バルブ', location: 'プラント3' },
    { id: 'EQ005', name: 'ファンE-5', type: 'ファン', location: 'プラント2' },
    { id: 'EQ006', name: 'ヒーターF-6', type: 'ヒーター', location: 'プラント1' },
    { id: 'EQ007', name: 'センサーG-7', type: 'センサー', location: 'プラント3' }
  ];

  async generateResponse(userInput: string): Promise<AIResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const lowerInput = userInput.toLowerCase();
    
    // Find matching pattern
    const matchedPattern = this.responsePatterns.find(pattern =>
      pattern.keywords.some(keyword => lowerInput.includes(keyword))
    );

    if (matchedPattern) {
      const randomResponse = matchedPattern.responses[
        Math.floor(Math.random() * matchedPattern.responses.length)
      ];
      
      // Randomly select some suggestions
      const selectedSuggestions = matchedPattern.suggestions
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * matchedPattern.suggestions.length) + 1);

      return {
        success: true,
        content: randomResponse,
        suggestions: selectedSuggestions
      };
    }

    // Check if user is asking about specific equipment
    const equipmentMatch = this.equipmentDatabase.find(eq =>
      lowerInput.includes(eq.id.toLowerCase()) || 
      lowerInput.includes(eq.name.toLowerCase())
    );

    if (equipmentMatch) {
      return {
        success: true,
        content: `${equipmentMatch.name}（${equipmentMatch.id}）についてお答えします。この設備は${equipmentMatch.location}に設置されている${equipmentMatch.type}です。具体的にどのような情報をお求めでしょうか？`,
        suggestions: [
          {
            equipmentId: equipmentMatch.id,
            timeHeader: '2024-05',
            suggestedAction: 'plan',
            reason: `${equipmentMatch.name}の定期点検を推奨`,
            confidence: 0.80,
            cost: Math.floor(Math.random() * 100000) + 30000
          }
        ]
      };
    }

    // Default response for unmatched input
    const defaultResponses = [
      'ご質問ありがとうございます。設備保全に関する具体的な質問をいただければ、より詳細な分析と提案を行うことができます。',
      '申し訳ございませんが、その内容については十分な情報がありません。設備の保全、故障予測、コスト最適化などについてお聞かせください。',
      '設備保全に関するご質問でしたら、具体的な設備名や問題の詳細をお教えいただけますでしょうか。',
      'より具体的な情報をいただければ、適切なアドバイスを提供できます。設備ID、症状、時期などの詳細をお聞かせください。'
    ];

    return {
      success: true,
      content: defaultResponses[Math.floor(Math.random() * defaultResponses.length)]
    };
  }

  async analyzeEquipmentStatus(equipmentIds: string[]): Promise<MaintenanceSuggestion[]> {
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const suggestions: MaintenanceSuggestion[] = [];

    equipmentIds.forEach(id => {
      const equipment = this.equipmentDatabase.find(eq => eq.id === id);
      if (equipment) {
        // Generate random suggestions based on equipment type
        const actions: ('plan' | 'actual' | 'both')[] = ['plan', 'actual', 'both'];
        const reasons = [
          '定期点検時期が近づいています',
          '稼働時間が基準値を超過',
          '過去の故障履歴から予防保全を推奨',
          'センサーデータに異常傾向を検出',
          'メーカー推奨メンテナンス時期に到達'
        ];

        suggestions.push({
          equipmentId: id,
          timeHeader: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}`,
          suggestedAction: actions[Math.floor(Math.random() * actions.length)],
          reason: reasons[Math.floor(Math.random() * reasons.length)],
          confidence: 0.6 + Math.random() * 0.4,
          cost: Math.floor(Math.random() * 150000) + 20000
        });
      }
    });

    return suggestions;
  }

  async generateMaintenanceReport(equipmentId: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const equipment = this.equipmentDatabase.find(eq => eq.id === equipmentId);
    if (!equipment) {
      return `設備ID ${equipmentId} が見つかりません。`;
    }

    const reportSections = [
      `## ${equipment.name} (${equipment.id}) 保全レポート`,
      '',
      '### 現在の状態',
      '- 稼働状況: 正常',
      '- 最終メンテナンス: 2024年2月15日',
      '- 累積稼働時間: 2,450時間',
      '',
      '### 推奨アクション',
      '- 次回定期点検: 2024年5月15日',
      '- 消耗部品交換: 2024年6月30日',
      '- オーバーホール: 2025年2月15日',
      '',
      '### 注意事項',
      '- 振動レベルが若干上昇傾向',
      '- 潤滑油の交換を推奨',
      '- 温度センサーの校正が必要'
    ];

    return reportSections.join('\n');
  }
}

interface ResponsePattern {
  keywords: string[];
  responses: string[];
  suggestions: MaintenanceSuggestion[];
}

export const mockAIService = new MockAIService();