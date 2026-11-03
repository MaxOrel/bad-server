import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import rateLimit from 'express-rate-limit'
import { validateCsrf } from './middlewares/csrf'
import { DB_ADDRESS } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const { PORT = 3000, ORIGIN_ALLOW = 'http://localhost' } = process.env
const corsOptions = { origin: ORIGIN_ALLOW, credentials: true }
const app = express()

app.disable('x-powered-by')

app.use(cookieParser())

app.use(cors(corsOptions))
// app.use(express.static(path.join(__dirname, 'public')));

app.use(serveStatic(path.join(__dirname, 'public')))

app.use(urlencoded({ extended: true, limit: '10kb' }))
app.use(json({
    limit: '10kb'
}))

app.options('*', cors(corsOptions))

const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 40,
})
app.use(limiter)

app.use(validateCsrf)

app.use(routes)
app.use(errors())
app.use(errorHandler)

// eslint-disable-next-line no-console

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS)
        await app.listen(PORT, () => console.log('ok'))
    } catch (error) {
        console.error(error)
    }
}

bootstrap()
