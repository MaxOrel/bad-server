import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import rateLimit from 'express-rate-limit'
import { DB_ADDRESS } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'
import { setCsrfToken, csrfProtection } from './middlewares/csrf'

const { PORT = 3000 } = process.env
const app = express()

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true'
const isDDoSTest = process.env.TEST_DDOS === 'true'

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: isDDoSTest ? 10 : (isTestEnv ? 10000 : 50),
    message: { success: false, message: 'Слишком много запросов. Попробуйте позже.' },
})

// ✅ Защита от NoSQL операторов
const hasDollarKey = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false
    return Object.keys(obj).some(key => key.startsWith('$') || hasDollarKey(obj[key]))
}

app.use((req, res, next) => {
    if (hasDollarKey(req.query) || hasDollarKey(req.body)) {
        return res.status(400).json({ success: false, message: 'Invalid parameters' })
    }
    return next()
})

if (!isTestEnv || isDDoSTest) {
    app.use(limiter)
}

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
        console.warn(`NoSQL injection attempt detected on ${key}`)
    }
}))

app.use(cookieParser())

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}))

// ============================================================
// CSRF ЗАЩИТА
// ============================================================

// Эндпоинты для получения CSRF токена
app.get('/auth/csrf-token', setCsrfToken, (req, res) => {
    res.json({ csrfToken: res.locals.csrfToken })
})

app.get('/api/csrf-token', setCsrfToken, (req, res) => {
    res.json({ csrfToken: res.locals.csrfToken })
})

// Применяем CSRF защиту для всех мутирующих методов
app.use(csrfProtection)

app.use(serveStatic(path.join(__dirname, 'public')))

app.use((req, res, next) => {
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
app.use(errorHandler)

process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...')
    mongoose.connection.close()
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...')
    mongoose.connection.close()
    process.exit(0)
})

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            family: 4,
        })
        console.log('✅ MongoDB connected successfully')

        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`)
            console.log(`✅ CSRF endpoint: http://localhost:${PORT}/auth/csrf-token`)
        })
    } catch (error) {
        console.error('❌ Bootstrap error:', error)
        process.exit(1)
    }
}

bootstrap()