/**
 * Device Detection Utilities
 * Detect device type for responsive behavior
 */

export type DeviceType = 'desktop' | 'tablet' | 'mobile';

/**
 * Detect the current device type
 * Note: This app is desktop-only, but this utility is kept for compatibility
 */
export function detectDevice(): DeviceType {
  // Always return desktop since this is a desktop-only app
  return 'desktop';
}

/**
 * Check if the current device is mobile
 */
export function isMobile(): boolean {
  return false; // Desktop-only app
}

/**
 * Check if the current device is tablet
 */
export function isTablet(): boolean {
  return false; // Desktop-only app
}

/**
 * Check if the current device is desktop
 */
export function isDesktop(): boolean {
  return true; // Desktop-only app
}
