import { Types } from 'mongoose'
import { Request, Response, NextFunction } from 'express'
import BadRequestError from '../errors/bad-request-error'

export function validateObjectId(id: string | null | undefined): Types.ObjectId | null {
    if (!id) return null
    if (Types.ObjectId.isValid(id)) {
        return new Types.ObjectId(id)
    }
    return null
}

export function validateIdParam(paramName: string) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const id = req.params[paramName]

        if (!id) {
            return next(new BadRequestError(`Параметр ${paramName} обязателен`))
        }

        if (!Types.ObjectId.isValid(id)) {
            return next(new BadRequestError(`Невалидный формат ${paramName}`))
        }

        req.params[paramName] = new Types.ObjectId(id).toString()
        next()
    }
}

export function validateObjectIdsArray(ids: any[]): boolean {
    if (!Array.isArray(ids)) return false
    return ids.every(id => Types.ObjectId.isValid(id))
}

export function sanitizeQueryFilters(filters: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}

    const keys = Object.keys(filters)
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        const value = filters[key]

        if (key.startsWith('$')) {
            // eslint-disable-next-line no-continue
            continue
        }

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeQueryFilters(value)
        } else if (Array.isArray(value)) {
            const mappedValues = value.map(v => {
                if (typeof v === 'string') {
                    return v.replace(/[$.]/g, '_')
                }
                return v
            })
            sanitized[key] = mappedValues
        } else if (typeof value === 'string') {
            sanitized[key] = value.replace(/[$.]/g, '_')
        } else {
            sanitized[key] = value
        }
    }

    return sanitized
}