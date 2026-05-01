import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export default function serveStatic(baseDir: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        let requestPath = req.path

        try {
            requestPath = decodeURIComponent(requestPath)
        } catch (e) {
            return res.status(400).send('Bad Request: Invalid URL encoding')
        }

        const sanitizedPath = requestPath
            .replace(/\.\./g, '')
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/^\/+/, '')

        const safePath = path.normalize(sanitizedPath).replace(/^(\.\.[/\\])+/, '')
        const filePath = path.join(baseDir, safePath)

        const normalizedBaseDir = path.normalize(baseDir)
        const normalizedFilePath = path.normalize(filePath)

        if (!normalizedFilePath.startsWith(normalizedBaseDir)) {
            console.warn(`Path traversal attempt detected: ${req.path} -> ${normalizedFilePath}`)
            return res.status(403).json({
                success: false,
                message: 'Access denied: Path traversal detected'
            })
        }

        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.css', '.js', '.html', '.json']
        const ext = path.extname(filePath).toLowerCase()
        if (!allowedExtensions.includes(ext) && ext !== '') {
            console.warn(`Forbidden file extension attempted: ${ext}`)
            return res.status(403).json({
                success: false,
                message: 'Access denied: File type not allowed'
            })
        }

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                return next()
            }

            res.setHeader('X-Content-Type-Options', 'nosniff')
            res.setHeader('Content-Security-Policy', "default-src 'none'")
            res.setHeader('X-Frame-Options', 'DENY')

            return res.sendFile(filePath, (sendErr) => {
                if (sendErr) {
                    console.error(`Error sending file: ${sendErr.message}`)
                    if (!res.headersSent) {
                        next(sendErr)
                    }
                }
            })
        })
    }
}