import { Request, Express } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { mkdirSync } from 'fs'
import { join, normalize } from 'path'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

// Максимальный размер файла - 1MB
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_FILES_COUNT = 1;

// Безопасное имя файла
function safeFilename(filename: string): string {
    const basename = filename.replace(/[^a-zA-Z0-9а-яА-Я.\-_\s]/g, '_');
    const timestamp = Date.now();
    return `${timestamp}_${basename.slice(0, 100)}`;
}

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: DestinationCallback
    ) => {
        // Защита от Path Traversal в пути назначения
        let destinationPath = process.env.UPLOAD_PATH_TEMP || 'temp';
        // Удаляем опасные последовательности
        destinationPath = normalize(destinationPath).replace(/\.\./g, '');
        
        const fullPath = join(__dirname, `../public/${destinationPath}`);
        
        // Создаём директорию рекурсивно
        mkdirSync(fullPath, { recursive: true });
        
        cb(null, fullPath);
    },

    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileNameCallback
    ) => {
        const safeName = safeFilename(file.originalname);
        cb(null, safeName);
    },
});

const allowedMimeTypes = [
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
    'image/webp',
];

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(new Error('Неподдерживаемый тип файла'));
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        cb(new Error('Файл слишком большой. Максимальный размер 1MB'));
        return;
    }

    cb(null, true);
};

export default multer({ 
    storage, 
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES_COUNT,
        fieldSize: 1024 * 1024,
        headerPairs: 2000,
        parts: 1000,
    }
});