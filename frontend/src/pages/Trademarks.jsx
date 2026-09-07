import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { 
  Filter, X, Search, Calendar, BookOpen, Stamp, Building2, 
  MapPin, ArrowUpRight, Sparkles, SlidersHorizontal, FileText, CheckCircle2,
  Table, LayoutGrid
} from 'lucide-react'

import { getTrademarks } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import Pagination from '../components/Pagination'
import ExportButton from '../components/ExportButton'

const POPULAR_CLASSES = [5, 9, 30, 35, 41, 42]
const OFFICES = ['Mumbai', 'Delhi', 'Kolkata', 'Chennai', 'Ahmedabad']

export default function Trademarks() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50) // options: 10, 50, 100, 200
  const [viewMode, setViewMode] = useState('table') // 'table' (default) | 'grid'
  const [filters, setFilters] = useState({
    search: '',
    class_number: '',
    application_number: '',
    applicant: '',
    journal_number: '',
    proprietor_name: '',
    application_type: '',
    office_location: ''
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [showFilters, setShowFilters] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 400)
    return () => clearTimeout(timer)
  }, [filters])
  
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['trademarks', page, limit, debouncedFilters],
    queryFn: () => getTrademarks({
      page,
      limit,
      search: debouncedFilters.search || undefined,
      class_number: debouncedFilters.class_number || undefined,
      application_number: debouncedFilters.application_number || undefined,
      applicant: debouncedFilters.applicant || undefined,
      proprietor_name: debouncedFilters.proprietor_name || undefined,
      journal_number: debouncedFilters.journal_number || undefined,
      application_type: debouncedFilters.application_type || undefined,
      office_location: debouncedFilters.office_location || undefined
    })
  })
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }
  
  const clearFilters = () => {
    setFilters({ 
      search: '', 
      class_number: '', 
      application_number: '',
      applicant: '',
      journal_number: '',
      proprietor_name: '',
      application_type: '',
      office_location: ''
    })
    setPage(1)
  }
  
  if (isLoading) return <LoadingSpinner size="lg" />
  if (error) return <ErrorMessage message={error.message} />
  
  const trademarks = data?.trademarks || []
  const totalPages = data?.pages || 1
  const totalCount = data?.total || 0
  const activeFiltersCount = Object.values(filters).filter(v => v).length
  
  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Registered Trademarks
            </h1>
            <span className="badge badge-info text-xs font-bold">
              {totalCount.toLocaleString()} Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official applications published across Trade Marks Registry gazettes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Top Records Per Page Selector */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-semibold bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs">
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1)
              }}
              className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg text-xs font-bold py-0.5 px-1.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer"
            >
              {[10, 50, 100, 200].map(val => (
                <option key={val} value={val}>{val} / page</option>
              ))}
            </select>
          </div>

          {/* View Mode Switcher Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              title="Table View (Default)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Table className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>

            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          <ExportButton type="all" filters={debouncedFilters} />
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center space-x-2 ${
              showFilters || activeFiltersCount > 0 ? '!border-primary-400 !text-primary-700 !bg-primary-50/50' : ''
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Search Bar & Quick Office Tabs */}
      <div className="card !p-4 space-y-3 bg-white shadow-card border-slate-200/80">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Search by trademark name, word mark, applicant name, application number..."
            className="input-field !pl-11 w-full text-sm font-medium"
          />
          {filters.search && (
            <button 
              onClick={() => handleFilterChange('search', '')}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Office Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-slate-400 font-semibold mr-1 flex items-center space-x-1">
            <MapPin className="h-3 w-3" />
            <span>Jurisdiction:</span>
          </span>
          <button
            onClick={() => handleFilterChange('office_location', '')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              !filters.office_location 
                ? 'bg-slate-900 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Offices
          </button>
          {OFFICES.map((office) => (
            <button
              key={office}
              onClick={() => handleFilterChange('office_location', filters.office_location === office ? '' : office)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filters.office_location === office 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {office}
            </button>
          ))}
        </div>
      </div>
      
      {/* Extended Filters Drawer */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="card !p-5 overflow-hidden bg-slate-50/70 border border-slate-200"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Filter className="h-4 w-4 text-primary-600" />
                <span>Refine Search Results</span>
              </h3>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Application No
                </label>
                <input
                  type="text"
                  value={filters.application_number}
                  onChange={(e) => handleFilterChange('application_number', e.target.value)}
                  placeholder="e.g. 7846040"
                  className="input-field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Class Number (1 - 99)
                </label>
                <input
                  type="number"
                  value={filters.class_number}
                  onChange={(e) => handleFilterChange('class_number', e.target.value)}
                  placeholder="e.g. 5, 9, 30, 42, 99"
                  min="1"
                  max="99"
                  className="input-field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Journal Number
                </label>
                <input
                  type="text"
                  value={filters.journal_number}
                  onChange={(e) => handleFilterChange('journal_number', e.target.value)}
                  placeholder="e.g. 2174"
                  className="input-field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Applicant Name
                </label>
                <input
                  type="text"
                  value={filters.applicant}
                  onChange={(e) => handleFilterChange('applicant', e.target.value)}
                  placeholder="Company / Individual name"
                  className="input-field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Application Type / Entity
                </label>
                <input
                  type="text"
                  value={filters.application_type}
                  onChange={(e) => handleFilterChange('application_type', e.target.value)}
                  placeholder="e.g. Private Limited, Individual"
                  className="input-field w-full text-xs"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Trademarks View: Table or Grid */}
      {trademarks.length > 0 && (
        viewMode === 'table' ? (
          <div className="card !p-0 overflow-hidden shadow-card border border-slate-200/90 rounded-2xl bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    <th className="py-3.5 px-4">App No & Filing</th>
                    <th className="py-3.5 px-4 min-w-[220px]">Trademark Name</th>
                    <th className="py-3.5 px-4 text-center">Class</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Applicant & Entity</th>
                    <th className="py-3.5 px-4">Journal & Gazette</th>
                    <th className="py-3.5 px-4 min-w-[220px]">Goods / Services</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trademarks.map((tm) => (
                    <tr 
                      key={tm.id} 
                      className="hover:bg-primary-50/30 transition-colors duration-150 group"
                    >
                      {/* App No & Filing Date */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 font-mono text-xs">
                          {tm.application_number || 'N/A'}
                        </div>
                        {tm.filing_date && (
                          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                            Filed: {format(new Date(tm.filing_date), 'dd/MM/yyyy')}
                          </div>
                        )}
                      </td>

                      {/* Trademark Name & Location */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-primary-700 transition-colors leading-snug">
                          {tm.trademark_name || 'Unnamed Trademark'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {tm.office_location && (
                            <span className="badge badge-warning text-[10px] py-0.5 px-1.5 flex items-center space-x-0.5 font-bold">
                              <MapPin className="h-2.5 w-2.5" />
                              <span>{tm.office_location}</span>
                            </span>
                          )}
                          {tm.used_since && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              Used: {tm.used_since}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                        {tm.class_number ? (
                          <span className="badge badge-info text-xs font-extrabold px-2.5 py-1 shadow-subtle">
                            Class {tm.class_number}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Applicant & Entity */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-800 leading-tight" title={tm.applicant_name}>
                          {tm.applicant_name || 'N/A'}
                        </div>
                        {tm.applicant_type && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {tm.applicant_type}
                          </div>
                        )}
                      </td>

                      {/* Journal & Gazette */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-bold text-primary-700 flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-primary-600" />
                          <span>{tm.publication_date ? format(new Date(tm.publication_date), 'dd MMM yyyy') : 'Gazette'}</span>
                        </div>
                        {tm.journal_number && (
                          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                            Journal #{tm.journal_number}
                          </div>
                        )}
                      </td>

                      {/* Goods & Services */}
                      <td className="py-3.5 px-4 align-top">
                        {tm.goods_services ? (
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed" title={tm.goods_services}>
                            {tm.goods_services}
                          </p>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not specified</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <Link
                          to={`/trademarks/${tm.id}`}
                          className="btn-secondary !text-xs !py-1.5 !px-3 inline-flex items-center space-x-1 group-hover:!bg-primary-600 group-hover:!text-white group-hover:!border-primary-600 transition-all shadow-subtle"
                        >
                          <span>View Details</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid / Card Layout */
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.03 } }
            }}
          >
            {trademarks.map((tm) => (
              <motion.div
                key={tm.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 }
                }}
                transition={{ duration: 0.2 }}
                className="card card-hover !p-5 relative group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  {/* Title & Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-primary-700 transition-colors">
                      {tm.trademark_name || 'Unnamed Trademark'}
                    </h3>
                    
                    {tm.class_number && (
                      <span className="badge badge-info">Class {tm.class_number}</span>
                    )}
                    
                    {tm.office_location && (
                      <span className="badge badge-warning flex items-center space-x-1">
                        <MapPin className="h-3 w-3" />
                        <span>{tm.office_location}</span>
                      </span>
                    )}

                    {tm.applicant_type && (
                      <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                        {tm.applicant_type}
                      </span>
                    )}
                  </div>
                  
                  {/* Meta details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                    {tm.application_number && (
                      <p>
                        <span className="font-semibold text-slate-700">App No:</span> {tm.application_number}
                      </p>
                    )}

                    {tm.applicant_name && (
                      <p className="truncate" title={tm.applicant_name}>
                        <span className="font-semibold text-slate-700">Applicant:</span> {tm.applicant_name}
                      </p>
                    )}

                    {/* Publication Date Info */}
                    <p className="flex items-center space-x-1.5 text-primary-700 font-bold">
                      <Calendar className="h-3.5 w-3.5 text-primary-600" />
                      <span>
                        Published: {tm.publication_date ? format(new Date(tm.publication_date), 'dd MMM yyyy') : 'Official Gazette'}
                      </span>
                      {tm.journal_number && (
                        <span className="text-slate-400 font-normal">
                          (J#{tm.journal_number})
                        </span>
                      )}
                    </p>

                    {tm.filing_date && (
                      <p>
                        <span className="font-semibold text-slate-700">Filing Date:</span> {format(new Date(tm.filing_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>

                  {/* Goods / Services Description */}
                  {tm.goods_services && (
                    <p className="text-xs text-slate-500 line-clamp-2 pt-2 border-t border-slate-100">
                      <span className="font-semibold text-slate-700">Goods/Services:</span> {tm.goods_services}
                    </p>
                  )}
                </div>
                
                {/* Action Button */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-end">
                  <Link
                    to={`/trademarks/${tm.id}`}
                    className="btn-secondary !text-xs !py-1.5 !px-3 flex items-center space-x-1.5 group-hover:!bg-primary-600 group-hover:!text-white group-hover:!border-primary-600 transition-all shadow-subtle"
                  >
                    <span>View Details</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )
      )}
      
      {/* Empty State */}
      {trademarks.length === 0 && !isLoading && (
        <div className="card text-center py-16 space-y-3">
          <Stamp className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No trademarks found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No trademark records match your filter criteria. Try clearing search filters or run the scraper on the Dashboard.
          </p>
          {activeFiltersCount > 0 && (
            <button onClick={clearFilters} className="btn-primary !text-xs mt-2">
              Clear All Filters
            </button>
          )}
        </div>
      )}
      
      {/* Pagination & Limit Selection */}
      {totalCount > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(newLimit) => {
            setLimit(newLimit)
            setPage(1)
          }}
          limitOptions={[10, 50, 100, 200]}
          totalRecords={totalCount}
        />
      )}
    </div>
  )
}
