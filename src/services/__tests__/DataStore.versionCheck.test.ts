/**
 * DataStore Version Checking Tests
 * 
 * Tests for version checking functionality during data load
 * Requirements 9.1: Detect and handle legacy data
 */

import { DataStore } from '../DataStore';

describe('DataStore Version Checking', () => {
  let dataStore: DataStore;

  beforeEach(() => {
    dataStore = new DataStore();
  });

  describe('Version 2.0.0 Data', () => {
    it('should successfully load data with version 2.0.0', () => {
      const validData = {
        version: '2.0.0',
        tasks: {},
        assets: {},
        associations: {},
        hierarchy: {
          levels: [
            {
              key: '製油所',
              order: 1,
              values: ['第一製油所']
            }
          ]
        },
        metadata: {
          lastModified: new Date().toISOString()
        }
      };

      expect(() => dataStore.loadData(validData)).not.toThrow();
      const loaded = dataStore.getData();
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe('2.0.0');
    });
  });

  describe('Legacy Data Detection', () => {
    it('should reject data without version field', () => {
      const legacyData = {
        tasks: {},
        assets: {},
        associations: {},
        hierarchy: { levels: [] },
        metadata: { lastModified: new Date() }
      };

      expect(() => dataStore.loadData(legacyData)).toThrow('バージョン情報が必要です');
    });

    it('should reject data with unsupported version', () => {
      const unsupportedVersionData = {
        version: '1.0.0',
        tasks: {},
        assets: {},
        associations: {},
        hierarchy: { levels: [] },
        metadata: { lastModified: new Date() }
      };

      expect(() => dataStore.loadData(unsupportedVersionData)).toThrow('サポートされていないバージョンです: 1.0.0');
    });

    it('should reject data with invalid version format', () => {
      const invalidVersionData = {
        version: '3.0.0',
        tasks: {},
        assets: {},
        associations: {},
        hierarchy: { levels: [] },
        metadata: { lastModified: new Date() }
      };

      expect(() => dataStore.loadData(invalidVersionData)).toThrow('サポートされていないバージョンです: 3.0.0');
    });
  });

  describe('Version Field Validation', () => {
    it('should validate version field is a string', () => {
      const invalidVersionType = {
        version: 2.0,
        tasks: {},
        assets: {},
        associations: {},
        hierarchy: { levels: [] },
        metadata: { lastModified: new Date() }
      };

      // Version validation happens in validateDataModel
      expect(() => dataStore.loadData(invalidVersionType)).toThrow();
    });

    it('should handle null version', () => {
      const nullVersion = {
        version: null,
        tasks: {},
        assets: {},
        associations: {},
        hierarchy: { levels: [] },
        metadata: { lastModified: new Date() }
      };

      expect(() => dataStore.loadData(nullVersion)).toThrow();
    });
  });
});
