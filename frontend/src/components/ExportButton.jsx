import { useState, useRef, useEffect } from 'react'
import { 
  Download, FileSpreadsheet, FileStack, File, 
  Archive, ChevronDown, Check, FolderArchive, Sparkles,
  Loader2, CheckCircle2, Clock, AlertCircle, X, Ban, Zap
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ExportButton({ type, filters, journalId, journalIds }) {
  const [isExporting, setIsExporting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState('xlsx') // 'zip' (Excel + Images) | 'xlsx' (Excel Only) | 'images' (Images Only)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [statusStage, setStatusStage] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [exportError, setExportError] = useState(null)
  
  const dropdownRef = useRef(null)
  const timerRef = useRef(null)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup timer & abort controller on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setIsExporting(false)
    setIsCompleted(false)
    setExportError('Export cancelled by user.')
    setTimeout(() => setExportError(null), 3500)
  }

  const handleExport = async (format = selectedFormat) => {
    if (isExporting) return
    setIsExporting(true)
    setIsCompleted(false)
    setExportError(null)
    setSecondsElapsed(0)
    setShowDropdown(false)

    abortControllerRef.current = new AbortController()
    
    setStatusStage(
      format === 'xlsx' 
        ? 'Step 1/2: Querying database & building spreadsheet...' 
        : 'Step 1/3: Querying 5,500+ records & building Excel sheet...'
    )

    // Start live progress timer
    if (timerRef.current) clearInterval(timerRef.current)
    let currentSec = 0
    timerRef.current = setInterval(() => {
      currentSec += 1
      setSecondsElapsed(currentSec)

      if (format === 'xlsx') {
        if (currentSec >= 3) {
          setStatusStage('Step 2/2: Auto-sizing columns & streaming Excel file...')
        }
      } else {
        if (currentSec <= 6) {
          setStatusStage('Step 1/3: Querying records & creating Excel file...')
        } else if (currentSec <= 20) {
          setStatusStage('Step 2/3: Archiving 5,500+ logo images (Fast Stored Mode)...')
        } else if (currentSec <= 45) {
          setStatusStage('Step 3/3: Packaging ZIP archive & transferring stream...')
        } else {
          setStatusStage('Finalizing & browser receiving download...')
        }
      }
    }, 1000)

    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timerRef.current) clearInterval(timerRef.current)
      setIsExporting(false)
      setExportError('Server timeout on large 5,500+ images package. Please choose "Excel Sheet (.xlsx)" for fast 20s download.')
    }, 90000)

    try {
      const url = getExportUrl(format)
      if (!url) {
        throw new Error('Invalid export configuration')
      }

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status} ${response.statusText}`)
      }

      // Extract filename from Content-Disposition header
      let filename = format === 'xlsx' ? 'trademarks_export.xlsx' : 'trademarks_export.zip'
      const disposition = response.headers.get('content-disposition')
      if (disposition && disposition.includes('filename=')) {
        const parts = disposition.split('filename=')
        if (parts.length > 1) {
          filename = parts[1].split(';')[0].trim().replace(/['"]/g, '')
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
      setStatusStage(`Export finished! ${filename} downloaded successfully.`)

      setTimeout(() => {
        setIsExporting(false)
        setIsCompleted(false)
      }, 4000)

    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        return // Handled in handleCancel
      }
      console.error('Export error:', error)
      if (timerRef.current) clearInterval(timerRef.current)
      setExportError(error.message || 'Export failed. Please try again.')
      setTimeout(() => {
        setIsExporting(false)
        setExportError(null)
      }, 6000)
    }
  }

  // Calculate realistic progress bar percentage
  const getProgressPercent = () => {
    if (isCompleted) return 100
    if (selectedFormat === 'xlsx') {
      return Math.min(95, Math.round((secondsElapsed / 4) * 90))
    }
    // For ZIP (Smooth curve: ~50% at 20s, ~80% at 45s, up to 94%)
    if (secondsElapsed <= 20) {
      return Math.round((secondsElapsed / 20) * 50)
    } else if (secondsElapsed <= 45) {
      return 50 + Math.round(((secondsElapsed - 20) / 25) * 32)
    } else {
      return Math.min(95, 82 + Math.round(((secondsElapsed - 45) / 30) * 12))
    }
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
          ) : (
            <Download className="h-4 w-4 text-primary-600" />
          )}
          <span className="font-semibold text-xs">
            {isExporting 
              ? `Exporting... (${secondsElapsed}s)` 
              : isCompleted 
                ? 'Downloaded!' 
                : 'Export'}
          </span>
        </motion.button>

        {/* Dropdown Toggle Caret */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isExporting}
          className={`btn-secondary !px-1.5 rounded-l-none border-l border-slate-200 transition-colors ${
            showDropdown ? 'bg-slate-100 text-primary-700' : 'hover:bg-slate-50'
          }`}
          title="Select Export Format"
        >
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </button>

        {/* Format Selector Dropdown */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-white p-2 shadow-xl border border-slate-200 z-50 space-y-1"
            >
              <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
                <span>Select Export Format</span>
                <Sparkles className="h-3 w-3 text-primary-500" />
              </div>

              {/* Option 1: Excel Spreadsheet Only (FASTEST) */}
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
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-900">Excel Sheet (.xlsx)</span>
                    <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 inline" /> ~2s Ultra Fast
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">All trademark rows &amp; metadata</p>
                </div>
                {selectedFormat === 'xlsx' && <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-1" />}
              </button>

              {/* Option 2: Excel + Images ZIP */}
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
                    <span className="text-[10px] bg-primary-600 text-white font-bold px-1.5 py-0.2 rounded-full">Complete Pack</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">Excel file + all 5,500+ logos</p>
                </div>
                {selectedFormat === 'zip' && <Check className="h-4 w-4 text-primary-600 shrink-0 mt-1" />}
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
                  <p className="text-[11px] text-slate-500 line-clamp-1">Only extracted logo files</p>
                </div>
                {selectedFormat === 'images' && <Check className="h-4 w-4 text-amber-600 shrink-0 mt-1" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Live Processing & Monitoring Card */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-white/95 backdrop-blur-md p-4 shadow-2xl border border-slate-200/90 text-slate-900"
          >
            {/* Header with live timer & cancel button */}
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

              {/* Right tools: Timer + Cancel */}
              <div className="flex items-center space-x-2">
                <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                  isCompleted 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-primary-50 border-primary-200 text-primary-700'
                }`}>
                  <Clock className="h-3.5 w-3.5" />
                  <span>{secondsElapsed < 10 ? `0${secondsElapsed}s` : `${secondsElapsed}s`}</span>
                </div>

                {!isCompleted && (
                  <button
                    onClick={handleCancel}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Cancel Export Process"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
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

            {/* Helpful reassurance footer with abort action */}
            {!isCompleted && !exportError && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{selectedFormat === 'zip' ? '5,500+ Images Pack' : 'High Speed Export'}</span>
                </span>
                <button
                  onClick={handleCancel}
                  className="text-rose-600 font-semibold hover:underline"
                >
                  Cancel Export
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
