import Calendar from './components/Calendar'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <header className="py-6 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📅 相册月历
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            记录每一天的美好瞬间
          </p>
        </div>
      </header>

      <main className="container mx-auto py-8">
        <Calendar />
      </main>

      <footer className="py-6 text-center text-gray-400 dark:text-gray-600 text-sm">
        <p>© {new Date().getFullYear()} Photo Calendar. All memories stored locally.</p>
      </footer>
    </div>
  )
}

export default App
