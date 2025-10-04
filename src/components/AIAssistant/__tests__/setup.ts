// Test setup for AI Assistant components

// Mock DOM methods that are not available in test environment
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: jest.fn(),
  writable: true
});

// Mock console methods to reduce noise in test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Mock console.error and console.warn to avoid noise in tests
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock File and FileReader for Excel processing tests
global.File = class MockFile {
  name: string;
  size: number;
  type: string;
  
  constructor(bits: any[], filename: string, options: any = {}) {
    this.name = filename;
    this.size = bits.reduce((acc, bit) => {
      if (typeof bit === 'string') {
        return acc + bit.length;
      }
      if (bit && typeof bit.size === 'number') {
        return acc + bit.size;
      }
      return acc + (bit.length || 0);
    }, 0);
    this.type = options.type || '';
  }
} as any;

global.FileReader = class MockFileReader {
  result: any = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  readAsArrayBuffer(file: any) {
    setTimeout(() => {
      this.result = new ArrayBuffer(8);
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
} as any;

// Mock Blob
global.Blob = class MockBlob {
  size: number;
  type: string;
  
  constructor(parts: any[], options: any = {}) {
    this.size = parts.reduce((acc, part) => {
      if (typeof part === 'string') {
        return acc + part.length;
      }
      return acc + (part.length || 0);
    }, 0);
    this.type = options.type || '';
  }
} as any;

export {};