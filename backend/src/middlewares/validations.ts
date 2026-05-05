import { NextFunction, Request, Response } from 'express'
import Joi from 'joi'
import { Types } from 'mongoose'

export const phoneRegExp = /^(\+\d{1,4})?([\d\s()-]+)$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

// Вспомогательная функция для создания middleware валидации
const validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.body, { abortEarly: false })
        if (error) {
            const errors = error.details.map((detail) => detail.message)
            return res.status(400).json({ 
                success: false, 
                message: 'Ошибка валидации',
                errors 
            })
        }
        next()
    }
}

// Вспомогательная функция для валидации параметров
const validateParams = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.params)
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            })
        }
        next()
    }
}

// Схема валидации заказа
const orderBodySchema = Joi.object({
    items: Joi.array()
        .max(50)
        .items(
            Joi.string().custom((value, helpers) => {
                if (Types.ObjectId.isValid(value)) {
                    return value
                }
                return helpers.error('any.custom', { message: 'Невалидный id' })
            })
        )
        .messages({
            'array.base': 'Не указаны товары',
            'array.max': 'Слишком много товаров в заказе',
        }),
    payment: Joi.string()
        .valid(...Object.values(PaymentType))
        .required()
        .messages({
            'any.only': 'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
            'string.empty': 'Не указан способ оплаты',
        }),
    email: Joi.string()
        .email()
        .max(100)
        .required()
        .messages({
            'string.empty': 'Не указан email',
            'string.max': 'Email слишком длинный',
            'string.email': 'Невалидный формат email',
        }),
    phone: Joi.string()
        .required()
        .max(20)
        .pattern(phoneRegExp)
        .messages({
            'string.empty': 'Не указан телефон',
            'string.max': 'Телефон слишком длинный',
            'string.pattern.base': 'Невалидный формат телефона',
        }),
    address: Joi.string()
        .required()
        .max(200)
        .messages({
            'string.empty': 'Не указан адрес',
            'string.max': 'Адрес слишком длинный',
        }),
    total: Joi.number()
        .required()
        .max(1000000)
        .messages({
            'number.base': 'Не указана сумма заказа',
            'number.max': 'Сумма заказа слишком большая',
        }),
    comment: Joi.string()
        .optional()
        .allow('')
        .max(500),
})

// Схема валидации товара
const productBodySchema = Joi.object({
    title: Joi.string()
        .required()
        .min(2)
        .max(100)
        .messages({
            'string.min': 'Минимальная длина поля "title" - 2',
            'string.max': 'Максимальная длина поля "title" - 100',
            'string.empty': 'Поле "title" должно быть заполнено',
        }),
    image: Joi.object({
        fileName: Joi.string().required().max(255),
        originalName: Joi.string().required().max(100),
    }),
    category: Joi.string()
        .required()
        .max(50)
        .messages({
            'string.empty': 'Поле "category" должно быть заполнено',
            'string.max': 'Категория слишком длинная',
        }),
    description: Joi.string()
        .required()
        .max(2000)
        .messages({
            'string.empty': 'Поле "description" должно быть заполнено',
            'string.max': 'Описание слишком длинное',
        }),
    price: Joi.number().allow(null).max(1000000),
})

// Схема валидации обновления товара
const productUpdateBodySchema = Joi.object({
    title: Joi.string()
        .min(2)
        .max(100)
        .messages({
            'string.min': 'Минимальная длина поля "title" - 2',
            'string.max': 'Максимальная длина поля "title" - 100',
        }),
    image: Joi.object({
        fileName: Joi.string().required().max(255),
        originalName: Joi.string().required().max(100),
    }),
    category: Joi.string().max(50),
    description: Joi.string().max(2000),
    price: Joi.number().allow(null).max(1000000),
})

// Схема валидации ObjectId параметра
const objectIdParamsSchema = Joi.object({
    productId: Joi.string()
        .required()
        .length(24)
        .custom((value, helpers) => {
            if (Types.ObjectId.isValid(value)) {
                return value
            }
            return helpers.error('any.custom', { message: 'Невалидный id' })
        }),
})

// Схема валидации пользователя
const userBodySchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 100',
        }),
    password: Joi.string()
        .min(6)
        .max(100)
        .required()
        .messages({
            'string.empty': 'Поле "password" должно быть заполнено',
            'string.min': 'Пароль должен быть не менее 6 символов',
        }),
    email: Joi.string()
        .required()
        .email()
        .max(100)
        .message('Поле "email" должно быть валидным email-адресом')
        .messages({
            'string.empty': 'Поле "email" должно быть заполнено',
        }),
})

// Схема валидации аутентификации
const authenticationBodySchema = Joi.object({
    email: Joi.string()
        .required()
        .email()
        .max(100)
        .message('Поле "email" должно быть валидным email-адресом')
        .messages({
            'string.empty': 'Поле "email" должно быть заполнено',
        }),
    password: Joi.string()
        .required()
        .max(100)
        .messages({
            'string.empty': 'Поле "password" должно быть заполнено',
        }),
})

// Экспорт middleware для использования в маршрутах
export const validateOrderBody = validate(orderBodySchema)
export const validateProductBody = validate(productBodySchema)
export const validateProductUpdateBody = validate(productUpdateBodySchema)
export const validateUserBody = validate(userBodySchema)
export const validateAuthentication = validate(authenticationBodySchema)
export const validateObjId = validateParams(objectIdParamsSchema)