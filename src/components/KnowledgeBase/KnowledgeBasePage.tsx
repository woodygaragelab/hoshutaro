/**
 * KnowledgeBasePage — Project Mu / KASE 用ナレッジベース UI の親コンポーネント。
 *
 * baseline-ui 制約:
 *  - h-dvh: minHeight: '100dvh'
 *  - safe-area-inset を尊重（fixed 要素は使っていないが、padding に env() を使用）
 *  - aria-label を IconButton 含む全インタラクティブ要素に付与
 *  - アニメーションは MUI 既定の短い transitions のみ（150-200ms）
 *  - アクセントは success / warning / error の意味色のみ、アクセントカラー導入なし
 *
 * タブは 9画面:
 *  1. Dashboard
 *  2. Rule Editor
 *  3. Master Map
 *  4. Similarity Search
 *  5. Location Patterns
 *  6. Classification Patterns
 *  7. LoRA Adapters
 *  8. Training Cache
 *  9. Learning History
 */

import * as React from 'react'
import { Box, Container, Tab, Tabs, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Dashboard } from './Dashboard'
import { RuleEditor } from './RuleEditor'
import { MasterMapView } from './MasterMapView'
import { MappingSimilaritySearch } from './MappingSimilaritySearch'
import {
  ClassificationPatternView,
  LocationPatternView,
} from './PatternViews'
import { LoRAAdapterManager } from './LoRAAdapterManager'
import { TrainingCacheView } from './TrainingCacheView'
import { LearningHistoryView } from './LearningHistoryView'

interface Props {
  organization?: string
}

const TAB_KEYS = [
  'dashboard',
  'rules',
  'mappings',
  'similarity',
  'locations',
  'categories',
  'lora',
  'training',
  'history',
] as const
type TabKey = (typeof TAB_KEYS)[number]

const TAB_LABELS: Record<TabKey, string> = {
  dashboard: 'ダッシュボード',
  rules: 'ルール編集',
  mappings: 'マッピング',
  similarity: '類似検索',
  locations: 'Location 分析',
  categories: 'Classification 分析',
  lora: 'LoRA 管理',
  training: '学習データ',
  history: '学習履歴',
}

export function KnowledgeBasePage({ organization }: Props) {
  const theme = useTheme()
  const isSm = useMediaQuery(theme.breakpoints.down('md'))
  const [tab, setTab] = React.useState<TabKey>('dashboard')

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        // safe-area-inset: 上下に環境マージンを尊重
        pt: 'env(safe-area-inset-top, 0)',
        pb: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="xl" disableGutters>
          <Tabs
            value={tab}
            onChange={(_, v: TabKey) => setTab(v)}
            variant={isSm ? 'scrollable' : 'standard'}
            scrollButtons={isSm ? 'auto' : false}
            allowScrollButtonsMobile
            aria-label="Knowledge Base ナビゲーション"
            sx={{
              minHeight: 48,
              '& .MuiTab-root': {
                minHeight: 48,
                textTransform: 'none',
                fontWeight: 500,
              },
            }}
          >
            {TAB_KEYS.map((k) => (
              <Tab key={k} value={k} label={TAB_LABELS[k]} />
            ))}
          </Tabs>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box role="tabpanel" id={`kb-panel-${tab}`} aria-labelledby={`kb-tab-${tab}`}>
          {tab === 'dashboard' && <Dashboard organization={organization} />}
          {tab === 'rules' && <RuleEditor organization={organization} />}
          {tab === 'mappings' && <MasterMapView organization={organization} />}
          {tab === 'similarity' && <MappingSimilaritySearch organization={organization} />}
          {tab === 'locations' && <LocationPatternView organization={organization} />}
          {tab === 'categories' && <ClassificationPatternView organization={organization} />}
          {tab === 'lora' && <LoRAAdapterManager organization={organization} />}
          {tab === 'training' && <TrainingCacheView organization={organization} />}
          {tab === 'history' && <LearningHistoryView organization={organization} />}
        </Box>
      </Container>
    </Box>
  )
}

export default KnowledgeBasePage
