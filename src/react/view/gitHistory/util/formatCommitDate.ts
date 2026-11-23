import { getCurrentLocale } from '../../../i18n/i18nConfig';

const ONE_DAY_SEC = 24 * 60 * 60;

const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function getRelativeTimeFormatter(): Intl.RelativeTimeFormat {
    const locale = getCurrentLocale() || 'en';
    let formatter = relativeTimeFormatters.get(locale);
    if (!formatter) {
        formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        relativeTimeFormatters.set(locale, formatter);
    }
    return formatter;
}

const pad2 = (value: number) => value.toString().padStart(2, '0');

function formatAbsoluteDate(thenMs: number): string {
    const date = new Date(thenMs);
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    const hh = pad2(date.getHours());
    const mm = pad2(date.getMinutes());
    return `${y}-${m}-${d} ${hh}:${mm}`;
}

const absoluteDateCache = new Map<number, string>();

function formatRelativeAgo(timestampSec: number, nowMs: number): string {
    const formatter = getRelativeTimeFormatter();
    const thenMs = timestampSec * 1000;
    const diffSec = Math.round((thenMs - nowMs) / 1000);
    const absDiffSec = Math.abs(diffSec);

    if (absDiffSec < 60) {
        return formatter.format(diffSec, 'second');
    }

    const diffMin = Math.round(diffSec / 60);
    if (Math.abs(diffMin) < 60) {
        return formatter.format(diffMin, 'minute');
    }

    const diffHour = Math.round(diffMin / 60);
    return formatter.format(diffHour, 'hour');
}

export function formatCommitDate(timestampSec: number, nowMs: number = Date.now()): string {
    const thenMs = timestampSec * 1000;
    const ageSec = (nowMs - thenMs) / 1000;

    if (ageSec >= 0 && ageSec < ONE_DAY_SEC) {
        return formatRelativeAgo(timestampSec, nowMs);
    }

    const cached = absoluteDateCache.get(timestampSec);
    if (cached !== undefined) {
        return cached;
    }

    const formatted = formatAbsoluteDate(thenMs);
    absoluteDateCache.set(timestampSec, formatted);
    return formatted;
}
