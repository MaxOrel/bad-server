import { Router } from 'express'
import { uploadFile } from '../controllers/upload'
import fileMiddleware from '../middlewares/file'

const uploadRouter = Router()

// Добавляем проверку пути перед загрузкой
uploadRouter.post('/', (req, res, next) => {
    // Защита от Path Traversal в имени файла
    const filename = req.headers['x-filename'] as string;
    if (filename && (filename.includes('..') || filename.includes('/') || filename.includes('\\'))) {
        return res.status(400).json({
            success: false,
            message: 'Invalid filename'
        });
    }
    next();
}, fileMiddleware.single('file'), uploadFile)

export default uploadRouter