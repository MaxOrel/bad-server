import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import { safeRegexp, sanitizeSearchQuery, sanitizeHtml } from '../utils/sanitize'
import { validateObjectId, validateObjectIdsArray } from '../utils/validateObjectId'

const MAX_ITEMS_IN_ORDER = 50
const MAX_COMMENT_LENGTH = 500
const MAX_PHONE_LENGTH = 20
const MAX_ADDRESS_LENGTH = 200
const MAX_EMAIL_LENGTH = 100
const MAX_ORDER_TOTAL = 1000000
const MAX_SEARCH_LENGTH = 100

// Защита от NoSQL инъекций в агрегации
const dangerousOperators = ['$where', '$function', '$expr', '$jsonSchema', '$regex', '$options'];
const checkForDangerousOperators = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (dangerousOperators.includes(key)) return true;
        if (typeof obj[key] === 'object' && checkForDangerousOperators(obj[key])) return true;
    }
    return false;
};

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (checkForDangerousOperators(req.query)) {
            return next(new BadRequestError('Invalid query parameters'));
        }

        const {
            page = 1,
            limit = 10,
            sortField = 'createdAt',
            sortOrder = 'desc',
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query

        const pageNum = Math.max(1, Number(page) || 1)
        const limitNum = Math.min(10, Math.max(1, Number(limit) || 10))

        const filters: FilterQuery<Partial<IOrder>> = {}

        if (status) {
            if (typeof status === 'object') {
                Object.assign(filters, status)
            }
            if (typeof status === 'string') {
                filters.status = status
            }
        }

        if (totalAmountFrom) {
            const value = Number(totalAmountFrom)
            if (!Number.isNaN(value) && value >= 0) {
                filters.totalAmount = {
                    ...filters.totalAmount,
                    $gte: value,
                }
            }
        }

        if (totalAmountTo) {
            const value = Number(totalAmountTo)
            if (!Number.isNaN(value) && value >= 0) {
                filters.totalAmount = {
                    ...filters.totalAmount,
                    $lte: value,
                }
            }
        }

        if (orderDateFrom) {
            const date = new Date(orderDateFrom as string)
            if (!Number.isNaN(date.getTime())) {
                filters.createdAt = {
                    ...filters.createdAt,
                    $gte: date,
                }
            }
        }

        if (orderDateTo) {
            const date = new Date(orderDateTo as string)
            if (!Number.isNaN(date.getTime())) {
                const endOfDay = new Date(date)
                endOfDay.setHours(23, 59, 59, 999)
                filters.createdAt = {
                    ...filters.createdAt,
                    $lte: endOfDay,
                }
            }
        }

        const aggregatePipeline: any[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            { $unwind: '$products' },
        ]

        if (search) {
            const sanitizedSearch = sanitizeSearchQuery(search as string)
            const searchRegex = safeRegexp(sanitizedSearch)
            const searchNumber = Number(sanitizedSearch)

            const searchConditions: any[] = [{ 'products.title': searchRegex }]

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            aggregatePipeline.push({
                $match: {
                    $or: searchConditions,
                },
            })

            filters.$or = searchConditions
        }

        const allowedSortFields = ['createdAt', 'totalAmount', 'orderNumber', 'status']
        const safeSortField = allowedSortFields.includes(sortField as string)
            ? sortField as string
            : 'createdAt'

        const sort: Record<string, 1 | -1> = {}
        sort[safeSortField] = sortOrder === 'desc' ? -1 : 1

        aggregatePipeline.push(
            { $sort: sort },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                    deliveryAddress: { $first: '$deliveryAddress' },
                    comment: { $first: '$comment' },
                    phone: { $first: '$phone' },
                    email: { $first: '$email' },
                    payment: { $first: '$payment' },
                },
            }
        )

        const orders = await Order.aggregate(aggregatePipeline)
        const totalOrders = await Order.countDocuments(filters)
        const totalPages = Math.ceil(totalOrders / limitNum)

        const sanitizedOrders = orders.map((order: any) => ({
            ...order,
            comment: order.comment ? sanitizeHtml(order.comment).slice(0, MAX_COMMENT_LENGTH) : '',
            deliveryAddress: order.deliveryAddress ? sanitizeHtml(order.deliveryAddress).slice(0, MAX_ADDRESS_LENGTH) : '',
            phone: order.phone ? sanitizeHtml(order.phone).slice(0, MAX_PHONE_LENGTH) : '',
            email: order.email ? sanitizeHtml(order.email).slice(0, MAX_EMAIL_LENGTH) : '',
            customer: order.customer ? {
                ...order.customer,
                name: order.customer.name ? sanitizeHtml(order.customer.name).slice(0, 100) : '',
                email: order.customer.email ? sanitizeHtml(order.customer.email).slice(0, MAX_EMAIL_LENGTH) : ''
            } : null,
            products: order.products?.map((product: any) => ({
                ...product,
                title: product.title ? sanitizeHtml(product.title).slice(0, 100) : '',
                description: product.description ? sanitizeHtml(product.description).slice(0, 2000) : ''
            })) || []
        }))

        res.status(200).json({
            orders: sanitizedOrders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pageNum,
                pageSize: limitNum,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page = 1, limit = 5 } = req.query

        const pageNum = Math.max(1, Number(page) || 1)
        const limitNum = Math.min(10, Math.max(1, Number(limit) || 5))

        let sanitizedSearch = ''
        if (search && typeof search === 'string') {
            const truncatedSearch = search.slice(0, MAX_SEARCH_LENGTH)
            sanitizedSearch = truncatedSearch.replace(/[.*+?^${}()|[\]\\]/g, '')
        }

        const options = {
            skip: (pageNum - 1) * limitNum,
            limit: limitNum,
        }

        const validUserId = validateObjectId(userId)
        if (!validUserId) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        const user = await User.findById(validUserId)
            .populate({
                path: 'orders',
                populate: [
                    {
                        path: 'products',
                    },
                    {
                        path: 'customer',
                    },
                ],
            })
            .orFail(
                () => new NotFoundError('Пользователь по заданному id отсутствует в базе')
            )

        let orders = user.orders as any[]

        if (sanitizedSearch) {
            const searchRegex = new RegExp(sanitizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            const searchNumber = Number(sanitizedSearch)

            const products = await Product.find({
                title: { $regex: searchRegex, $options: 'i' }
            }).limit(100)

            // ✅ Исправлено: явное преобразование _id в строку через цикл
            const productIdStrings: string[] = []
            for (let i = 0; i < products.length; i += 1) {
                const product = products[i]
                const idStr = (product._id as Types.ObjectId).toString()
                productIdStrings.push(idStr)
            }

            orders = orders.filter((order) => {
                // Проверка по номеру заказа
                const matchesOrderNumber = !Number.isNaN(searchNumber) && order.orderNumber === searchNumber
                
                // Проверка по названию товара
                let matchesProductTitle = false
                for (let j = 0; j < order.products.length; j +=1) {
                    const product = order.products[j]
                    const productIdStr = (product._id as Types.ObjectId).toString()
                    if (productIdStrings.includes(productIdStr)) {
                        matchesProductTitle = true
                        break
                    }
                }
                
                return matchesOrderNumber || matchesProductTitle
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / limitNum)

        orders = orders.slice(options.skip, options.skip + options.limit)

        const sanitizedOrders = orders.map((order: any) => ({
            ...order,
            comment: order.comment ? sanitizeHtml(order.comment).slice(0, MAX_COMMENT_LENGTH) : '',
            deliveryAddress: order.deliveryAddress ? sanitizeHtml(order.deliveryAddress).slice(0, MAX_ADDRESS_LENGTH) : '',
            phone: order.phone ? sanitizeHtml(order.phone).slice(0, MAX_PHONE_LENGTH) : '',
            email: order.email ? sanitizeHtml(order.email).slice(0, MAX_EMAIL_LENGTH) : '',
            customer: order.customer ? {
                ...order.customer,
                name: order.customer.name ? sanitizeHtml(order.customer.name).slice(0, 100) : '',
                email: order.customer.email ? sanitizeHtml(order.customer.email).slice(0, MAX_EMAIL_LENGTH) : ''
            } : null,
            products: order.products?.map((product: any) => ({
                ...product,
                title: product.title ? sanitizeHtml(product.title).slice(0, 100) : '',
                description: product.description ? sanitizeHtml(product.description).slice(0, 2000) : ''
            })) || []
        }))

        return res.send({
            orders: sanitizedOrders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pageNum,
                pageSize: limitNum,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { orderNumber } = req.params

        const orderNum = Number(orderNumber)
        if (Number.isNaN(orderNum) || orderNum <= 0) {
            return next(new BadRequestError('Невалидный номер заказа'))
        }

        const order = await Order.findOne({
            orderNumber: orderNum,
        })
            .populate(['customer', 'products'])
            .orFail(
                () => new NotFoundError('Заказ по заданному номеру отсутствует в базе')
            )

        const orderObj = order.toObject()
        const sanitizedOrder = {
            ...orderObj,
            comment: orderObj.comment ? sanitizeHtml(orderObj.comment).slice(0, MAX_COMMENT_LENGTH) : '',
            deliveryAddress: orderObj.deliveryAddress ? sanitizeHtml(orderObj.deliveryAddress).slice(0, MAX_ADDRESS_LENGTH) : '',
            phone: orderObj.phone ? sanitizeHtml(orderObj.phone).slice(0, MAX_PHONE_LENGTH) : '',
            email: orderObj.email ? sanitizeHtml(orderObj.email).slice(0, MAX_EMAIL_LENGTH) : '',
            customer: orderObj.customer ? {
                ...(orderObj.customer as any),
                name: (orderObj.customer as any).name ? sanitizeHtml((orderObj.customer as any).name).slice(0, 100) : '',
                email: (orderObj.customer as any).email ? sanitizeHtml((orderObj.customer as any).email).slice(0, MAX_EMAIL_LENGTH) : ''
            } : null,
            products: (orderObj.products as any[])?.map((product: any) => ({
                ...product,
                title: product.title ? sanitizeHtml(product.title).slice(0, 100) : '',
                description: product.description ? sanitizeHtml(product.description).slice(0, 2000) : ''
            })) || []
        }

        return res.status(200).json(sanitizedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const { orderNumber } = req.params

        const orderNum = Number(orderNumber)
        if (Number.isNaN(orderNum) || orderNum <= 0) {
            return next(new BadRequestError('Невалидный номер заказа'))
        }

        const order = await Order.findOne({
            orderNumber: orderNum,
        })
            .populate(['customer', 'products'])
            .orFail(
                () => new NotFoundError('Заказ по заданному номеру отсутствует в базе')
            )

        const orderObj = order.toObject()
        const customerId = (orderObj.customer as any)?._id

        const validUserId = validateObjectId(userId)
        const validCustomerId = validateObjectId(customerId)

        if (!validCustomerId || !validUserId?.equals(validCustomerId)) {
            return next(new NotFoundError('Заказ по заданному номеру отсутствует в базе'))
        }

        const sanitizedOrder = {
            ...orderObj,
            comment: orderObj.comment ? sanitizeHtml(orderObj.comment).slice(0, MAX_COMMENT_LENGTH) : '',
            deliveryAddress: orderObj.deliveryAddress ? sanitizeHtml(orderObj.deliveryAddress).slice(0, MAX_ADDRESS_LENGTH) : '',
            phone: orderObj.phone ? sanitizeHtml(orderObj.phone).slice(0, MAX_PHONE_LENGTH) : '',
            email: orderObj.email ? sanitizeHtml(orderObj.email).slice(0, MAX_EMAIL_LENGTH) : '',
            customer: orderObj.customer ? {
                ...(orderObj.customer as any),
                name: (orderObj.customer as any).name ? sanitizeHtml((orderObj.customer as any).name).slice(0, 100) : '',
                email: (orderObj.customer as any).email ? sanitizeHtml((orderObj.customer as any).email).slice(0, MAX_EMAIL_LENGTH) : ''
            } : null,
            products: (orderObj.products as any[])?.map((product: any) => ({
                ...product,
                title: product.title ? sanitizeHtml(product.title).slice(0, 100) : '',
                description: product.description ? sanitizeHtml(product.description).slice(0, 2000) : ''
            })) || []
        }

        return res.status(200).json(sanitizedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const basket: IProduct[] = []
        const products = await Product.find<IProduct>({})
        const userId = res.locals.user._id
        
        const { payment, total, items } = req.body
        const address = req.body.address ? sanitizeHtml(String(req.body.address)).slice(0, MAX_ADDRESS_LENGTH) : ''
        const phone = req.body.phone ? sanitizeHtml(String(req.body.phone)).slice(0, MAX_PHONE_LENGTH) : ''
        const email = req.body.email ? sanitizeHtml(String(req.body.email)).slice(0, MAX_EMAIL_LENGTH) : ''
        const comment = req.body.comment ? sanitizeHtml(String(req.body.comment)).slice(0, MAX_COMMENT_LENGTH) : ''

        if (email && email.length > 0) {
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/
            if (!emailRegex.test(email)) {
                return next(new BadRequestError('Невалидный формат email'))
            }
        }

        if (phone && !/^[\d+\-()\s]{5,20}$/.test(phone)) {
            return next(new BadRequestError('Невалидный формат телефона'))
        }

        if (!items || !Array.isArray(items)) {
            return next(new BadRequestError('Не указаны товары'))
        }

        if (items.length > MAX_ITEMS_IN_ORDER) {
            return next(new BadRequestError(`Максимальное количество товаров в заказе: ${MAX_ITEMS_IN_ORDER}`))
        }

        if (!validateObjectIdsArray(items)) {
            return next(new BadRequestError('Невалидный формат ID товаров'))
        }

        const totalAmount = Number(total)
        if (Number.isNaN(totalAmount) || totalAmount < 0 || totalAmount > MAX_ORDER_TOTAL) {
            return next(new BadRequestError(`Невалидная сумма заказа. Максимум: ${MAX_ORDER_TOTAL}`))
        }

        const validItems: Types.ObjectId[] = []

        for (let idx = 0; idx < items.length; idx += 1) {
        const id = items[idx];
        const validId = validateObjectId(id)
        if (!validId) {
        throw new BadRequestError(`Невалидный ID товара: ${id}`)
    }
            
            let foundProduct: IProduct | null = null
            const validIdStr = validId.toString()
            
            for (let i = 0; i < products.length; i += 1) {
                const product = products[i]
                const productIdStr = (product._id as Types.ObjectId).toString()
                if (productIdStr === validIdStr) {
                    foundProduct = product
                    break
                }
            }
            
            if (!foundProduct) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (foundProduct.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            basket.push(foundProduct)
            validItems.push(validId)
        }

        const totalBasket = basket.reduce((a, c) => a + (c.price || 0), 0)
        if (totalBasket !== totalAmount) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const validUserId = validateObjectId(userId)
        if (!validUserId) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        const validPaymentValues = ['card', 'online']
        if (!validPaymentValues.includes(payment)) {
            return next(new BadRequestError('Невалидный способ оплаты'))
        }

        const newOrder = new Order({
            totalAmount,
            products: validItems,
            payment,
            phone,
            email,
            comment,
            customer: validUserId,
            deliveryAddress: address,
        })

        await newOrder.save()

        const sanitizedOrder = {
            ...newOrder.toObject(),
            comment,
            deliveryAddress: address,
            phone,
            email
        }

        return res.status(200).json(sanitizedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body

        if (!status) {
            return next(new BadRequestError('Не указан статус заказа'))
        }

        const validStatuses = ['new', 'delivering', 'completed', 'cancelled']
        if (!validStatuses.includes(status)) {
            return next(new BadRequestError('Невалидный статус заказа'))
        }

        const { orderNumber } = req.params
        const orderNum = Number(orderNumber)
        if (Number.isNaN(orderNum) || orderNum <= 0) {
            return next(new BadRequestError('Невалидный номер заказа'))
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: orderNum },
            { status },
            { new: true, runValidators: true }
        )
            .populate(['customer', 'products'])
            .orFail(
                () => new NotFoundError('Заказ по заданному номеру отсутствует в базе')
            )

        const orderObj = updatedOrder.toObject()
        const sanitizedOrder = {
            ...orderObj,
            comment: orderObj.comment ? sanitizeHtml(orderObj.comment).slice(0, MAX_COMMENT_LENGTH) : '',
            deliveryAddress: orderObj.deliveryAddress ? sanitizeHtml(orderObj.deliveryAddress).slice(0, MAX_ADDRESS_LENGTH) : '',
            phone: orderObj.phone ? sanitizeHtml(orderObj.phone).slice(0, MAX_PHONE_LENGTH) : '',
            email: orderObj.email ? sanitizeHtml(orderObj.email).slice(0, MAX_EMAIL_LENGTH) : '',
            customer: orderObj.customer ? {
                ...(orderObj.customer as any),
                name: (orderObj.customer as any).name ? sanitizeHtml((orderObj.customer as any).name).slice(0, 100) : '',
                email: (orderObj.customer as any).email ? sanitizeHtml((orderObj.customer as any).email).slice(0, MAX_EMAIL_LENGTH) : ''
            } : null
        }

        return res.status(200).json(sanitizedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params

        const validId = validateObjectId(id)
        if (!validId) {
            return next(new BadRequestError('Невалидный ID заказа'))
        }

        const deletedOrder = await Order.findByIdAndDelete(validId)
            .populate(['customer', 'products'])
            .orFail(
                () => new NotFoundError('Заказ по заданному id отсутствует в базе')
            )

        const orderObj = deletedOrder.toObject()
        const sanitizedOrder = {
            ...orderObj,
            comment: orderObj.comment ? sanitizeHtml(orderObj.comment).slice(0, MAX_COMMENT_LENGTH) : '',
            deliveryAddress: orderObj.deliveryAddress ? sanitizeHtml(orderObj.deliveryAddress).slice(0, MAX_ADDRESS_LENGTH) : '',
            phone: orderObj.phone ? sanitizeHtml(orderObj.phone).slice(0, MAX_PHONE_LENGTH) : '',
            email: orderObj.email ? sanitizeHtml(orderObj.email).slice(0, MAX_EMAIL_LENGTH) : '',
            customer: orderObj.customer ? {
                ...(orderObj.customer as any),
                name: (orderObj.customer as any).name ? sanitizeHtml((orderObj.customer as any).name).slice(0, 100) : '',
                email: (orderObj.customer as any).email ? sanitizeHtml((orderObj.customer as any).email).slice(0, MAX_EMAIL_LENGTH) : ''
            } : null
        }

        return res.status(200).json(sanitizedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}