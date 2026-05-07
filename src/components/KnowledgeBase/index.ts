/**
 * Knowledge Base UI バレル。
 *
 * 親コンポーネント KnowledgeBasePage を default + named export。
 * 個別画面はテストや独立利用のため named export 経由でも取り出し可能。
 */

export { KnowledgeBasePage, default } from './KnowledgeBasePage'
export { Dashboard } from './Dashboard'
export { RuleEditor } from './RuleEditor'
export { MasterMapView } from './MasterMapView'
export { MappingSimilaritySearch } from './MappingSimilaritySearch'
export { LocationPatternView, ClassificationPatternView } from './PatternViews'
export { LoRAAdapterManager } from './LoRAAdapterManager'
export { TrainingCacheView } from './TrainingCacheView'
export { LearningHistoryView } from './LearningHistoryView'
