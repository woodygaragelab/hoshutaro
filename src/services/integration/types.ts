/**
 * Integration Types — 外部連携・プラグイン基盤 型定義
 *
 * 設計書 Part 1 §1〜§7 準拠
 * MCP Server コネクタ / LLM Adapter / Skill / Plugin の共通インターフェース
 */

// ============================================================================
// Connector Configuration
// ============================================================================

/** コネクタの接続設定 */
export interface ConnectorConfig {
  id: string;                    // コネクタ一意ID (e.g., "maximo-prod-01")
  connectorType: string;         // コネクタ種別 (e.g., "maximo", "sap-pm")
  name: string;                  // 表示名 (e.g., "本番Maximo")
  enabled: boolean;
  connection: {
    baseUrl: string;
    authType: 'apikey' | 'oauth2' | 'basic';
    credentials: Record<string, string>;  // 暗号化保存
    timeout: number;
    retryCount: number;
    retryDelay: number;
  };
  sync: {
    direction: 'import' | 'export' | 'bidirectional';
    batchSize: number;           // 1バッチあたりの件数 (default: 500)
    maxConcurrent: number;       // 最大並列リクエスト数
    rateLimitPerMinute: number;
  };
  fieldMappings: EntityFieldMapping[];
}

/** エンティティ単位のフィールドマッピング定義 */
export interface EntityFieldMapping {
  sourceEntity: string;          // 保守太郎側エンティティ
  targetEntity: string;          // 外部側エンティティ
  targetObjectStructure: string; // Maximo Object Structure名 等
  direction: 'import' | 'export' | 'bidirectional';
  keyField: { source: string; target: string };
  fields: FieldMap[];
  transformers?: FieldTransformer[];
}

/** 個別フィールドのマッピング */
export interface FieldMap {
  source: string;                // 保守太郎フィールドパス (ドット記法)
  target: string;                // 外部システムフィールドパス
  direction: 'import' | 'export' | 'bidirectional';
  required: boolean;
  defaultValue?: unknown;
  transform?: 'none' | 'date_iso' | 'date_maximo' | 'number' | 'boolean' | 'custom';
  customTransformId?: string;
}

/** カスタム変換 */
export interface FieldTransformer {
  id: string;
  name: string;
  // runtime-only: transform function is not serialized
}

// ============================================================================
// Sync Results & Errors
// ============================================================================

/** 同期結果 */
export interface SyncResult {
  connectorId: string;
  entity: string;
  direction: 'import' | 'export';
  status: 'success' | 'partial' | 'failed';
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  errors: SyncError[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

/** 同期エラー */
export interface SyncError {
  recordId: string;
  field?: string;
  errorCode: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
}

/** 差分プレビュー */
export interface DiffRecord {
  id: string;
  entity: string;
  action: 'create' | 'update' | 'delete' | 'unchanged';
  source: Record<string, unknown> | null;
  target: Record<string, unknown> | null;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
}

/** バッチ進捗 */
export interface BatchProgress {
  entity: string;
  currentBatch: number;
  totalBatches: number;
  processedRecords: number;
  totalRecords: number;
  percentage: number;
  estimatedTimeRemainingMs: number;
  errors: SyncError[];
}

/** 監査ログ */
export interface SyncAuditLog {
  id: string;
  timestamp: string;
  connectorId: string;
  operation: 'import' | 'export' | 'test';
  entities: string[];
  result: SyncResult;
  backupPath?: string;
}

// ============================================================================
// Plugin System
// ============================================================================

/** プラグインカテゴリ */
export type PluginCategory = 'connector' | 'llm-adapter' | 'utility';

/** プラグインライセンス種別 */
export type PluginLicense = 'free' | 'premium';

/** プラグインの実行状態 */
export type PluginStatus = 'running' | 'stopped' | 'error' | 'installing';

/** プラグイン設定スキーマの個別フィールド */
export interface PluginConfigSchemaField {
  type: 'string' | 'secret' | 'number' | 'boolean' | 'select';
  label: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];  // type="select" の場合
}

/** プラグインマニフェスト (manifest.json) */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  category: PluginCategory;
  icon: string;
  license: PluginLicense;
  minAppVersion: string;
  transport: 'stdio';
  command: string;
  tools: string[];
  configSchema: Record<string, PluginConfigSchemaField>;
}

/** プラグイン情報 (UIレンダリング用) */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  category: PluginCategory;
  icon: string;
  license: PluginLicense;
  status: PluginStatus;
  installed: boolean;
  config?: Record<string, string>;
  manifest?: PluginManifest;
  repository?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
}

/** プラグインレジストリエントリ */
export interface PluginRegistryEntry {
  id: string;
  name: string;
  version: string;
  category: PluginCategory;
  icon: string;
  license: PluginLicense;
  repository: string;
  releaseTag: string;
  artifactPattern: string;
  platforms: string[];
  bundled: boolean;
}

/** プラグインレジストリ */
export interface PluginRegistry {
  registryVersion: string;
  plugins: PluginRegistryEntry[];
}

// ============================================================================
// Skill System
// ============================================================================

/** Skill パラメータ定義 */
export interface SkillParameter {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multi_select' | 'boolean';
  options?: string[];
  default?: unknown;
  required?: boolean;
}

/** Skill 安全性設定 */
export interface SkillSafety {
  requires_confirmation: boolean;
  max_records?: number;
  backup_before_write?: boolean;
}

/** Skill 定義 (YAML解析後) */
export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  type: 'builtin' | 'user';
  description: string;
  icon: string;
  required_servers: { type: string }[];
  system_prompt: string;
  parameters: SkillParameter[];
  safety: SkillSafety;
}

/** Skill 実行状態 */
export type SkillExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Skill 実行進捗 */
export interface SkillExecutionProgress {
  skillId: string;
  status: SkillExecutionStatus;
  currentStep: string;
  progress: number;           // 0-100
  logs: SkillExecutionLog[];
  result?: unknown;
  error?: string;
}

/** Skill 実行ログエントリ */
export interface SkillExecutionLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  toolName?: string;
  toolResult?: unknown;
}

// ============================================================================
// License & Subscription
// ============================================================================

/** ライセンスプラン */
export type LicensePlan = 'free' | 'standard' | 'enterprise' | 'dev';

/** ライセンス情報 */
export interface LicenseInfo {
  plan: LicensePlan;
  isDevMode: boolean;
  geminiQuota: number;         // 月間上限
  geminiUsed: number;          // 今月使用数
  enabledPlugins: string[];
  expiresAt: string;
}

// ============================================================================
// Update System
// ============================================================================

/** アプリ更新情報 */
export interface UpdateInfo {
  available: boolean;
  latestVersion?: string;
  currentVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}
