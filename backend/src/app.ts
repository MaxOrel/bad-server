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

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    message: {
        success: false,
        message: 'Слишком много запросов. Попробуйте позже.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
        return req.ip || req.socket.remoteAddress || 'unknown';
    }
})

app.use((req, res, next) => {
    if (req.path === '/auth/csrf-token' || req.path === '/api/csrf-token') {
        return next();
    }
    return limiter(req, res, next);
})

app.use(json({ limit: '1mb' }))
app.use(urlencoded({ extended: true, limit: '1mb' }))

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

app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ key }) => {
        console.warn(`NoSQL injection attempt detected on ${key}`);
    }
}))

app.use(cookieParser())

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}))

const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    }
})

app.use((_req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(_req.method)) {
        return next()
    }
    return csrfProtection(_req, res, next)
})

// ✅ Эндпоинт для получения CSRF-токена (для фронтенда)
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() })
})

// ✅ Эндпоинт для тестов (должен быть ДО serveStatic)
app.get('/auth/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() })
})

app.use(serveStatic(path.join(__dirname, 'public')))

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

process.on('SIGTERM', () => {
    console.log('SIGTERM received');
    mongoose.connection.close();
});

process.on('SIGINT', () => {
    console.log('SIGINT received');
    mongoose.connection.close();
});

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