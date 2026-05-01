import DOMPurify from 'dompurify';

// Настройки DOMPurify для максимальной безопасности
DOMPurify.setConfig({
    ALLOWED_TAGS: [], // Запрещаем все HTML-теги
    ALLOWED_ATTR: [], // Запрещаем все атрибуты
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    USE_PROFILES: { html: false, svg: false, mathMl: false }
});

/**
 * Санитизация пользовательского ввода для отображения в HTML
 */
export function sanitizeInput(input: string | null | undefined): string {
    if (!input) return '';
    return DOMPurify.sanitize(String(input));
}

/**
 * Санитизация для атрибутов (например, title, alt)
 */
export function sanitizeAttribute(input: string | null | undefined): string {
    if (!input) return '';
    // Удаляем любые потенциально опасные конструкции
    return String(input)
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
}

/**
 * Безопасное форматирование чисел
 */
export function safeFormatNumber(num: number | string | null | undefined): string {
    if (num === null || num === undefined) return '0';
    const number = Number(num);
    if (isNaN(number)) return '0';
    return number.toLocaleString('ru-RU');
}