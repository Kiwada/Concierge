import Logo from '../Logo/Index'
import HeaderList from './components/HeaderList'
import HeaderListItem from './components/HeaderListItem'
import HeaderLinks from './components/HeaderLinks'
import HeaderFormFilters from './components/HeaderFormFilters'
import HeaderActions from './components/HeaderActions'
import styles from './Header.module.css'


const Header = () => {
    return (
        <header>
            <HeaderList>
                <HeaderListItem>
                    <Logo src='/logoConciergeHub.png' alt='Logo Concierge Hub' className={styles.logoHeader} />
                </HeaderListItem>
                <HeaderListItem>
                    <HeaderLinks />
                </HeaderListItem>
                <HeaderListItem>
                    <HeaderFormFilters />
                </HeaderListItem>
                <HeaderListItem>
                    <HeaderActions />
                </HeaderListItem>
            </HeaderList>
        </header>
    )
}

export default Header
