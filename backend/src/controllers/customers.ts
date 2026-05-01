import { NextFunction, Request, Response } from 'express'
import { FilterQuery } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User, { IUser } from '../models/user'
import { safeRegexp, sanitizeSearchQuery, sanitizeHtml } from '../utils/sanitize'
import { validateObjectId } from '../utils/validateObjectId'

const MAX_NAME_LENGTH = 100
const MAX_EMAIL_LENGTH = 100
const MAX_PHONE_LENGTH = 20

export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortField = 'createdAt',
            sortOrder = 'desc',
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
        } = req.query

        const pageNum = Math.max(1, Number(page) || 1)
        const limitNum = Math.min(10, Math.max(1, Number(limit) || 10))

        const filters: FilterQuery<Partial<IUser>> = {}

        if (registrationDateFrom) {
            const date = new Date(registrationDateFrom as string)
            if (!Number.isNaN(date.getTime())) {
                filters.createdAt = {
                    ...filters.createdAt,
                    $gte: date,
                }
            }
        }

        if (registrationDateTo) {
            const date = new Date(registrationDateTo as string)
            if (!Number.isNaN(date.getTime())) {
                const endOfDay = new Date(date)
                endOfDay.setHours(23, 59, 59, 999)
                filters.createdAt = {
                    ...filters.createdAt,
                    $lte: endOfDay,
                }
            }
        }

        if (lastOrderDateFrom) {
            const date = new Date(lastOrderDateFrom as string)
            if (!Number.isNaN(date.getTime())) {
                filters.lastOrderDate = {
                    ...filters.lastOrderDate,
                    $gte: date,
                }
            }
        }

        if (lastOrderDateTo) {
            const date = new Date(lastOrderDateTo as string)
            if (!Number.isNaN(date.getTime())) {
                const endOfDay = new Date(date)
                endOfDay.setHours(23, 59, 59, 999)
                filters.lastOrderDate = {
                    ...filters.lastOrderDate,
                    $lte: endOfDay,
                }
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

        if (orderCountFrom) {
            const value = Number(orderCountFrom)
            if (!Number.isNaN(value) && value >= 0) {
                filters.orderCount = {
                    ...filters.orderCount,
                    $gte: value,
                }
            }
        }

        if (orderCountTo) {
            const value = Number(orderCountTo)
            if (!Number.isNaN(value) && value >= 0) {
                filters.orderCount = {
                    ...filters.orderCount,
                    $lte: value,
                }
            }
        }

        if (search) {
            const sanitizedSearch = sanitizeSearchQuery(search as string)
            const searchRegex = safeRegexp(sanitizedSearch)

            const orders = await Order.find(
                {
                    deliveryAddress: searchRegex,
                },
                '_id'
            )

            const orderIds = orders.map((order) => order._id)

            filters.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { lastOrder: { $in: orderIds } },
            ]
        }

        const allowedSortFields = ['createdAt', 'totalAmount', 'orderCount', 'lastOrderDate', 'name', 'email']
        const safeSortField = allowedSortFields.includes(sortField as string)
            ? sortField as string
            : 'createdAt'

        const sort: Record<string, 1 | -1> = {}
        sort[safeSortField] = sortOrder === 'desc' ? -1 : 1

        const options = {
            sort,
            skip: (pageNum - 1) * limitNum,
            limit: limitNum,
        }

        const users = await User.find(filters, null, options).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: {
                    path: 'products',
                },
            },
            {
                path: 'lastOrder',
                populate: {
                    path: 'customer',
                },
            },
        ])

        const totalUsers = await User.countDocuments(filters)
        const totalPages = Math.ceil(totalUsers / limitNum)

        const sanitizedUsers = users.map((user: any) => {
            const result: any = {
                id: user._id,
                name: user.name ? sanitizeHtml(String(user.name)).slice(0, MAX_NAME_LENGTH) : '',
                email: user.email ? sanitizeHtml(String(user.email)).slice(0, MAX_EMAIL_LENGTH) : '',
                phone: user.phone ? sanitizeHtml(String(user.phone)).slice(0, MAX_PHONE_LENGTH) : '',
                totalAmount: user.totalAmount || 0,
                orderCount: user.orderCount || 0,
                createdAt: user.createdAt,
                lastOrderDate: user.lastOrderDate,
            }

            if (user.lastOrder) {
                const lastOrderObj = user.lastOrder
                result.lastOrder = {
                    id: lastOrderObj._id,
                    orderNumber: lastOrderObj.orderNumber,
                    deliveryAddress: lastOrderObj.deliveryAddress ? sanitizeHtml(String(lastOrderObj.deliveryAddress)).slice(0, 200) : '',
                    comment: lastOrderObj.comment ? sanitizeHtml(String(lastOrderObj.comment)).slice(0, 500) : '',
                    phone: lastOrderObj.phone ? sanitizeHtml(String(lastOrderObj.phone)).slice(0, MAX_PHONE_LENGTH) : '',
                    email: lastOrderObj.email ? sanitizeHtml(String(lastOrderObj.email)).slice(0, MAX_EMAIL_LENGTH) : '',
                    status: lastOrderObj.status,
                    totalAmount: lastOrderObj.totalAmount,
                    products: []
                }

                if (lastOrderObj.products && Array.isArray(lastOrderObj.products)) {
                    result.lastOrder.products = lastOrderObj.products.map((product: any) => ({
                        id: product._id,
                        title: product.title ? sanitizeHtml(String(product.title)).slice(0, 100) : '',
                        description: product.description ? sanitizeHtml(String(product.description)).slice(0, 2000) : '',
                        price: product.price,
                        category: product.category ? sanitizeHtml(String(product.category)).slice(0, 50) : ''
                    }))
                }
            }

            if (user.orders && Array.isArray(user.orders)) {
                result.orders = user.orders.map((order: any) => ({
                    id: order._id,
                    orderNumber: order.orderNumber,
                    deliveryAddress: order.deliveryAddress ? sanitizeHtml(String(order.deliveryAddress)).slice(0, 200) : '',
                    comment: order.comment ? sanitizeHtml(String(order.comment)).slice(0, 500) : '',
                    phone: order.phone ? sanitizeHtml(String(order.phone)).slice(0, MAX_PHONE_LENGTH) : '',
                    email: order.email ? sanitizeHtml(String(order.email)).slice(0, MAX_EMAIL_LENGTH) : '',
                    status: order.status,
                    totalAmount: order.totalAmount,
                    createdAt: order.createdAt
                }))
            }

            return result
        })

        res.status(200).json({
            customers: sanitizedUsers,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: pageNum,
                pageSize: limitNum,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params

        const validId = validateObjectId(id)
        if (!validId) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        const user = await User.findById(validId).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: {
                    path: 'products',
                },
            },
        ])

        if (!user) {
            return next(new NotFoundError('Пользователь по заданному id отсутствует в базе'))
        }

        const userObj: any = user.toObject()

        const sanitizedUser = {
            id: userObj._id,
            name: userObj.name ? sanitizeHtml(String(userObj.name)).slice(0, MAX_NAME_LENGTH) : '',
            email: userObj.email ? sanitizeHtml(String(userObj.email)).slice(0, MAX_EMAIL_LENGTH) : '',
            phone: userObj.phone ? sanitizeHtml(String(userObj.phone)).slice(0, MAX_PHONE_LENGTH) : '',
            totalAmount: userObj.totalAmount || 0,
            orderCount: userObj.orderCount || 0,
            createdAt: userObj.createdAt,
            lastOrderDate: userObj.lastOrderDate,
            lastOrder: userObj.lastOrder ? {
                id: userObj.lastOrder._id,
                orderNumber: userObj.lastOrder.orderNumber,
                deliveryAddress: userObj.lastOrder.deliveryAddress ? sanitizeHtml(String(userObj.lastOrder.deliveryAddress)).slice(0, 200) : '',
                comment: userObj.lastOrder.comment ? sanitizeHtml(String(userObj.lastOrder.comment)).slice(0, 500) : '',
                phone: userObj.lastOrder.phone ? sanitizeHtml(String(userObj.lastOrder.phone)).slice(0, MAX_PHONE_LENGTH) : '',
                email: userObj.lastOrder.email ? sanitizeHtml(String(userObj.lastOrder.email)).slice(0, MAX_EMAIL_LENGTH) : '',
                status: userObj.lastOrder.status,
                totalAmount: userObj.lastOrder.totalAmount,
                products: (userObj.lastOrder.products || []).map((product: any) => ({
                    id: product._id,
                    title: product.title ? sanitizeHtml(String(product.title)).slice(0, 100) : '',
                    description: product.description ? sanitizeHtml(String(product.description)).slice(0, 2000) : '',
                    price: product.price,
                    category: product.category ? sanitizeHtml(String(product.category)).slice(0, 50) : ''
                }))
            } : null,
            orders: (userObj.orders || []).map((order: any) => ({
                id: order._id,
                orderNumber: order.orderNumber,
                deliveryAddress: order.deliveryAddress ? sanitizeHtml(String(order.deliveryAddress)).slice(0, 200) : '',
                comment: order.comment ? sanitizeHtml(String(order.comment)).slice(0, 500) : '',
                phone: order.phone ? sanitizeHtml(String(order.phone)).slice(0, MAX_PHONE_LENGTH) : '',
                email: order.email ? sanitizeHtml(String(order.email)).slice(0, MAX_EMAIL_LENGTH) : '',
                status: order.status,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt
            }))
        }

        res.status(200).json(sanitizedUser)
    } catch (error) {
        next(error)
    }
}

