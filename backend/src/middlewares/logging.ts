import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

const MAX_LOG_SIZE = 10 * 1024 * 1024
const LOG_FILE_PATH = path.join(__dirname, '../../logs/access.log')
const ERROR_LOG_PATH = path.join(__dirname, '../../logs/error.log')

if (!fs.existsSync(path.dirname(LOG_FILE_PATH))) {
    fs.mkdirSync(path.dirname(LOG_FILE_PATH), { recursive: true })
}

function rotateLogIfNeeded(logPath: string) {
    try {
        if (fs.existsSync(logPath)) {
            const stats = fs.statSync(logPath)
            if (stats.size > MAX_LOG_SIZE) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
                const newPath = `${logPath.replace('.log', `-${timestamp}.log`)}`
                fs.renameSync(logPath, newPath)
                console.log(`Log rotated: ${newPath}`)
            }
        }
    } catch (error) {
        console.error('Log rotation error:', error)
    }
}

export function logRequest(req: Request, res: Response, next: NextFunction) {
    const start = Date.now()
    const originalJson = res.json
    let responseBody: any = null

    res.json = function(body: any) {
        responseBody = body
        return originalJson.call(this, body)
    }

    res.on('finish', () => {
        const duration = Date.now() - start

        const logEntry = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: (req.headers['user-agent'] || 'unknown').slice(0, 100)
        }

        const sensitiveEndpoints = ['/auth/login', '/auth/register']
        if (!sensitiveEndpoints.some(e => req.url.includes(e))) {
            rotateLogIfNeeded(LOG_FILE_PATH)
            setImmediate(() => {
                try {
                    fs.appendFileSync(LOG_FILE_PATH, `${JSON.stringify(logEntry)}\n`)
                } catch (err) {
                    console.error('Log write error:', err)
                }
            })
        }

        if (res.statusCode >= 400) {
            rotateLogIfNeeded(ERROR_LOG_PATH)
            setImmediate(() => {
                try {
                    const errorEntry = {
                        ...logEntry,
                        error: responseBody?.message || 'Unknown error'
                    }
                    fs.appendFileSync(ERROR_LOG_PATH, `${JSON.stringify(errorEntry)}\n`)
                } catch (err) {
                    console.error('Error log write error:', err)
                }
            })
        }
    })

    next()
}

setInterval(() => {
    const logsDir = path.dirname(LOG_FILE_PATH)
    const MAX_AGE_DAYS = 7
    const now = Date.now()

    try {
        const files = fs.readdirSync(logsDir)
        const logFiles = files.filter((file: string) => file.endsWith('.log'))

        logFiles.forEach((file: string) => {
            const filePath = path.join(logsDir, file)
            const stats = fs.statSync(filePath)
            const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24)
            if (ageDays > MAX_AGE_DAYS) {
                fs.unlinkSync(filePath)
                console.log(`Deleted old log: ${file}`)
            }
        })
    } catch (error) {
        console.error('Log cleanup error:', error)
    }
}, 24 * 60 * 60 * 1000)