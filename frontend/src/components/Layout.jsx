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
        backgroundColor: '#f0f4f8',
        padding: '24px',
        overflowY: 'auto'
    }
}

export default Layout