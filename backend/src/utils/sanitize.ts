/**
 * Санитизация строки для предотвращения XSS
 * Экранирует HTML-спецсимволы
 */
export function sanitizeHtml(str: string | null | undefined): string {
    if (!str) return ''

    const htmlEntities: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    }

    return String(str).replace(/[&<>"'/`=]/g, (char) => htmlEntities[char])
}

/**
 * Безопасное создание RegExp с экранированием спецсимволов
 * Защита от ReDoS и XSS через RegExp
 */
export function safeRegexp(str: string): RegExp {
    const MAX_SAFE_LENGTH = 100
    const safeStr = str.slice(0, MAX_SAFE_LENGTH)
    const escaped = safeStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(escaped, 'i')
}

/**
 * Валидация и очистка поискового запроса
 * Защита от ReDoS
 */
export function sanitizeSearchQuery(query: string | null | undefined): string {
    if (!query) return ''

    const MAX_SEARCH_LENGTH = 100
    const truncated = String(query).slice(0, MAX_SEARCH_LENGTH)

    const dangerousPatterns = [
        /\.\*/,
        /\.\+/,
        /\{\d+,\d+\}/,
        /\(\?:/,
        /\(\?=/,
        /\(\?!/,
        /\[\^/,
    ]

    let safe = truncated
    // ✅ Исправлено: заменён forEach на for с индексом (устранение ошибки no-restricted-syntax)
    for (let i = 0; i < dangerousPatterns.length; i += 1) {
        safe = safe.replace(dangerousPatterns[i], '')
    }

    safe = safe.replace(/[.*+?^${}()|[\]\\]/g, '')

    return safe
}

/**
 * Безопасная валидация email (без сложных regex)
 */
export function safeEmailValidate(email: string): boolean {
    if (!email) return false
    if (email.length > 254) return false

    const parts = email.split('@')
    if (parts.length !== 2) return false
    if (parts[0].length === 0 || parts[0].length > 64) return false
    if (parts[1].length === 0 || parts[1].length > 255) return false

    const domainParts = parts[1].split('.')
    if (domainParts.length < 2) return false

    return true
}

/**
 * Безопасная проверка телефона
 */
export function safePhoneValidate(phone: string): boolean {
    if (!phone) return false
    if (phone.length > 20) return false

    const safePattern = /^[\d+\-()\s]{5,20}$/
    return safePattern.test(phone)
}