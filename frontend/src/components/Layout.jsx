import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, Stamp, Search, Zap, ShieldCheck } from 'lucide-react'

export default function Layout({ children }) {
  const location = useLocation()
  
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }
  
  const navLinks = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/journals', label: 'Journals', icon: BookOpen },
    { path: '/trademarks', label: 'Trademarks', icon: Stamp },
    { path: '/search', label: 'Quick Search', icon: Search },
  ]
  
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      {/* Header & Nav */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <Stamp className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-extrabold bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent">
                    IP India Scraper
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full">
                    v2.0 Ultra
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Trade Marks Registry Official Journal Database
                </p>
              </div>
            </Link>

            {/* Navigation Tabs */}
            <nav className="flex items-center space-x-1 sm:space-x-2">
              {navLinks.map(({ path, label, icon: Icon }) => {
                const active = isActive(path)
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 group ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                        : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/80 hover:scale-[1.04] active:scale-[0.98] border border-transparent hover:border-indigo-200/60'
                    }`}
                  >
                    <Icon className={`h-4 w-4 transition-all duration-200 ${
                      active 
                        ? 'text-white' 
                        : 'text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 group-hover:-rotate-6'
                    }`} />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Status indicator */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-800">System Ready</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <span>Direct scraper pipeline synced with Controller General of Patents, Designs & Trademarks (CGPDTM)</span>
            </div>
            <span>High-Speed Extraction powered by PyMuPDF</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
