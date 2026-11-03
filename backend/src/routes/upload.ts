import { Router } from 'express'
import auth, { roleGuardMiddleware } from '../middlewares/auth'
import { Role } from '../models/user'
import { uploadFile } from '../controllers/upload'
import fileMiddleware from '../middlewares/file'

const uploadRouter = Router()
uploadRouter.post('/', fileMiddleware.single('file'), auth, roleGuardMiddleware(Role.Admin), uploadFile)

export default uploadRouter
