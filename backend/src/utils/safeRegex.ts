const MAX_REGEX_INPUT_LENGTH = 200
const REGEX_TIMEOUT_MS = 100

export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasDangerousPattern(str: string): boolean {
    const dangerousPatterns = [
        /\(\*\)/,
        /\(\+\)/,
        /\(\?=/,
        /\(\?!/,
        /\{\d+,\d+\}/,
        /\(\w+\|/,
        /\*\+/,
        /\+\+/,
    ]

    const hasPattern = dangerousPatterns.some(pattern => pattern.test(str))
    return hasPattern
}

export function safeRegexTest(
    regex: RegExp,
    str: string,
    maxLength: number = MAX_REGEX_INPUT_LENGTH
): boolean {
    if (str.length > maxLength) {
        console.warn(`Regex input too long: ${str.length} > ${maxLength}`)
        return false
    }

    const regexSource = regex.source
    if (hasDangerousPattern(regexSource)) {
        console.warn(`Dangerous regex pattern detected: ${regexSource}`)
        return false
    }

    let result = false
    let completed = false

    const timeoutId = setTimeout(() => {
        if (!completed) {
            throw new Error(`Regex execution timeout after ${REGEX_TIMEOUT_MS}ms`)
        }
    }, REGEX_TIMEOUT_MS)

    try {
        result = regex.test(str)
        completed = true
        clearTimeout(timeoutId)
        return result
    } catch (error) {
        clearTimeout(timeoutId)
        console.error('Regex execution error:', error)
        return false
    }
}

export function createSafeSearchRegex(searchTerm: string): RegExp {
    const safeTerm = searchTerm.slice(0, MAX_REGEX_INPUT_LENGTH)
    const escaped = escapeRegex(safeTerm)
    return new RegExp(escaped, 'i')
}

export function safeEmailValidate(email: string): boolean {
    if (email.length > 254) return false

    const parts = email.split('@')
    if (parts.length !== 2) return false
    if (parts[0].length === 0 || parts[1].length === 0) return false
    if (parts[0].length > 64) return false
    if (parts[1].length > 255) return false

    const domainParts = parts[1].split('.')
    if (domainParts.length < 2) return false

    return true
}

export function safePhoneValidate(phone: string): boolean {
    if (phone.length > 20) return false
    const safePattern = /^[\d+\-()\s]{5,20}$/
    return safePattern.test(phone)
}