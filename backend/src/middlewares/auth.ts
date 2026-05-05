import { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Model, Types } from 'mongoose'
import { ACCESS_TOKEN } from '../config'
import ForbiddenError from '../errors/forbidden-error'
import NotFoundError from '../errors/not-found-error'
import UnauthorizedError from '../errors/unauthorized-error'
import UserModel, { Role } from '../models/user'

const auth = async (req: Request, res: Response, next: NextFunction) => {
    let payload: JwtPayload | null = null
    const authHeader = req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return next(new UnauthorizedError('Невалидный токен'))
    }
    try {
        const accessTokenParts = authHeader.split(' ')
        const aTkn = accessTokenParts[1]
        payload = jwt.verify(aTkn, ACCESS_TOKEN.secret) as JwtPayload

        const user = await UserModel.findOne(
            {
                _id: new Types.ObjectId(payload.sub),
            },
            { password: 0, salt: 0 }
        )

        if (!user) {
            return next(new ForbiddenError('Нет доступа'))
        }
        res.locals.user = user

        return next()
    } catch (error) {
        if (error instanceof Error && error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Истек срок действия токена'))
        }
        return next(new UnauthorizedError('Необходима авторизация'))
    }
}

export function roleGuardMiddleware(...roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!res.locals.user) {
            return next(new UnauthorizedError('Необходима авторизация'))
        }

        const userRoles: Role[] = res.locals.user.roles || []

        if (!Array.isArray(userRoles)) {
            return next(new ForbiddenError('Доступ запрещен: некорректные роли'))
        }

        const hasAccess = roles.some(role => userRoles.includes(role))

        if (!hasAccess) {
            return next(new ForbiddenError('Доступ запрещен'))
        }

        return next()
    }
}

export function currentUserAccessMiddleware<T>(
    model: Model<T>,
    idProperty: string,
    userProperty: keyof T
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const id = req.params[idProperty]

        if (!res.locals.user) {
            return next(new UnauthorizedError('Необходима авторизация'))
        }

        const userRoles = res.locals.user.roles || []
        if (userRoles.includes(Role.Admin)) {
            return next()
        }

        const entity = await model.findById(id)

        if (!entity) {
            return next(new NotFoundError('Не найдено'))
        }

        const userEntityId = entity[userProperty] as Types.ObjectId
        const hasAccess = new Types.ObjectId(res.locals.user.id).equals(
            userEntityId
        )

        if (!hasAccess) {
            return next(new ForbiddenError('Доступ запрещен'))
        }

        return next()
    }
}

export default auth