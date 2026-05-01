import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import fs from 'fs'
import BadRequestError from '../errors/bad-request-error'

const MAX_FILE_SIZE = 1 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }

    try {
        if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path)
            }
            return next(new BadRequestError('Неподдерживаемый тип файла. Разрешены: PNG, JPEG, GIF, WebP'))
        }

        if (req.file.size > MAX_FILE_SIZE) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path)
            }
            return next(new BadRequestError('Файл слишком большой. Максимальный размер 1MB'))
        }

        const safeOriginalName = req.file.originalname
            .replace(/[^a-zA-Z0-9а-яА-Я.\s]/g, '_')
            .slice(0, 100)

        const uploadPath = process.env.UPLOAD_PATH || 'images'
        const fileName = `/${uploadPath}/${req.file.filename}`

        return res.status(constants.HTTP_STATUS_CREATED).send({
            success: true,
            fileName,
            originalName: safeOriginalName,
            size: req.file.size,
            mimeType: req.file.mimetype,
        })
    } catch (error) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path)
            } catch (unlinkError) {
                console.error('Ошибка при удалении временного файла:', unlinkError)
            }
        }
        return next(error)
    }
}

export default {}