import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import { join } from 'path'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import movingFile from '../utils/movingFile'
import { sanitizeHtml } from '../utils/sanitize'
import { validateObjectId } from '../utils/validateObjectId'

const MAX_TITLE_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_CATEGORY_LENGTH = 50
const MAX_PRICE = 1000000

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 5 } = req.query

        const pageNum = Math.max(1, Number(page) || 1)
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 5))

        const options = {
            skip: (pageNum - 1) * limitNum,
            limit: limitNum,
        }

        const filter = {}

        const products = await Product.find(filter, null, options)
        const totalProducts = await Product.countDocuments(filter)
        const totalPages = Math.ceil(totalProducts / limitNum)

        const sanitizedProducts = products.map(product => ({
            ...product.toObject(),
            title: sanitizeHtml(product.title),
            description: product.description ? sanitizeHtml(product.description) : '',
            category: sanitizeHtml(product.category)
        }))

        return res.send({
            items: sanitizedProducts,
            pagination: {
                totalProducts,
                totalPages,
                currentPage: pageNum,
                pageSize: limitNum,
            },
        })
    } catch (err) {
        return next(err)
    }
}

export const createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        let { description, category, title } = req.body
        const { price, image } = req.body

        title = title ? sanitizeHtml(String(title)).slice(0, MAX_TITLE_LENGTH) : ''
        description = description ? sanitizeHtml(String(description)).slice(0, MAX_DESCRIPTION_LENGTH) : ''
        category = category ? sanitizeHtml(String(category)).slice(0, MAX_CATEGORY_LENGTH) : ''

        if (!title) {
            return next(new BadRequestError('Название товара обязательно'))
        }

        let priceNum: number | null = null
        if (price !== null && price !== undefined && price !== '') {
            priceNum = Number(price)
            if (Number.isNaN(priceNum)) {
                return next(new BadRequestError('Невалидная цена'))
            }
            if (priceNum < 0 || priceNum > MAX_PRICE) {
                return next(new BadRequestError(`Цена должна быть между 0 и ${MAX_PRICE}`))
            }
        }

        if (image && image.fileName) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )
        }

        const product = await Product.create({
            description,
            image,
            category,
            price: priceNum,
            title,
        })

        return res.status(constants.HTTP_STATUS_CREATED).send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

export const updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params

        if (!validateObjectId(productId)) {
            return next(new BadRequestError('Невалидный ID товара'))
        }

        let { title, description, category } = req.body
        const { image, price } = req.body

        if (title) title = sanitizeHtml(String(title)).slice(0, MAX_TITLE_LENGTH)
        if (description) description = sanitizeHtml(String(description)).slice(0, MAX_DESCRIPTION_LENGTH)
        if (category) category = sanitizeHtml(String(category)).slice(0, MAX_CATEGORY_LENGTH)

        let priceNum: number | null = null
        let shouldUpdatePrice = false

        if (price !== undefined && price !== null) {
            shouldUpdatePrice = true
            if (price === '') {
                priceNum = null
            } else {
                const parsedPrice = Number(price)
                if (Number.isNaN(parsedPrice)) {
                    return next(new BadRequestError('Невалидная цена'))
                }
                if (parsedPrice < 0 || parsedPrice > MAX_PRICE) {
                    return next(new BadRequestError(`Цена должна быть между 0 и ${MAX_PRICE}`))
                }
                priceNum = parsedPrice
            }
        }

        if (image && image.fileName) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )
        }

        const updateData: any = {}
        if (title !== undefined) updateData.title = title
        if (description !== undefined) updateData.description = description
        if (category !== undefined) updateData.category = category
        if (shouldUpdatePrice) updateData.price = priceNum
        if (image !== undefined) updateData.image = image

        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { runValidators: true, new: true }
        ).orFail(() => new NotFoundError('Нет товара по заданному id'))

        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

export const deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params

        if (!validateObjectId(productId)) {
            return next(new BadRequestError('Невалидный ID товара'))
        }

        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Нет товара по заданному id')
        )
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        return next(error)
    }
}