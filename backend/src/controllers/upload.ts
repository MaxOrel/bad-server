import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { unlink } from 'fs/promises'
import sharp from 'sharp'
import BadRequestError from '../errors/bad-request-error'

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    } 

    if (req.file.size < 2 * 1024) {
        await unlink(req.file.path)
        return next(new BadRequestError('Слишком маленький файл'))
    }

    try {
        await sharp(req.file.path).metadata()
    } catch {
        await unlink(req.file.path)
        return next(new BadRequestError('Файл не является изображением'))
    }

    try {
        const fileName = process.env.UPLOAD_PATH
            ? `/${process.env.UPLOAD_PATH}/${req.file.filename}`
            : `/${req.file?.filename}`
        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName,
            originalName: req.file?.originalname,
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
