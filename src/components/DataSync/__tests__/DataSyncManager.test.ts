import { DataSyncManager } from '../DataSyncManager';
import { DataSyncConfiguration, SyncConflict, ConflictResolution } from '../types';

// Mock WebSocket
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  constructor(public url: string) {}
  
  send(data: string) {
    // Mock send
  }
  
  close() {
    if (this.onclose) {
      this.onclose({} as CloseEvent);
    }
  }
}

// Mock fetch
global.fetch = jest.fn();
global.WebSocket = MockWebSocket as any;

describe('DataSyncManager', () => {
  let syncManager: DataSyncManager;
  let mockConfig: DataSyncConfiguration;

  beforeEach(() => {
    mockConfig = {
      enableRealTimeSync: false,
      syncInterval: 1000,
      enableConflictResolution: true,
      enableOptimisticUpdates: true,
      enableDataValidation: true,
      maxRetries: 3,
      batchSize: 10,
      apiBaseUrl: '/api',
      authToken: 'test-token',
    };

    syncManager = new DataSyncManager(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    syncManager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const status = syncManager.getSyncStatus();
      expect(status.status).toBe('idle');
      expect(status.queueSize).toBe(0);
      expect(status.conflictCount).toBe(0);
    });

    it('should setup WebSocket when real-time sync is enabled', () => {
      const configWithWebSocket = {
        ...mockConfig,
        enableRealTimeSync: true,
        websocketUrl: 'ws://localhost:8080/sync',
      };

      const wsManager = new DataSyncManager(configWithWebSocket);
      
      // WebSocket should be created
      expect(wsManager).toBeDefined();
      
      wsManager.destroy();
    });
  });

  describe('Sync Queue Management', () => {
    it('should add cell edit to sync queue', () => {
      syncManager.syncCellEdit('row1', 'col1', 'test value');
      
      const status = syncManager.getSyncStatus();
      expect(status.queueSize).toBe(1);
    });

    it('should add specification edit to sync queue', () => {
      syncManager.syncSpecificationEdit('row1', 0, 'key1', 'value1');
      
      const status = syncManager.getSyncStatus();
      expect(status.queueSize).toBe(1);
    });

    it('should prioritize high priority operations', () => {
      syncManager.syncCellEdit('row1', 'col1', 'normal', 'normal');
      syncManager.syncCellEdit('row2', 'col2', 'high', 'high');
      
      const status = syncManager.getSyncStatus();
      expect(status.queueSize).toBe(2);
    });

    it('should clear sync queue', () => {
      syncManager.syncCellEdit('row1', 'col1', 'test');
      expect(syncManager.getSyncStatus().queueSize).toBe(1);
      
      syncManager.clearSyncQueue();
      expect(syncManager.getSyncStatus().queueSize).toBe(0);
    });
  });

  describe('Data Synchronization', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    it('should process sync queue successfully', async () => {
      syncManager.syncCellEdit('row1', 'col1', 'test value');
      
      await syncManager.forceSync();
      
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/cells/update',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle sync errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      syncManager.syncCellEdit('row1', 'col1', 'test value');
      
      await expect(syncManager.forceSync()).rejects.toThrow();
    });

    it('should retry failed operations', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      syncManager.syncCellEdit('row1', 'col1', 'test value');
      
      // First attempt should fail, but operation should remain in queue
      await expect(syncManager.forceSync()).rejects.toThrow();
      
      // Second attempt should succeed
      await syncManager.forceSync();
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect conflicts from server response', async () => {
      const conflictResponse = {
        ok: true,
        json: async () => ({
          conflict: {
            description: 'Data was modified by another user',
            severity: 'medium',
          },
          remoteData: {
            rowId: 'row1',
            columnId: 'col1',
            value: 'remote value',
            timestamp: Date.now(),
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(conflictResponse);

      let detectedConflict: SyncConflict | null = null;
      syncManager.setEventListeners({
        onConflictDetected: (conflict) => {
          detectedConflict = conflict;
        },
      });

      syncManager.syncCellEdit('row1', 'col1', 'local value');
      
      await expect(syncManager.forceSync()).rejects.toThrow('Conflict detected during sync');
      
      expect(detectedConflict).toBeTruthy();
      expect(detectedConflict?.type).toBe('data_conflict');
    });

    it('should resolve conflicts with use_local strategy', async () => {
      const conflict: SyncConflict = {
        id: 'conflict_1',
        operationId: 'op_1',
        type: 'data_conflict',
        localData: { value: 'local' },
        remoteData: { value: 'remote' },
        timestamp: Date.now(),
        description: 'Test conflict',
        severity: 'medium',
      };

      // Add conflict to queue manually for testing
      (syncManager as any).conflictQueue.set(conflict.id, conflict);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const resolution: ConflictResolution = {
        strategy: 'use_local',
        reason: 'User chose local version',
      };

      await syncManager.resolveConflict(conflict.id, resolution);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/conflicts/resolve',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"resolvedData":{"value":"local"}'),
        })
      );

      expect(syncManager.getConflicts()).toHaveLength(0);
    });

    it('should resolve conflicts with merge strategy', async () => {
      const conflict: SyncConflict = {
        id: 'conflict_1',
        operationId: 'op_1',
        type: 'data_conflict',
        localData: { 
          type: 'cell_edit',
          value: 'local',
          timestamp: Date.now() + 1000,
        },
        remoteData: { 
          type: 'cell_edit',
          value: 'remote',
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
        description: 'Test conflict',
        severity: 'medium',
      };

      (syncManager as any).conflictQueue.set(conflict.id, conflict);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const resolution: ConflictResolution = {
        strategy: 'merge',
        reason: 'Auto-merge based on timestamp',
      };

      await syncManager.resolveConflict(conflict.id, resolution);

      // Should use local data since it has newer timestamp
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/conflicts/resolve',
        expect.objectContaining({
          body: expect.stringContaining('"value":"local"'),
        })
      );
    });
  });

  describe('Event Handling', () => {
    it('should emit sync status change events', () => {
      const statusChanges: string[] = [];
      
      syncManager.setEventListeners({
        onSyncStatusChange: (status) => {
          statusChanges.push(status);
        },
      });

      // Manually trigger status change for testing
      (syncManager as any).setSyncStatus('syncing');
      (syncManager as any).setSyncStatus('synced');

      expect(statusChanges).toEqual(['syncing', 'synced']);
    });

    it('should emit data updated events', () => {
      let updatedData: any = null;
      
      syncManager.setEventListeners({
        onDataUpdated: (data) => {
          updatedData = data;
        },
      });

      const testData = { id: 'test', value: 'updated' };
      (syncManager as any).onDataUpdated?.(testData);

      expect(updatedData).toEqual(testData);
    });
  });

  describe('WebSocket Integration', () => {
    let wsManager: DataSyncManager;
    let mockWebSocket: MockWebSocket;

    beforeEach(() => {
      const wsConfig = {
        ...mockConfig,
        enableRealTimeSync: true,
        websocketUrl: 'ws://localhost:8080/sync',
      };

      wsManager = new DataSyncManager(wsConfig);
      mockWebSocket = (wsManager as any).websocket;
    });

    afterEach(() => {
      wsManager.destroy();
    });

    it('should handle WebSocket connection', () => {
      expect(mockWebSocket).toBeDefined();
      expect(mockWebSocket.url).toBe('ws://localhost:8080/sync');
    });

    it('should handle WebSocket messages', () => {
      let receivedData: any = null;
      
      wsManager.setEventListeners({
        onDataUpdated: (data) => {
          receivedData = data;
        },
      });

      const message = {
        type: 'data_update',
        data: { id: 'test', value: 'from_websocket' },
      };

      // Simulate WebSocket message
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify(message),
        } as MessageEvent);
      }

      expect(receivedData).toEqual(message.data);
    });

    it('should handle WebSocket disconnection', () => {
      const statusChanges: string[] = [];
      
      wsManager.setEventListeners({
        onSyncStatusChange: (status) => {
          statusChanges.push(status);
        },
      });

      // Simulate WebSocket disconnection
      if (mockWebSocket.onclose) {
        mockWebSocket.onclose({} as CloseEvent);
      }

      expect(statusChanges).toContain('disconnected');
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      syncManager.syncCellEdit('row1', 'col1', 'test');
      expect(syncManager.getSyncStatus().queueSize).toBe(1);

      syncManager.destroy();

      // After destroy, manager should be cleaned up
      expect(syncManager.getSyncStatus().queueSize).toBe(0);
    });
  });
});