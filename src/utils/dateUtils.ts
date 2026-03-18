
/**
 * Date utility functions for consistent time key generation across the application.
 * Ensures that both Equipment-Based and Task-Based modes use identical logic for
 * generating keys for Year, Month, Week, and Day views.
 * 
 * IMPORTANT: All functions use UTC methods to avoid timezone-dependent year/month shifts.
 * (e.g., new Date("2023-01-01") in JST would be 2022-12-31 local time without UTC methods)
 */

import { TimeScale } from '../types/maintenanceTask';

/**
 * Calculates the ISO week number and year for a given date.
 * Follows ISO 8601 standard.
 * Uses UTC methods to avoid timezone issues.
 */
export const getISOWeek = (d: Date): { year: number, week: number } => {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    // Move to Thursday of the same week
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    // The year of this Thursday is the ISO week year
    const year = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    // @ts-ignore
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return { year, week: weekNo };
};

/**
 * Generates a consistent time key string for a given date and time scale.
 * Uses UTC methods to avoid timezone-dependent shifts.
 * 
 * Formats:
 * - year: "YYYY"
 * - month: "YYYY-MM"
 * - week: "YYYY-Www"
 * - day: "YYYY-MM-DD"
 */
export const getTimeKey = (date: Date, timeScale: TimeScale): string => {
    const year = date.getUTCFullYear();
    switch (timeScale) {
        case 'year':
            return String(year);
        case 'month':
            return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        case 'week':
            const { year: isoYear, week: isoWeek } = getISOWeek(date);
            return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
        case 'day':
            return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        default:
            return String(year);
    }
};

/**
 * Generates a full range of time keys between a start and end date (inclusive).
 * This ensures no gaps in the timeline.
 * Uses UTC methods to avoid timezone-dependent shifts.
 */
export const generateTimeRange = (startDate: Date, endDate: Date, timeScale: TimeScale): string[] => {
    const keys: string[] = [];
    // Use UTC to avoid timezone issues
    const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));

    // Normalize start time based on scale to ensure clean iteration
    if (timeScale === 'year') {
        current.setUTCMonth(0, 1);
    } else if (timeScale === 'month') {
        current.setUTCDate(1);
    }
    // For week, we ideally start on Monday, but the getTimeKey handles random dates correctly anyway.

    // Iterate until we pass the end date
    // We use a safe loop limit to prevent infinite loops for safety
    let safetyCounter = 0;
    const LIMIT = 10000;

    while (current <= endDate && safetyCounter < LIMIT) {
        keys.push(getTimeKey(current, timeScale));

        // Increment based on scale
        switch (timeScale) {
            case 'year':
                current.setUTCFullYear(current.getUTCFullYear() + 1);
                break;
            case 'month':
                current.setUTCMonth(current.getUTCMonth() + 1);
                break;
            case 'week':
                current.setUTCDate(current.getUTCDate() + 7);
                break;
            case 'day':
                current.setUTCDate(current.getUTCDate() + 1);
                break;
        }
        safetyCounter++;
    }

    // Ensure the keys are unique (weeks might overlap if jump logic is imperfect)
    return Array.from(new Set(keys));
};

export const getISOWeeksInYear = (year: number): number => {
    const dec31 = new Date(Date.UTC(year, 11, 31));
    const { week } = getISOWeek(dec31);
    return week === 1 ? 52 : week;
};

/**
 * Parses a time key string back to a Date object.
 * Uses UTC to avoid timezone-dependent shifts.
 */
export const parseTimeKey = (key: string, timeScale: TimeScale): Date | null => {
    if (timeScale === 'year') {
        const year = parseInt(key, 10);
        return isNaN(year) ? null : new Date(Date.UTC(year, 0, 1));
    } else if (timeScale === 'month') {
        const [year, month] = key.split('-').map(Number);
        if (!year || !month) return null;
        return new Date(Date.UTC(year, month - 1, 1));
    } else if (timeScale === 'day') {
        const [year, month, day] = key.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(Date.UTC(year, month - 1, day));
    } else if (timeScale === 'week') {
        const match = key.match(/(\d{4})-W(\d{1,2})/);
        if (!match) return null;
        const year = parseInt(match[1], 10);
        const week = parseInt(match[2], 10);
        // Approximate start of week (Monday)
        // Simple Logic: Jan 4th is always in Week 1.
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const jan4Day = (jan4.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
        // Start of Week 1
        const week1Start = new Date(jan4.getTime() - jan4Day * 86400000);
        // Start of Target Week
        return new Date(week1Start.getTime() + (week - 1) * 7 * 86400000);
    }
    return null;
};
