/**
 * Device Optimizations
 * Device-specific error messages and optimizations
 */

import { DeviceType } from '../CommonEdit/deviceDetection';

/**
 * Generate device-specific error messages
 */
export function generateDeviceErrorMessages(
  error: Error,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deviceType: DeviceType = 'desktop'
): string {
  // Since this is a desktop-only app, always return desktop-optimized messages
  const baseMessage = error.message || 'An error occurred';
  
  return `${baseMessage}\n\nPlease refresh the page or contact support if the issue persists.`;
}

/**
 * Get device-specific performance recommendations
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getPerformanceRecommendations(deviceType: DeviceType = 'desktop'): string[] {
  // Desktop-only recommendations
  return [
    'Use a modern browser (Chrome, Edge, Firefox)',
    'Ensure sufficient memory is available',
    'Close unnecessary browser tabs',
  ];
}
