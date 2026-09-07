import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { 
  Zap, Play, Download, FileText, Stamp, Database, 
  Calendar, Clock, ShieldCheck, Trash2, ArrowUpRight, 
  Layers, CheckCircle, RefreshCw, Sparkles, Building2,
  BarChart2, MapPin, PieChart, Users
} from 'lucide-react'

import { getStatistics, cleanupAllData } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import ProgressTracker from '../components/ProgressTracker'
import ClassDistributionChart from '../components/ClassDistributionChart'

export default function Dashboard() {
  const [trackerMode, setTrackerMode] = useState(null) // 'full' | 'download' | 'extract' | null
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [classViewFilter, setClassViewFilter] = useState('top10') // 'top10' | 'all'

  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['statistics'],
    queryFn: getStatistics,
    refetchInterval: 30000,
  })

  const handleCleanup = async () => {
    if (!showCleanupConfirm) {
      setShowCleanupConfirm(true)
      return
    }

    try {
      setIsCleaning(true)
      const result = await cleanupAllData()
      alert(`✅ Cleanup successful!\n\nDeleted:\n- ${result.deleted.journals} journals\n- ${result.deleted.pdfs} PDF records\n- ${result.deleted.trademarks} trademarks\n- ${result.deleted.files} PDF files`)
      setShowCleanupConfirm(false)
      refetch()
    } catch (err) {
      alert('Error during cleanup: ' + err.message)
      setShowCleanupConfirm(false)
    } finally {
      setIsCleaning(false)
    }
  }

  if (isLoading) return <LoadingSpinner size="lg" />
  if (error) return <ErrorMessage message={error.message} />

  const summary = stats?.summary || {}
  const latestJournal = stats?.latest_journal || {}
  const recentTrademarks = stats?.recent_trademarks || []
  const classDistribution = stats?.class_distribution || []
  const officeDistribution = stats?.office_distribution || []
  const topApplicants = stats?.top_applicants || []

  // Class analytics math
  const sortedClasses = [...classDistribution].sort((a, b) => b.count - a.count)
  const displayedClasses = classViewFilter === 'top10' ? sortedClasses.slice(0, 10) : sortedClasses
  const maxClassCount = Math.max(...classDistribution.map(c => c.count), 1)
  const totalTrademarksCount = summary.total_trademarks || 1

  return (
    <motion.div 
      className="space-y-8"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Top Compact Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-md border border-slate-800/80">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Trademark Journal Control Center
              </h1>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-bold">
                <Sparkles className="h-3 w-3" />
                <span>PyMuPDF Engine Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-xl">
              Extract official trademark filings from IP India gazettes with concurrent parallel downloads and fast PDF parsing.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
            <button
              onClick={() => setTrackerMode('full')}
              className="btn-primary shadow-glow !py-2 !px-4 text-xs flex items-center space-x-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Start Fast Scrape</span>
            </button>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-secondary !py-2 !px-3 text-xs !bg-slate-800/90 !text-slate-200 !border-slate-700 hover:!bg-slate-700 hover:!text-white flex items-center space-x-1.5"
              title="Refresh Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleCleanup}
              disabled={isCleaning}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                showCleanupConfirm 
                  ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-md' 
                  : 'bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-rose-900/40 hover:text-rose-300'
              }`}
              onMouseLeave={() => setTimeout(() => setShowCleanupConfirm(false), 4000)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{showCleanupConfirm ? 'Confirm Reset' : 'Reset DB'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Trademarks */}
        <div className="card card-hover flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Trademarks</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {(summary.total_trademarks || 0).toLocaleString()}
            </h3>
            <div className="flex items-center space-x-1.5 mt-2 text-xs font-medium text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Fully Indexed in Database</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 shadow-sm">
            <Stamp className="h-6 w-6" />
          </div>
        </div>

        {/* Journals Scraped */}
        <div className="card card-hover flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Journals Processed</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {summary.total_journals || 0}
            </h3>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              Target: Latest 1 Active Journal
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        {/* PDF Files Downloaded */}
        <div className="card card-hover flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">PDF Parts Ready</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {summary.total_pdfs || 0}
            </h3>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              {summary.pending_pdfs > 0 ? (
                <span className="text-amber-600 font-semibold">{summary.pending_pdfs} pending extract</span>
              ) : (
                <span className="text-emerald-600 font-semibold">100% Extracted</span>
              )}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-sm">
            <Download className="h-6 w-6" />
          </div>
        </div>

        {/* Scraper Status */}
        <div className="card card-hover flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scraper Engine</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-lg font-bold text-slate-900">Ultra Fast</h3>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-mono">
              PyMuPDF • Parallel HTTP
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
            <Layers className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Two Column Section: Latest Journal Highlight & Direct Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Journal Overview */}
        <div className="lg:col-span-2 card space-y-5">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary-50 text-primary-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Latest Active Journal</h3>
                <p className="text-xs text-slate-500">Official Trademark Publication Status</p>
              </div>
            </div>

            {latestJournal.id && (
              <Link 
                to={`/journals/${latestJournal.id}`}
                className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center space-x-1"
              >
                <span>View Full Journal</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {latestJournal.id ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Journal Number</span>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                    #{latestJournal.journal_number}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Publication Date</span>
                  <p className="text-sm font-bold text-primary-700 mt-1">
                    {latestJournal.publication_date ? format(new Date(latestJournal.publication_date), 'dd MMM yyyy') : 'N/A'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">PDF Files</span>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {latestJournal.pdf_count || 0} Parts
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Trademarks</span>
                  <p className="text-lg font-extrabold text-emerald-600 mt-0.5">
                    {(latestJournal.total_trademarks || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-primary-50/50 rounded-2xl border border-primary-100 text-xs">
                <div className="flex items-center space-x-2 text-primary-950 font-medium">
                  <Clock className="h-4 w-4 text-primary-600" />
                  <span>Public availability date:</span>
                  <span className="font-bold">
                    {latestJournal.availability_date ? format(new Date(latestJournal.availability_date), 'dd MMM yyyy') : 'Same Day'}
                  </span>
                </div>
                <span className="badge badge-success">Active & Synced</span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <FileText className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">No Journal Scraped Yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Click "Start Fast Scrape" above to automatically fetch the latest Journal, download all PDF parts, and index trademarks.
              </p>
            </div>
          )}
        </div>

        {/* Granular Pipeline Triggers */}
        <div className="card space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Scraper Sub-Tasks</h3>
            <p className="text-xs text-slate-500 mb-4">Run individual steps independently if needed.</p>

            <div className="space-y-2.5">
              <button
                onClick={() => setTrackerMode('download')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-primary-700">Download PDFs Only</p>
                    <p className="text-[11px] text-slate-500">Concurrently fetch all journal PDFs</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-primary-600" />
              </button>

              <button
                onClick={() => setTrackerMode('extract')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-primary-700">Fast Extract Only</p>
                    <p className="text-[11px] text-slate-500">Parse pending PDFs using PyMuPDF</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-primary-600" />
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-800 font-medium">
            💡 <strong>Fast Extraction:</strong> Processes over 500 pages per second directly into MySQL.
          </div>
        </div>
      </div>

      {/* Class Distribution & Office Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Distribution Chart Card */}
        <div className="lg:col-span-2 card">
          <ClassDistributionChart 
            classDistribution={classDistribution} 
            totalTrademarks={summary.total_trademarks} 
          />
        </div>

        {/* Office Location Analytics */}
        <div className="card space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Registry Jurisdiction</h3>
                <p className="text-xs text-slate-500">Applications by regional office</p>
              </div>
            </div>

            <div className="space-y-3">
              {officeDistribution.map((office) => {
                const percentage = Math.round((office.count / totalTrademarksCount) * 100)
                return (
                  <Link
                    key={office.office}
                    to={`/trademarks?office_location=${office.office}`}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-800 group-hover:bg-primary-600 group-hover:text-white group-hover:border-primary-600 transition-colors">
                        {office.office.substring(0, 3)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 group-hover:text-primary-700">{office.office} Office</p>
                        <p className="text-[11px] text-slate-500">{office.count.toLocaleString()} filings</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="badge badge-warning text-xs font-extrabold">{percentage}%</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Scraped Trademarks Preview */}
      <div className="card space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Stamp className="h-5 w-5 text-primary-600" />
            <h3 className="text-base font-bold text-slate-900">Recent Scraped Trademarks</h3>
          </div>
          <Link 
            to="/trademarks"
            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center space-x-1"
          >
            <span>Browse All Trademarks</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentTrademarks && recentTrademarks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentTrademarks.map((tm) => (
              <div 
                key={tm.id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-primary-300 hover:bg-white transition-all duration-200 shadow-subtle flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-slate-900 truncate" title={tm.trademark_name}>
                      {tm.trademark_name || 'Unnamed Trademark'}
                    </span>
                    {tm.class_number && (
                      <span className="badge badge-info whitespace-nowrap">Class {tm.class_number}</span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 mb-3">
                    <p className="truncate">
                      <span className="font-semibold text-slate-700">App No:</span> {tm.application_number}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold text-slate-700">Applicant:</span> {tm.applicant_name}
                    </p>
                    {tm.publication_date && (
                      <p className="text-primary-700 font-semibold flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>Published: {format(new Date(tm.publication_date), 'dd MMM yyyy')}</span>
                      </p>
                    )}
                  </div>
                </div>

                <Link
                  to={`/trademarks/${tm.id}`}
                  className="mt-2 text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center justify-end space-x-1"
                >
                  <span>Details</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            No recent trademarks available. Run the scraper to populate the database.
          </div>
        )}
      </div>

      {/* Live Scraper Tracker Modal */}
      <ProgressTracker
        isOpen={!!trackerMode}
        mode={trackerMode || 'full'}
        onClose={() => {
          setTrackerMode(null)
          refetch()
        }}
        onComplete={() => {
          refetch()
        }}
      />
    </motion.div>
  )
}
