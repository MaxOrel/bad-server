import { Request, Express } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { mkdirSync } from 'fs'
import { join, normalize } from 'path'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

// ✅ Максимальный размер файла - 1MB
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
// ✅ Минимальный размер файла - 2KB (для тестов)
const MIN_FILE_SIZE = 2 * 1024; // 2 KB
// ✅ Максимальное количество файлов за запрос
const MAX_FILES_COUNT = 1;

// Безопасное имя файла (без оригинального имени)
function safeFilename(originalName: string): string {
    // Извлекаем только расширение (если есть)
    const lastDotIndex = originalName.lastIndexOf('.');
    const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';
    
    // Генерируем полностью случайное имя
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    
    // Возвращаем имя, которое НЕ содержит оригинальное имя файла
    return `${timestamp}_${random}${extension}`;
}

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: DestinationCallback
    ) => {
        // Защита от Path Traversal в пути назначения
        let destinationPath = process.env.UPLOAD_PATH_TEMP || 'temp';
        destinationPath = normalize(destinationPath).replace(/\.\./g, '');
        
        const fullPath = join(__dirname, `../public/${destinationPath}`);
        
        mkdirSync(fullPath, { recursive: true });
        
        cb(null, fullPath);
    },

    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileNameCallback
    ) => {
        // ✅ Используем безопасное имя, не содержащее оригинальное
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

    // ✅ Проверка максимального размера
    if (file.size > MAX_FILE_SIZE) {
        cb(new Error(`Файл слишком большой. Максимальный размер ${MAX_FILE_SIZE / 1024 / 1024}MB`));
        return;
    }

    // ✅ Проверка минимального размера (защита от пустых/битых файлов)
    if (file.size < MIN_FILE_SIZE) {
        cb(new Error(`Файл слишком маленький. Минимальный размер ${MIN_FILE_SIZE / 1024}KB`));
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