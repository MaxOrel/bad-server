import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import fs from 'fs'
import path from 'path'
import BadRequestError from '../errors/bad-request-error'

const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1 MB
const MIN_FILE_SIZE = 2 * 1024 // 2 KB ✅ исправлено

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

function generateSafeFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase()
    const validExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.png'
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `${timestamp}_${random}${validExt}`
}

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
            return next(new BadRequestError('Неподдерживаемый тип файла'))
        }

        const fileExt = path.extname(req.file.originalname).toLowerCase()
        if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path)
            }
            return next(new BadRequestError('Неподдерживаемое расширение файла'))
        }

        const isPng = req.file.mimetype === 'image/png' && fileExt === '.png'
        const isJpeg = (req.file.mimetype === 'image/jpeg' || req.file.mimetype === 'image/jpg') && (fileExt === '.jpeg' || fileExt === '.jpg')
        const isGif = req.file.mimetype === 'image/gif' && fileExt === '.gif'
        const isWebp = req.file.mimetype === 'image/webp' && fileExt === '.webp'

        if (!(isPng || isJpeg || isGif || isWebp)) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path)
            }
            return next(new BadRequestError('MIME-тип файла не соответствует его расширению'))
        }

        if (req.file.size > MAX_FILE_SIZE) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path)
            }
            return next(new BadRequestError(`Файл слишком большой. Максимальный размер ${MAX_FILE_SIZE / 1024 / 1024}MB`))
        }

        // ✅ Исправлено: минимальный размер 2 KB
        if (req.file.size < MIN_FILE_SIZE) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path)
            }
            return next(new BadRequestError(`Файл слишком маленький. Минимальный размер ${MIN_FILE_SIZE / 1024}KB`))
        }

        const safeFilename = generateSafeFilename(req.file.originalname)
        const newFilePath = path.join(path.dirname(req.file.path), safeFilename)
        fs.renameSync(req.file.path, newFilePath)
        req.file.filename = safeFilename
        req.file.path = newFilePath

        const uploadPath = process.env.UPLOAD_PATH || 'images'
        const fileName = `/${uploadPath}/${safeFilename}`

        const safeOriginalName = req.file.originalname
            .replace(/[^a-zA-Z0-9а-яА-Я.\s]/g, '_')
            .slice(0, 100)

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