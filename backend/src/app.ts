import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded, NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import csrf from 'csurf'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import rateLimit from 'express-rate-limit'
import { DB_ADDRESS } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const { PORT = 3000 } = process.env
const app = express()

// Защита от DDoS и переполнения буфера
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Слишком много запросов, попробуйте позже',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
})
app.use(limiter)

// Ограничение размера тела запроса
app.use(json({ limit: '1mb' }))
app.use(urlencoded({ extended: true, limit: '1mb' }))

// Защитные заголовки
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true,
}))

// Защита от NoSQL-инъекций
app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ key }) => {
        console.warn(`NoSQL injection attempt detected on ${key}`);
    }
}))

app.use(cookieParser())

// Настройка CORS
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}))

// CSRF защита
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    }
})

// Глобально применяем CSRF защиту
app.use((_req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(_req.method)) {
        return next()
    }
    return csrfProtection(_req, res, next)
})

// Эндпоинт для получения CSRF-токена (для фронтенда)
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() })
})

// ✅ Эндпоинт для тестов (ожидают /auth/csrf-token)
app.get('/auth/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() })
})

app.use(serveStatic(path.join(__dirname, 'public')))

// Защита от Path Traversal
app.use((req: Request, res: Response, next: NextFunction) => {
    const { url } = req
    const dangerousPatterns = [
        /\.\./,
        /%2e%2e/,
        /%252e%252e/,
        /%5c/,
        /%2f/,
        /\.\.%5c/,
        /\.\.%2f/,
    ]

    const hasDangerousPattern = dangerousPatterns.some(pattern => pattern.test(url))
    if (hasDangerousPattern) {
        console.warn(`Path traversal attempt detected in URL: ${url}`)
        return res.status(403).json({
            success: false,
            message: 'Access denied: Invalid path'
        })
    }

    next()
})

app.use(routes)
app.use(errors())
app.use(errorHandler)

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS)
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
    } catch (error) {
        console.error(error)
        process.exit(1)
    }
}

bootstrap()