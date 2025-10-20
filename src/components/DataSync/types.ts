// Data Synchronization Configuration
export interface DataSyncConfiguration {
  enableRealTimeSync: boolean;
  syncInterval: number;
  enableConflictResolution: boolean;
  enableOptimisticUpdates: boolean;
  enableDataValidation: boolean;
  maxRetries: number;
  batchSize?: number;
  apiBaseUrl?: string;
  websocketUrl?: string;
  authToken?: string;
}

// Sync Operation
export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  itemId: string;
  data: any;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Sync Status
export type SyncStatus = 
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'synced'
  | 'disconnected'
  | 'error';

// Sync Conflict
export interface SyncConflict {
  id: string;
  operationId: string;
  type: 'data_conflict' | 'timestamp_conflict' | 'version_conflict' | 'permission_conflict';
  localData: any;
  remoteData: any;
  timestamp: number;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Conflict Resolution
export interface ConflictResolution {
  strategy: 'use_local' | 'use_remote' | 'merge' | 'manual';
  manualData?: any;
  reason?: string;
}

// Data Integrity Check
export interface DataIntegrityCheck {
  isValid: boolean;
  violations: string[];
  timestamp: number;
}

// Sync Event
export interface SyncEvent {
  type: 'status_change' | 'conflict_detected' | 'data_updated' | 'integrity_violation';
  timestamp: number;
  data: any;
}

// Real-time Sync Message
export interface RealtimeSyncMessage {
  type: 'data_update' | 'conflict_detected' | 'sync_status' | 'heartbeat';
  timestamp: number;
  data?: any;
  conflict?: SyncConflict;
  status?: any;
}

// Sync Statistics
export interface SyncStatistics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  conflictCount: number;
  averageSyncTime: number;
  lastSyncTimestamp: number;
  dataIntegrityScore: number;
}

// Optimistic Update
export interface OptimisticUpdate {
  id: string;
  operation: SyncOperation;
  rollbackData: any;
  timestamp: number;
  applied: boolean;
}

// Sync Queue Configuration
export interface SyncQueueConfig {
  maxQueueSize: number;
  priorityLevels: ('high' | 'normal' | 'low')[];
  batchProcessing: boolean;
  batchSize: number;
  processingInterval: number;
}

// Conflict Resolution UI
export interface ConflictResolutionUI {
  conflictId: string;
  title: string;
  description: string;
  localPreview: any;
  remotePreview: any;
  suggestedResolution: ConflictResolution;
  availableStrategies: ConflictResolution[];
}

// Data Validation Rule
export interface DataValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

// Sync Performance Metrics
export interface SyncPerformanceMetrics {
  operationsPerSecond: number;
  averageLatency: number;
  networkUtilization: number;
  memoryUsage: number;
  errorRate: number;
  conflictRate: number;
}

// Data Consistency Check
export interface DataConsistencyCheck {
  checkId: string;
  timestamp: number;
  itemId: string;
  localChecksum: string;
  remoteChecksum: string;
  isConsistent: boolean;
  inconsistencies: string[];
}

// Sync Batch
export interface SyncBatch {
  id: string;
  operations: SyncOperation[];
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
}

// Connection Status
export interface ConnectionStatus {
  isConnected: boolean;
  connectionType: 'websocket' | 'polling' | 'offline';
  latency: number;
  lastHeartbeat: number;
  reconnectAttempts: number;
}

// Sync Policy
export interface SyncPolicy {
  conflictResolution: 'auto' | 'manual' | 'hybrid';
  autoMergeStrategy: 'timestamp' | 'user_priority' | 'field_level';
  optimisticUpdates: boolean;
  batchingEnabled: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

// Data Versioning
export interface DataVersion {
  version: number;
  timestamp: number;
  userId: string;
  changes: DataChange[];
  checksum: string;
}

// Data Change
export interface DataChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
  userId: string;
}

// Sync Middleware
export interface SyncMiddleware {
  name: string;
  beforeSync?: (operation: SyncOperation) => Promise<SyncOperation>;
  afterSync?: (operation: SyncOperation, result: any) => Promise<void>;
  onError?: (operation: SyncOperation, error: Error) => Promise<void>;
}

// Offline Sync Strategy
export interface OfflineSyncStrategy {
  enableOfflineQueue: boolean;
  maxOfflineOperations: number;
  offlineStorageType: 'localStorage' | 'indexedDB' | 'memory';
  syncOnReconnect: boolean;
  conflictResolutionOnReconnect: 'auto' | 'manual';
}

// Sync Security
export interface SyncSecurity {
  enableAuthentication: boolean;
  enableAuthorization: boolean;
  enableEncryption: boolean;
  enableSignature: boolean;
  tokenRefreshInterval: number;
  maxSessionDuration: number;
}

// Multi-device Sync
export interface MultiDeviceSync {
  deviceId: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  lastSyncTimestamp: number;
  pendingOperations: SyncOperation[];
  conflictingOperations: SyncOperation[];
}

// Sync Analytics
export interface SyncAnalytics {
  sessionId: string;
  userId: string;
  deviceInfo: {
    type: 'desktop' | 'tablet' | 'mobile';
    userAgent: string;
    screenSize: { width: number; height: number };
  };
  syncMetrics: {
    totalOperations: number;
    successRate: number;
    averageLatency: number;
    conflictRate: number;
  };
  performanceMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    networkUsage: number;
  };
  errorLog: {
    timestamp: number;
    error: string;
    context: any;
  }[];
}

// Sync Event Handlers
export interface SyncEventHandlers {
  onSyncStart?: () => void;
  onSyncComplete?: (statistics: SyncStatistics) => void;
  onSyncError?: (error: Error, operation?: SyncOperation) => void;
  onConflictDetected?: (conflict: SyncConflict) => void;
  onConflictResolved?: (conflictId: string, resolution: ConflictResolution) => void;
  onDataUpdated?: (data: any) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onIntegrityViolation?: (check: DataIntegrityCheck) => void;
}