import path from 'path';

/**
 * Санитизация пути для защиты от Path Traversal
 */
export function sanitizePath(inputPath: string, baseDir: string): string | null {
    // 1. Декодируем URL (защита от двойного кодирования)
    let decodedPath: string;
    try {
        decodedPath = decodeURIComponent(inputPath);
    } catch (e) {
        return null;
    }
    
    // 2. Нормализуем путь
    let normalized = path.normalize(decodedPath);
    
    // 3. Удаляем все последовательности обхода директорий
    normalized = normalized.replace(/\.\./g, '');
    normalized = normalized.replace(/\\/g, '/');
    normalized = normalized.replace(/\/\/+/g, '/');
    
    // 4. Удаляем начальные слеши
    normalized = normalized.replace(/^\/+/, '');
    
    // 5. Формируем абсолютный путь
    const absolutePath = path.join(baseDir, normalized);
    
    // 6. Проверяем, что путь находится внутри baseDir
    const resolvedBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(absolutePath);
    
    if (!resolvedPath.startsWith(resolvedBase)) {
        return null;
    }
    
    return resolvedPath;
}

/**
 * Проверка, что путь имеет разрешённое расширение
 */
export function hasAllowedExtension(filePath: string, allowedExtensions: string[]): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return allowedExtensions.includes(ext);
}

/**
 * Безопасное формирование имени файла
 */
export function safeFilename(filename: string, maxLength: number = 100): string {
    // Удаляем путь
    const basename = path.basename(filename);
    // Оставляем только безопасные символы
    const safe = basename.replace(/[^a-zA-Z0-9а-яА-Я.\-_\s]/g, '_');
    // Ограничиваем длину
    return safe.slice(0, maxLength);
}