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
import crypto from 'crypto'

const { PORT = 3000 } = process.env
const app = express()

// Определяем, запущены ли тесты
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true'
// Определяем, запущен ли DDoS тест (который реально проверяет rate limiter)
const isDDoSTest = process.env.TEST_DDOS === 'true'

// Настройка rate limiter - только для DDoS теста и production
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: isDDoSTest ? 50 : (isTestEnv ? 10000 : 50),
    message: { success: false, message: 'Слишком много запросов. Попробуйте позже.' },
})

// Применяем rate limiter ТОЛЬКО для production или DDoS теста
app.use((req, res, next) => {
    // Всегда пропускаем CSRF эндпоинты
    if (req.path === '/auth/csrf-token' || req.path === '/api/csrf-token') {
        return next()
    }
    // Применяем rate limiter только если это production или DDoS тест
    if (!isTestEnv || isDDoSTest) {
        return limiter(req, res, next)
    }
    // Для обычных тестов пропускаем rate limiter полностью
    return next()
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
        console.warn(`NoSQL injection attempt detected on ${key}`)
    }
}))

app.use(cookieParser())

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}))

// ============================================================
// CSRF ЗАЩИТА (совместимая с тестами)
// ============================================================

function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

app.get('/auth/csrf-token', (req, res) => {
    const token = generateCsrfToken()
    res.cookie('_csrf', token, { httpOnly: true, sameSite: 'lax' })
    res.json({ csrfToken: token })
})

app.get('/api/csrf-token', (req, res) => {
    const token = generateCsrfToken()
    res.cookie('_csrf', token, { httpOnly: true, sameSite: 'lax' })
    res.json({ csrfToken: token })
})

app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next()
    }
    
    const token = req.headers['csrf-token'] || req.headers['x-csrf-token'] || req.body?._csrf
    const cookieToken = req.cookies?._csrf
    
    if (!token || !cookieToken || token !== cookieToken) {
        console.warn(`CSRF validation failed for ${req.method} ${req.path}`)
        return res.status(403).json({ success: false, message: 'Invalid CSRF token' })
    }
    
    next()
})

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
            console.log(`✅ Environment: ${isTestEnv ? 'TEST' : 'PRODUCTION'}`)
            console.log(`✅ Rate limit: ${isDDoSTest ? '50 req/min (DDoS test)' : (isTestEnv ? 'DISABLED for tests' : '50 req/min')}`)
        })
    } catch (error) {
        console.error('❌ Bootstrap error:', error)
        process.exit(1)
    }
}

bootstrap()