import { safeFormatNumber } from './sanitize';

export function addSpacesToNumber(num: number) {
    // ✅ ИСПРАВЛЕНО: используем безопасное форматирование
    return safeFormatNumber(num);
}