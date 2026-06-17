import Sidebar from './Sidebar'

function Layout({ children }) {
    return (
        <div style={styles.container}>
            <Sidebar />
            <main style={styles.main}>
                {children}
            </main>
        </div>
    )
}

const styles = {
    container: {
        display: 'flex',
        minHeight: '100vh'
    },
    main: {
        flex: 1,
        padding: '28px 32px',
        overflowY: 'auto',
        minHeight: '100vh'
    }
}

export default Layout
