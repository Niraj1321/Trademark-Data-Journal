import { useState, useRef, useEffect } from 'react'
import { 
  Download, FileSpreadsheet, FileStack, File, 
  Archive, ChevronDown, Check, FolderArchive, Sparkles,
  Loader2, CheckCircle2, Clock, AlertCircle, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ExportButton({ type, filters, journalId, journalIds }) {
  const [isExporting, setIsExporting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState('zip') // 'zip' (Excel + Images) | 'xlsx' (Excel Only) | 'images' (Images Only)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [statusStage, setStatusStage] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [exportError, setExportError] = useState(null)
  
  const dropdownRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
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
    if (isExporting) return
    setIsExporting(true)
    setIsCompleted(false)
    setExportError(null)
    setSecondsElapsed(0)
    setShowDropdown(false)
    
    setStatusStage(
      format === 'xlsx' 
        ? 'Fetching trademark records & formatting spreadsheet...' 
        : 'Preparing dataset & querying images from database...'
    )

    // Start live countdown timer
    if (timerRef.current) clearInterval(timerRef.current)
    let currentSec = 0
    timerRef.current = setInterval(() => {
      currentSec += 1
      setSecondsElapsed(currentSec)

      if (format === 'xlsx') {
        if (currentSec >= 3) {
          setStatusStage('Building Excel worksheet with auto-sized columns...')
        }
      } else {
        if (currentSec <= 3) {
          setStatusStage('Preparing dataset & querying records from database...')
        } else if (currentSec <= 7) {
          setStatusStage('Generating Excel workbook & metadata sheets...')
        } else if (currentSec <= 13) {
          setStatusStage('Compressing logo images & word marks into ZIP (~65MB)...')
        } else {
          setStatusStage('Finalizing archive & transmitting to browser...')
        }
      }
    }, 1000)

    try {
      const url = getExportUrl(format)
      if (!url) {
        throw new Error('Invalid export configuration')
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status} ${response.statusText}`)
      }

      // Extract filename from Content-Disposition header
      let filename = format === 'xlsx' ? 'trademarks_export.xlsx' : 'trademarks_export.zip'
      const disposition = response.headers.get('content-disposition')
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition)
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '')
        }
      }

      const blob = await response.blob()
      
      // Trigger download
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      // Stop timer and mark completed
      if (timerRef.current) clearInterval(timerRef.current)
      setIsCompleted(true)
      setStatusStage(`Done! ${filename} downloaded successfully.`)

      setTimeout(() => {
        setIsExporting(false)
        setIsCompleted(false)
      }, 4000)

    } catch (error) {
      console.error('Export error:', error)
      if (timerRef.current) clearInterval(timerRef.current)
      setExportError(error.message || 'Export failed. Please try again.')
      setTimeout(() => {
        setIsExporting(false)
        setExportError(null)
      }, 6000)
    }
  }

  // Calculate estimated progress bar percentage
  const getProgressPercent = () => {
    if (isCompleted) return 100
    if (selectedFormat === 'xlsx') {
      return Math.min(95, Math.round((secondsElapsed / 4) * 90))
    }
    // For ZIP (estimated ~14-16s)
    return Math.min(94, Math.round((secondsElapsed / 15) * 90))
  }

  return (
    <>
      <div className="relative inline-flex items-center" ref={dropdownRef}>
        {/* Primary Action Button */}
        <motion.button
          onClick={() => handleExport(selectedFormat)}
          disabled={isExporting}
          className={`btn-secondary !pr-2.5 flex items-center space-x-2 rounded-r-none border-r-0 shadow-xs transition-all ${
            isExporting 
              ? '!border-primary-400 !bg-primary-50/70 text-primary-800' 
              : 'hover:border-primary-400 hover:text-primary-700'
          }`}
          whileTap={{ scale: 0.98 }}
          title="Export records & images"
        >
          {isExporting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-4 w-4 text-primary-600" />
            </motion.div>
          ) : isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : selectedFormat === 'zip' ? (
            <Archive className="h-4 w-4 text-primary-600" />
          ) : selectedFormat === 'xlsx' ? (
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          ) : (
            <FolderArchive className="h-4 w-4 text-amber-600" />
          )}
          
          <span className="font-semibold text-xs sm:text-sm">
            {isExporting 
              ? `Packaging... (${secondsElapsed}s)` 
              : isCompleted
              ? 'Downloaded!'
              : selectedFormat === 'zip' 
              ? 'Export ZIP (Excel + Img)' 
              : selectedFormat === 'xlsx' 
              ? 'Export Excel Only' 
              : 'Export Images ZIP'
            }
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
              className="absolute right-0 top-full mt-1.5 w-68 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-slate-800"
            >
              <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                <span>Select Export Format</span>
                <Sparkles className="h-3 w-3 text-primary-500" />
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
                    <span className="text-[10px] bg-primary-600 text-white font-bold px-1.5 py-0.2 rounded-full">All In One</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">Full Excel file + logo images folder</p>
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
                  <p className="text-[11px] text-slate-500 line-clamp-1">Fast data sheet with image paths</p>
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
                  <p className="text-[11px] text-slate-500 line-clamp-1">Download pure images directory</p>
                </div>
                {selectedFormat === 'images' && <Check className="h-4 w-4 text-amber-600 shrink-0 mt-1" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Live Countdown & Progress Card */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-white/95 backdrop-blur-md p-4 shadow-2xl border border-slate-200/90 text-slate-900"
          >
            {/* Header with live timer */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-primary-100 text-primary-600'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="h-5 w-5" />
                    </motion.div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {isCompleted ? 'Export Completed!' : 'Generating Export Package...'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {selectedFormat === 'zip' ? 'Excel Spreadsheet + 5,500+ Logo Images' : 'Excel Trademark Records'}
                  </p>
                </div>
              </div>

              {/* Running countdown / stopwatch badge */}
              <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                isCompleted 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-primary-50 border-primary-200 text-primary-700'
              }`}>
                <Clock className="h-3.5 w-3.5" />
                <span>{secondsElapsed < 10 ? `0${secondsElapsed}s` : `${secondsElapsed}s`}</span>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="my-3 space-y-1.5">
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden relative border border-slate-200/60">
                <motion.div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-emerald-500' 
                      : 'bg-gradient-to-r from-primary-500 via-indigo-500 to-primary-600'
                  }`}
                  style={{ width: `${getProgressPercent()}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-medium text-slate-600 truncate max-w-[240px]">{statusStage}</span>
                <span className="font-bold text-slate-700 shrink-0">{getProgressPercent()}%</span>
              </div>
            </div>

            {/* Error Message if any */}
            {exportError && (
              <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            {/* Helpful reassurance footer */}
            {!isCompleted && !exportError && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Server processing smoothly</span>
                </span>
                <span>Est. time: ~10-15s</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
