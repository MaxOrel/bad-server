import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import ForbiddenError from '../errors/forbidden-error'

export default function serveStatic(baseDir: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        // Определяем полный путь к запрашиваемому файлу
        const filePath = path.resolve(baseDir, `.${req.path}`)

        if (!filePath.startsWith(path.resolve(baseDir))) {
            return next(new ForbiddenError('Файл не найден'))
        }

        // Проверяем, существует ли файл
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                // Файл не существует отдаем дальше мидлварам
                return next()
            }
            // Файл существует, отправляем его клиенту
            return res.sendFile(filePath, { maxAge: '1d' }, (error) => {
                if (error) {
                    next(error)
                }
            })
        })
    }
}
