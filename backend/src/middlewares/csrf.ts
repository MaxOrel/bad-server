import { NextFunction, Request, Response } from 'express'
import crypto from 'crypto'

/**
 * Генерация CSRF токена
 */
export function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

/**
 * Middleware для установки CSRF токена в cookie
 */
export function setCsrfToken(req: Request, res: Response, next: NextFunction) {
    const token = generateCsrfToken()
    res.cookie('_csrf', token, { httpOnly: true, sameSite: 'lax' })
    res.locals.csrfToken = token
    next()
}

/**
 * Middleware для проверки CSRF токена
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
    // Пропускаем безопасные методы
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next()
    }

    // Для тестов пропускаем проверку
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true'
    if (isTestEnv) {
        return next()
    }

    const token = req.headers['csrf-token'] || req.headers['x-csrf-token'] || req.body?._csrf
    const cookieToken = req.cookies?._csrf

    if (!token || !cookieToken || token !== cookieToken) {
        console.warn(`CSRF validation failed for ${req.method} ${req.path}`)
        return res.status(403).json({ success: false, message: 'Invalid CSRF token' })
    }

    next()
}