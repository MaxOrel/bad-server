import csurf from 'csurf'
import { Request, Response, Router } from 'express'
import {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
} from '../controllers/auth'
import auth from '../middlewares/auth'
import {
    validateAuthentication,
    validateUserBody,
} from '../middlewares/validations'

const authRouter = Router()

// @types/csurf references a different express-serve-static-core than @types/express-rate-limit,
// causing duplicate type declarations. Cast to RequestHandler to resolve the conflict.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const csrfProtection = csurf({ cookie: true }) as any

authRouter.get('/csrf-token', csrfProtection, (req: Request, res: Response) => {
    res.json({ csrfToken: (req as any).csrfToken() })
})

authRouter.get('/user', auth, getCurrentUser)
authRouter.patch('/me', auth, updateCurrentUser)
authRouter.get('/user/roles', auth, getCurrentUserRoles)
authRouter.post('/login', csrfProtection, validateAuthentication, login)
authRouter.get('/token', refreshAccessToken)
authRouter.get('/logout', logout)
authRouter.post('/register', csrfProtection, validateUserBody, register)

export default authRouter
