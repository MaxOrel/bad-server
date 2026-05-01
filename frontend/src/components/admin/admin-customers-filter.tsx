import { useActionCreators, useDispatch, useSelector } from '@store/hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    customersActions,
    customersSelector,
} from '../../services/slice/customers'
import { fetchCustomersWithFilters } from '../../services/slice/customers/thunk'
import { AppRoute } from '../../utils/constants'
import Filter from '../filter'
import styles from './admin.module.scss'
import { customersFilterFields } from './helpers/customersFilterFields'

// Тип для значений фильтров
type FilterValue = string | number | { value: string; title: string } | null
type FilterRecord = Record<string, FilterValue>

export default function AdminFilterCustomers() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [_, setSearchParams] = useSearchParams()
    const { updateFilter, clearFilters } = useActionCreators(customersActions)
    const filterCustomersOption = useSelector(
        customersSelector.selectFilterOption
    )

    const handleFilter = (filters: FilterRecord) => {
        dispatch(updateFilter({ ...filters }))
        const queryParams: Record<string, string> = {}
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                queryParams[key] =
                    typeof value === 'object' && value !== null ? String(value.value) : String(value)
            }
        })
        setSearchParams(queryParams)
        navigate(
            `${AppRoute.AdminCustomers}?${new URLSearchParams(
                queryParams
            ).toString()}`
        )
    }

    const handleClearFilters = () => {
        dispatch(clearFilters())
        setSearchParams({})
        dispatch(fetchCustomersWithFilters({}))
        navigate(AppRoute.AdminCustomers)
    }

    return (
        <>
            <h2 className={styles.admin__title}>Фильтры</h2>
            <Filter
                fields={customersFilterFields}
                onFilter={handleFilter}
                defaultValue={filterCustomersOption}
                onClear={handleClearFilters}
            />
        </>
    )
}