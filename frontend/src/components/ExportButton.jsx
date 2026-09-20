import { useState, useRef, useEffect } from 'react'
import { 
  Download, FileSpreadsheet, FileStack, File, 
  Archive, ChevronDown, Check, FolderArchive, Sparkles 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ExportButton({ type, filters, journalId, journalIds }) {
  const [isExporting, setIsExporting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState('zip') // 'zip' (Excel + Images) | 'xlsx' (Excel Only) | 'images' (Images Only)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getExportUrl = (format = selectedFormat) => {
    const apiHost = import.meta.env.VITE_API_URL || 
      (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
        ? 'https://trademark-data-journal-backend.onrender.com'
        : 'http://localhost:8000')
    const baseUrl = `${apiHost}/api`
    
    switch (type) {
      case 'all': {
        const params = new URLSearchParams()
        if (filters?.journal_number) params.append('journal_number', filters.journal_number)
        if (filters?.class_number) params.append('class_number', filters.class_number)
        if (filters?.application_number) params.append('application_number', filters.application_number)
        if (filters?.office_location) params.append('office_location', filters.office_location)
        if (filters?.search) params.append('search', filters.search)
        params.append('format', format)
        return `${baseUrl}/export/all?${params.toString()}`
      }
      
      case 'by-journal': {
        const params = new URLSearchParams()
        if (journalIds && journalIds.length > 0) {
          params.append('journal_ids', journalIds.join(','))
        }
        params.append('format', format === 'images' ? 'zip' : format)
        return `${baseUrl}/export/by-journal?${params.toString()}`
      }
      
      case 'by-pdf': {
        return `${baseUrl}/export/journal/${journalId}/by-pdf?format=${format === 'images' ? 'zip' : format}`
      }
      
      default:
        return null
    }
  }

  const handleExport = async (format = selectedFormat) => {
    setIsExporting(true)
    setShowDropdown(false)
    
    try {
      const url = getExportUrl(format)
      if (!url) {
        alert('Invalid export type')
        return
      }

      // Download file directly
      const link = document.createElement('a')
      link.href = url
      link.download = '' // Let backend Content-Disposition define filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (error) {
      console.error('Export error:', error)
      alert('❌ Export failed. Please try again.')
    } finally {
      setTimeout(() => setIsExporting(false), 2500)
    }
  }

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* Primary Action Button */}
      <motion.button
        onClick={() => handleExport(selectedFormat)}
        disabled={isExporting}
        className="btn-secondary !pr-2.5 flex items-center space-x-2 rounded-r-none border-r-0 disabled:opacity-50 shadow-xs hover:border-primary-400 hover:text-primary-700 transition-colors"
        whileTap={{ scale: 0.98 }}
        title="Export records & images"
      >
        {isExporting ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Download className="h-4 w-4 text-primary-600" />
          </motion.div>
        ) : selectedFormat === 'zip' ? (
          <Archive className="h-4 w-4 text-primary-600" />
        ) : selectedFormat === 'xlsx' ? (
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
        ) : (
          <FolderArchive className="h-4 w-4 text-amber-600" />
        )}
        
        <span className="font-semibold text-xs sm:text-sm">
          {isExporting ? 'Packaging...' : selectedFormat === 'zip' ? 'Export ZIP (Excel + Img)' : selectedFormat === 'xlsx' ? 'Export Excel Only' : 'Export Images ZIP'}
        </span>
      </motion.button>

      {/* Dropdown Toggle Trigger */}
      <motion.button
        onClick={() => !isExporting && setShowDropdown(!showDropdown)}
        disabled={isExporting}
        className="btn-secondary !px-2 flex items-center rounded-l-none border-l border-slate-200 disabled:opacity-50 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        whileTap={{ scale: 0.95 }}
        title="Choose export format"
      >
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-slate-800"
          >
            <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
              Select Export Format
            </div>

            {/* Option 1: Excel + Images ZIP */}
            <button
              onClick={() => {
                setSelectedFormat('zip')
                handleExport('zip')
              }}
              className={`w-full flex items-start space-x-2.5 p-2 rounded-lg text-left transition-all ${
                selectedFormat === 'zip' ? 'bg-primary-50 text-primary-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="p-1.5 rounded-md bg-primary-100 text-primary-700 shrink-0 mt-0.5">
                <Archive className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-slate-900">Excel + Images (ZIP)</span>
                  <span className="text-[10px] bg-primary-600 text-white font-bold px-1.5 py-0.2 rounded-full">Best</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">Excel file + complete logo images folder</p>
              </div>
              {selectedFormat === 'zip' && <Check className="h-4 w-4 text-primary-600 shrink-0 mt-1" />}
            </button>

            {/* Option 2: Excel Spreadsheet Only */}
            <button
              onClick={() => {
                setSelectedFormat('xlsx')
                handleExport('xlsx')
              }}
              className={`w-full flex items-start space-x-2.5 p-2 rounded-lg text-left transition-all ${
                selectedFormat === 'xlsx' ? 'bg-emerald-50 text-emerald-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900">Excel Sheet Only (.xlsx)</div>
                <p className="text-[11px] text-slate-500 line-clamp-1">Data sheet only, fast download</p>
              </div>
              {selectedFormat === 'xlsx' && <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-1" />}
            </button>

            {/* Option 3: Images Only */}
            <button
              onClick={() => {
                setSelectedFormat('images')
                handleExport('images')
              }}
              className={`w-full flex items-start space-x-2.5 p-2 rounded-lg text-left transition-all ${
                selectedFormat === 'images' ? 'bg-amber-50 text-amber-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="p-1.5 rounded-md bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                <FolderArchive className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900">Images Archive (.zip)</div>
                <p className="text-[11px] text-slate-500 line-clamp-1">Download all logo pictures in a zip</p>
              </div>
              {selectedFormat === 'images' && <Check className="h-4 w-4 text-amber-600 shrink-0 mt-1" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