export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params

        const validId = validateObjectId(id)
        if (!validId) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        const sanitizedBody: any = {}

        if (req.body.name) {
            sanitizedBody.name = sanitizeHtml(String(req.body.name)).slice(0, MAX_NAME_LENGTH)
        }
        if (req.body.email) {
            sanitizedBody.email = sanitizeHtml(String(req.body.email)).slice(0, MAX_EMAIL_LENGTH)
        }
        if (req.body.phone) {
            sanitizedBody.phone = sanitizeHtml(String(req.body.phone)).slice(0, MAX_PHONE_LENGTH)
        }

        if (sanitizedBody.email && !/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(sanitizedBody.email)) {
            return next(new BadRequestError('Невалидный формат email'))
        }

        const updatedUser = await User.findByIdAndUpdate(
            validId,
            sanitizedBody,
            {
                new: true,
                runValidators: true,
            }
        )
            .orFail(
                () => new NotFoundError('Пользователь по заданному id отсутствует в базе')
            )
            .populate(['orders', 'lastOrder'])

        const userObj: any = updatedUser.toObject()

        const sanitizedUser = {
            id: userObj._id,
            name: userObj.name ? sanitizeHtml(String(userObj.name)).slice(0, MAX_NAME_LENGTH) : '',
            email: userObj.email ? sanitizeHtml(String(userObj.email)).slice(0, MAX_EMAIL_LENGTH) : '',
            phone: userObj.phone ? sanitizeHtml(String(userObj.phone)).slice(0, MAX_PHONE_LENGTH) : '',
            totalAmount: userObj.totalAmount || 0,
            orderCount: userObj.orderCount || 0,
            createdAt: userObj.createdAt,
            lastOrderDate: userObj.lastOrderDate
        }

        res.status(200).json(sanitizedUser)
    } catch (error) {
        next(error)
    }
}

export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params

        const validId = validateObjectId(id)
        if (!validId) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        const deletedUser = await User.findByIdAndDelete(validId).orFail(
            () => new NotFoundError('Пользователь по заданному id отсутствует в базе')
        )

        const userObj: any = deletedUser.toObject()

        const sanitizedUser = {
            id: userObj._id,
            name: userObj.name ? sanitizeHtml(String(userObj.name)).slice(0, MAX_NAME_LENGTH) : '',
            email: userObj.email ? sanitizeHtml(String(userObj.email)).slice(0, MAX_EMAIL_LENGTH) : '',
            phone: userObj.phone ? sanitizeHtml(String(userObj.phone)).slice(0, MAX_PHONE_LENGTH) : '',
        }

        res.status(200).json(sanitizedUser)
    } catch (error) {
        next(error)
    }
}