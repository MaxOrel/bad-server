import { NextFunction, Request, Response } from 'express'
import ForbiddenError from '../errors/forbidden-error'

export function validateCsrf(req: Request, _res: Response, next: NextFunction) {
    const CSRF_COOKIE_NAME = '_csrf'

    if (
        req.method === 'GET' ||
        req.method === 'HEAD' ||
        req.method === 'OPTIONS'
    ) {
        return next()
    }

    const cookieToken = req.cookies[CSRF_COOKIE_NAME]
    const headerToken = req.header('X-CSRF-Token')

    if (!cookieToken || !headerToken || headerToken !== cookieToken) {
        return next(new ForbiddenError('Невалидный CSRF-токен'))
    }

    return next()
}
