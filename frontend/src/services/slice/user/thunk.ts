import { createAsyncThunk } from '../../hooks'
import { UserLoginBodyDto, UserRegisterBodyDto, UserResponseToken } from '../../../utils/types'

// ✅ Обновляем интерфейс ответа с CSRF токеном
interface UserResponseWithCSRF extends UserResponseToken {
    csrfToken?: string;
}

export const loginUser = createAsyncThunk(
    'user/login',
    async (data: UserLoginBodyDto, { extra: api }) => {
        const response = await api.loginUser(data) as UserResponseWithCSRF;
        // Сохраняем CSRF токен если нужно
        if (response.csrfToken) {
            localStorage.setItem('csrfToken', response.csrfToken);
        }
        return response;
    }
)

export const registerUser = createAsyncThunk(
    'user/register',
    async (data: UserRegisterBodyDto, { extra: api }) => {
        const response = await api.registerUser(data) as UserResponseWithCSRF;
        if (response.csrfToken) {
            localStorage.setItem('csrfToken', response.csrfToken);
        }
        return response;
    }
)

export const checkUserAuth = createAsyncThunk(
    'user/checkAuth',
    async (_, { extra: api }) => {
        return await api.getUser()
    }
)

export const checkUserRoles = createAsyncThunk(
    'user/checkRoles',
    async (_, { extra: api }) => {
        return await api.getUserRoles()
    }
)

export const logoutUser = createAsyncThunk(
    'user/logout',
    async (_, { extra: api }) => {
        return await api.logoutUser()
    }
)