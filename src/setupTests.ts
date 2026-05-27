import '@testing-library/jest-dom';
import React from 'react';

// Mock framer-motion to avoid animation issues in tests
type FramerMotionProps = React.PropsWithChildren<Record<string, unknown>>;
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: FramerMotionProps) => React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: FramerMotionProps) => children,
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
