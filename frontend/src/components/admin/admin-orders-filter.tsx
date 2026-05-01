import { ordersActions, ordersSelector } from '@slices/orders'
import { useActionCreators, useDispatch, useSelector } from '@store/hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchOrdersWithFilters } from '../../services/slice/orders/thunk'
import { AppRoute } from '../../utils/constants'
import Filter from '../filter'
import styles from './admin.module.scss'
import { ordersFilterFields } from './helpers/ordersFilterFields'
import { StatusType } from '../../utils/types'

// Тип для значений фильтров
type FilterValue = string | number | { value: string; title: string } | null
type FilterRecord = Record<string, FilterValue>

export default function AdminFilterOrders() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [_, setSearchParams] = useSearchParams()

    const { updateFilter, clearFilters } = useActionCreators(ordersActions)
    const filterOrderOption = useSelector(ordersSelector.selectFilterOption)

    const handleFilter = (filters: FilterRecord) => {
        // Создаём копию фильтров без status для updateFilter
        const { status, ...restFilters } = filters
        
        // Обрабатываем status отдельно с правильным типом
        let statusValue: StatusType | undefined = undefined
        
        if (status) {
            if (typeof status === 'object' && status !== null) {
                // Проверяем, что значение является допустимым статусом
                const statusStr = status.value
                if (Object.values(StatusType).includes(statusStr as StatusType)) {
                    statusValue = statusStr as StatusType
                }
            } else if (typeof status === 'string') {
                // Проверяем, что строка является допустимым статусом
                if (Object.values(StatusType).includes(status as StatusType)) {
                    statusValue = status as StatusType
                }
            }
        }
        
        // Отправляем updateFilter
        dispatch(updateFilter({ ...restFilters, status: statusValue }))
        
        const queryParams: Record<string, string> = {}
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                queryParams[key] =
                    typeof value === 'object' && value !== null ? String(value.value) : String(value)
            }
        })
        setSearchParams(queryParams)
        navigate(
            `${AppRoute.AdminOrders}?${new URLSearchParams(queryParams).toString()}`
        )
    }

    const handleClearFilters = () => {
        dispatch(clearFilters())
        setSearchParams({})
        dispatch(fetchOrdersWithFilters({}))
        navigate(AppRoute.AdminOrders)
    }

    return (
        <>
            <h2 className={styles.admin__title}>Фильтры</h2>
            <Filter
                fields={ordersFilterFields}
                onFilter={handleFilter}
                onClear={handleClearFilters}
                defaultValue={filterOrderOption}
            />
        </>
    )
}