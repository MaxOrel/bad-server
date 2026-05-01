import { Joi, celebrate } from 'celebrate'
import { Types } from 'mongoose'

export const phoneRegExp = /^(\+\d+)?(?:\s|-?|\(?\d+\)?)+$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

export const validateOrderBody = celebrate({
    body: Joi.object().keys({
        items: Joi.array()
            .max(50)
            .items(
                Joi.string().custom((value, helpers) => {
                    if (Types.ObjectId.isValid(value)) {
                        return value
                    }
                    return helpers.message({ custom: 'Невалидный id' })
                })
            )
            .messages({
                'array.empty': 'Не указаны товары',
                'array.max': 'Слишком много товаров в заказе',
            }),
        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required()
            .messages({
                'string.valid': 'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
                'string.empty': 'Не указан способ оплаты',
            }),
        email: Joi.string()
            .email()
            .max(100)
            .required()
            .messages({
                'string.empty': 'Не указан email',
                'string.max': 'Email слишком длинный',
            }),
        phone: Joi.string()
            .required()
            .max(20)
            .pattern(phoneRegExp)
            .messages({
                'string.empty': 'Не указан телефон',
                'string.max': 'Телефон слишком длинный',
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
                'string.empty': 'Не указана сумма заказа',
                'number.max': 'Сумма заказа слишком большая',
            }),
        comment: Joi.string()
            .optional()
            .allow('')
            .max(500),
    }),
})

export const validateProductBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string()
            .required()
            .min(2)
            .max(100)
            .messages({
                'string.min': 'Минимальная длина поля "name" - 2',
                'string.max': 'Максимальная длина поля "name" - 100',
                'string.empty': 'Поле "title" должно быть заполнено',
            }),
        image: Joi.object().keys({
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
    }),
})

export const validateProductUpdateBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string()
            .min(2)
            .max(100)
            .messages({
                'string.min': 'Минимальная длина поля "name" - 2',
                'string.max': 'Максимальная длина поля "name" - 100',
            }),
        image: Joi.object().keys({
            fileName: Joi.string().required().max(255),
            originalName: Joi.string().required().max(100),
        }),
        category: Joi.string().max(50),
        description: Joi.string().max(2000),
        price: Joi.number().allow(null).max(1000000),
    }),
})

export const validateObjId = celebrate({
    params: Joi.object().keys({
        productId: Joi.string()
            .required()
            .length(24)
            .custom((value, helpers) => {
                if (Types.ObjectId.isValid(value)) {
                    return value
                }
                return helpers.message({ any: 'Невалидный id' })
            }),
    }),
})

export const validateUserBody = celebrate({
    body: Joi.object().keys({
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
            }),
        email: Joi.string()
            .required()
            .email()
            .max(100)
            .message('Поле "email" должно быть валидным email-адресом')
            .messages({
                'string.empty': 'Поле "email" должно быть заполнено',
            }),
    }),
})

export const validateAuthentication = celebrate({
    body: Joi.object().keys({
        email: Joi.string()
            .required()
            .email()
            .max(100)
            .message('Поле "email" должно быть валидным email-адресом')
            .messages({
                'string.required': 'Поле "email" должно быть заполнено',
            }),
        password: Joi.string()
            .required()
            .max(100)
            .messages({
                'string.empty': 'Поле "password" должно быть заполнено',
            }),
    }),
})