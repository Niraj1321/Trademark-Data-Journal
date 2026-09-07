import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Download, FileCheck, Loader2, CheckCircle2, XCircle, 
  Terminal, Sparkles, X, ArrowRight, Gauge, Cpu, FileSpreadsheet
} from 'lucide-react'

export default function ProgressTracker({ 
  isOpen, 
  onClose, 
  mode = 'full', // 'full' | 'download' | 'extract'
  onComplete 
}) {
  const [status, setStatus] = useState('idle') // 'idle' | 'running' | 'completed' | 'error'
  const [logs, setLogs] = useState([])
  const [currentStep, setCurrentStep] = useState(1) // 1: Portal, 2: Download, 3: Extract, 4: Complete
  const [currentAction, setCurrentAction] = useState('Initializing...')
  const [progressDetails, setProgressDetails] = useState({
    downloadedPdfs: 0,
    totalPdfs: 0,
    extractedRecords: 0,
    totalPages: 0,
    latestFile: '',
    speed: '',
    journalNumber: '',
  })
  
  const logEndRef = useRef(null)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    if (isOpen && status === 'idle') {
      startScraper()
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [isOpen])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev.slice(-40), { time, text, type }])
  }

  const startScraper = () => {
    setStatus('running')
    setLogs([])
    setCurrentStep(1)
    setCurrentAction('Connecting to IP India Trademark Portal...')
    addLog('🚀 Initiating scraper engine...', 'info')

    let endpoint = '/api/scraper/stream'
    if (mode === 'download') endpoint = '/api/scraper/download-pdfs'
    if (mode === 'extract') endpoint = '/api/scraper/extract-pdfs'

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const es = new EventSource(`${API_BASE}${endpoint}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'ping') return

        if (data.step === 'connect') {
          setCurrentStep(1)
          setCurrentAction('Connecting to IP India portal...')
          addLog(data.message, 'info')
        } else if (data.step === 'table_extracted') {
          setCurrentAction(`Found ${data.journals_found} Journal(s). Starting download...`)
          addLog(`✓ Found ${data.journals_found} journals on IP India table`, 'success')
        } else if (data.step === 'download_start') {
          setCurrentStep(2)
          setCurrentAction(`Downloading ${data.total_pdfs} PDFs in parallel...`)
          setProgressDetails(prev => ({
            ...prev,
            totalPdfs: data.total_pdfs,
            journalNumber: data.journal_number || prev.journalNumber
          }))
          addLog(`📥 Starting concurrent download for ${data.total_pdfs} PDFs (Journal #${data.journal_number})`, 'info')
        } else if (data.step === 'download_progress') {
          setCurrentStep(2)
          setCurrentAction(`Downloading PDF [${data.downloaded}/${data.total}]...`)
          setProgressDetails(prev => ({
            ...prev,
            downloadedPdfs: data.downloaded,
            totalPdfs: data.total,
            latestFile: data.filename
          }))
          addLog(`✓ [${data.percentage}%] Downloaded ${data.filename} (${data.size_mb} MB)`, 'info')
        } else if (data.step === 'download_complete') {
          setCurrentStep(mode === 'download' ? 4 : 3)
          addLog(`✓ All ${data.downloaded} PDFs downloaded successfully`, 'success')
        } else if (data.step === 'extract_start') {
          setCurrentStep(3)
          setCurrentAction(`Extracting trademarks with PyMuPDF...`)
          setProgressDetails(prev => ({ ...prev, totalPdfs: data.pending_pdfs || prev.totalPdfs }))
          addLog(`⚡ Starting PyMuPDF ultra-fast extraction across ${data.pending_pdfs} PDFs`, 'info')
        } else if (data.step === 'extract_file_done') {
          setCurrentStep(3)
          setCurrentAction(`Extracted ${data.records} TMs from ${data.file_name}`)
          setProgressDetails(prev => ({
            ...prev,
            extractedRecords: (prev.extractedRecords || 0) + data.records,
            latestFile: data.file_name,
            speed: `${Math.round(data.pages / Math.max(0.01, data.elapsed))} pgs/s`
          }))
          addLog(`✓ [${data.index}/${data.total_files}] ${data.file_name}: ${data.records} trademarks in ${data.elapsed}s`, 'success')
        } else if (data.type === 'complete' || data.step === 'all_complete') {
          setCurrentStep(4)
          setStatus('completed')
          setCurrentAction('All operations finished successfully!')
          addLog(`🎉 ${data.message || 'Scraping and extraction completed!'}`, 'success')
          es.close()
          if (onComplete) onComplete(data)
        } else if (data.type === 'error') {
          setStatus('error')
          setCurrentAction('Encountered an error')
          addLog(`❌ Error: ${data.message}`, 'error')
          es.close()
        }
      } catch (err) {
        console.error('SSE JSON error:', err)
      }
    }

    es.onerror = () => {
      // If error occurs while still running
      if (status === 'running') {
        setStatus('error')
        addLog('❌ Lost connection to backend stream', 'error')
      }
      es.close()
    }
  }

  if (!isOpen) return null

  const steps = [
    { num: 1, label: 'Portal Sync' },
    { num: 2, label: 'Fast PDF Download' },
    { num: 3, label: 'PyMuPDF Extract' },
    { num: 4, label: 'Ready' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600/30 border border-primary-500/40 flex items-center justify-center text-primary-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {mode === 'download' ? 'Download Journal PDFs' : mode === 'extract' ? 'Fast Extract Trademarks' : 'High-Speed Scraper Pipeline'}
              </h3>
              <p className="text-xs text-slate-300">Parallel Downloading + Ultra-Fast PyMuPDF Engine</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pipeline Stepper */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/80">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((s) => {
              const isDone = currentStep > s.num || status === 'completed'
              const isCurrent = currentStep === s.num && status === 'running'
              return (
                <div key={s.num} className="flex flex-col items-center text-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    isDone 
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30' 
                      : isCurrent 
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100 animate-pulse' 
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                  </div>
                  <span className={`text-[11px] font-semibold mt-1.5 ${
                    isDone ? 'text-emerald-700' : isCurrent ? 'text-primary-700' : 'text-slate-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Live Status & Speed Stats */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Main Action Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            status === 'completed'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : status === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-primary-50/70 border-primary-200/80 text-primary-950'
          }`}>
            <div className="flex items-center space-x-3">
              {status === 'running' && <Loader2 className="h-5 w-5 text-primary-600 animate-spin flex-shrink-0" />}
              {status === 'completed' && <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />}
              {status === 'error' && <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {status === 'running' ? 'Current Action' : status === 'completed' ? 'Status' : 'Error'}
                </p>
                <p className="text-sm font-bold mt-0.5">{currentAction}</p>
              </div>
            </div>

            {progressDetails.speed && status === 'running' && (
              <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 bg-white/80 rounded-xl border border-primary-200/50 shadow-subtle text-xs font-bold text-primary-700">
                <Gauge className="h-3.5 w-3.5" />
                <span>{progressDetails.speed}</span>
              </div>
            )}
          </div>

          {/* Quick Stat Tiles */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] font-medium text-slate-500">PDFs Downloaded</span>
              <p className="text-base font-bold text-slate-800 mt-0.5">
                {progressDetails.downloadedPdfs} {progressDetails.totalPdfs > 0 ? `/ ${progressDetails.totalPdfs}` : ''}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] font-medium text-slate-500">Trademarks Found</span>
              <p className="text-base font-bold text-primary-600 mt-0.5">
                {progressDetails.extractedRecords.toLocaleString()}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] font-medium text-slate-500">Active File</span>
              <p className="text-xs font-semibold text-slate-700 mt-1 truncate" title={progressDetails.latestFile || '—'}>
                {progressDetails.latestFile || '—'}
              </p>
            </div>
          </div>

          {/* Micro Terminal Log */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
                <Terminal className="h-3.5 w-3.5 text-slate-400" />
                <span>Live Activity Stream</span>
              </div>
              <span className="text-[10px] text-slate-400">Auto-updating</span>
            </div>
            
            <div className="bg-slate-950 rounded-xl p-3 font-mono text-xs text-slate-200 h-40 overflow-y-auto space-y-1 border border-slate-800 shadow-inner">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Waiting for scraper events...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="leading-relaxed flex items-start space-x-2">
                    <span className="text-slate-500 select-none">[{log.time}]</span>
                    <span className={
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'error' ? 'text-rose-400' : 'text-slate-200'
                    }>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span className="text-xs text-slate-500">
            {status === 'running' ? '⚡ Running in background worker...' : status === 'completed' ? '✨ Scraper pipeline complete' : 'Ready'}
          </span>
          <div className="flex space-x-3">
            {status === 'error' && (
              <button onClick={startScraper} className="btn-secondary text-xs">
                Retry
              </button>
            )}
            <button 
              onClick={onClose}
              className={status === 'completed' ? 'btn-primary' : 'btn-secondary'}
            >
              {status === 'completed' ? 'Done & View Dashboard' : 'Close Window'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
