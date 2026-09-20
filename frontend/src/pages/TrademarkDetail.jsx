import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getTrademark } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { 
  ArrowLeft, Calendar, Building, User, FileText, MapPin, 
  Image as ImageIcon, Download, Maximize2, X, Sparkles, Tag
} from 'lucide-react'
import { format } from 'date-fns'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function TrademarkDetail() {
  const { id } = useParams()
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  
  const { data: trademark, isLoading, error } = useQuery({
    queryKey: ['trademark', id],
    queryFn: () => getTrademark(id)
  })
  
  if (isLoading) return <LoadingSpinner size="lg" />
  if (error) return <ErrorMessage message={error.message} />
  
  const tm = trademark
  const fullImageUrl = tm.image_url 
    ? (tm.image_url.startsWith('http') ? tm.image_url : `${API_BASE_URL}${tm.image_url}`)
    : null

  return (
    <div className="space-y-6">
      <Link to="/trademarks" className="inline-flex items-center text-primary-600 hover:text-primary-700 font-semibold text-sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Trademarks
      </Link>
      
      {/* Header */}
      <div className="card bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border-0 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-primary-600/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary-500/20 text-primary-300 border border-primary-400/30">
                {fullImageUrl ? 'Device / Logo Mark' : 'Word Mark'}
              </span>
              {tm.page_number && (
                <span className="text-slate-400 text-xs font-medium">Page #{tm.page_number}</span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
              {tm.trademark_name || 'Trademark Application'}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {tm.class_number && (
                <span className="badge badge-info text-xs font-bold">Class {tm.class_number}</span>
              )}
              {tm.office_location && (
                <span className="badge badge-warning text-xs font-bold">{tm.office_location}</span>
              )}
              {tm.applicant_type && (
                <span className="badge bg-slate-700/80 text-slate-200 border-slate-600 text-xs font-semibold">{tm.applicant_type}</span>
              )}
            </div>
          </div>

          {/* Publication Tag Box */}
          <div className="p-3.5 bg-slate-800/90 backdrop-blur-sm rounded-2xl border border-slate-700 text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Official Publication</span>
            <span className="text-sm font-bold text-primary-400">
              {tm.publication_date ? format(new Date(tm.publication_date), 'dd MMMM yyyy') : 'Official Gazette'}
            </span>
            {tm.journal_number && (
              <span className="text-xs text-slate-400 block mt-0.5 font-medium">Journal #{tm.journal_number}</span>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Trademark Logo Showcase & Main Application Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trademark Logo / Visual Representation */}
        <div className="card lg:col-span-1 flex flex-col justify-between border border-slate-200 bg-white shadow-card">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center space-x-2 border-b border-slate-100 pb-2.5">
              <ImageIcon className="h-4 w-4 text-primary-600" />
              <span>Trademark Representation</span>
            </h2>

            {fullImageUrl ? (
              <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50/50 p-4 flex flex-col items-center justify-center min-h-[220px]">
                <img 
                  src={fullImageUrl} 
                  alt={tm.trademark_name || 'Trademark Logo'} 
                  className="max-h-48 max-w-full object-contain rounded transition-transform duration-200 group-hover:scale-105 cursor-pointer shadow-sm"
                  onClick={() => setIsImageModalOpen(true)}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div style={{ display: 'none' }} className="flex-col items-center justify-center p-6 text-center text-slate-400">
                  <ImageIcon className="h-10 w-10 mb-2 stroke-1" />
                  <span className="text-xs font-medium">Image preview not available</span>
                </div>

                <button
                  onClick={() => setIsImageModalOpen(true)}
                  className="absolute bottom-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-slate-900"
                  title="View Full Resolution"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 flex flex-col items-center justify-center min-h-[220px] text-center">
                <Tag className="h-10 w-10 text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-700">Word Mark Application</span>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  This trademark is registered as a text mark without a separate graphical device logo.
                </p>
                <div className="mt-3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-subtle">
                  "{tm.trademark_name}"
                </div>
              </div>
            )}
          </div>

          {fullImageUrl && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Extracted from Journal PDF</span>
              <a
                href={fullImageUrl}
                download={`${tm.application_number || 'trademark'}_logo.jpg`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary !py-1.5 !px-3 !text-xs inline-flex items-center space-x-1.5 font-bold !text-primary-700 !bg-primary-50 !border-primary-200 hover:!bg-primary-100"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Logo</span>
              </a>
            </div>
          )}
        </div>

        {/* Application Details */}
        <div className="card lg:col-span-2 border border-slate-200 bg-white shadow-card">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center space-x-2 border-b border-slate-100 pb-2.5">
            <FileText className="h-4 w-4 text-primary-600" />
            <span>Application & Registration Metadata</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tm.application_number && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Application Number</p>
                <p className="text-base font-extrabold text-slate-900 mt-1 font-mono">{tm.application_number}</p>
              </div>
            )}
            
            {tm.filing_date && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filing Date</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {format(new Date(tm.filing_date), 'dd MMMM yyyy')}
                </p>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Publication Date</p>
              <p className="text-sm font-bold text-primary-700 mt-1">
                {tm.publication_date ? format(new Date(tm.publication_date), 'dd MMMM yyyy') : 'Official Gazette'}
              </p>
            </div>
            
            {tm.used_since && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Used Since</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{tm.used_since}</p>
              </div>
            )}

            {tm.class_range && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Journal Part / Class Range</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{tm.class_range}</p>
              </div>
            )}

            {tm.office_location && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jurisdiction Office</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{tm.office_location}</p>
              </div>
            )}
          </div>
        </div>
      </div>
        
      {/* Applicant Information */}
      <div className="card">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2 border-b border-slate-100 pb-3">
          <User className="h-4 w-4 text-primary-600" />
          <span>Applicant & Entity Information</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tm.applicant_name && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Applicant Name</p>
              <p className="text-sm font-bold text-slate-900">{tm.applicant_name}</p>
            </div>
          )}

          {tm.applicant_type && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Entity Type</p>
              <p className="text-sm font-bold text-slate-900">{tm.applicant_type}</p>
            </div>
          )}
          
          {tm.applicant_address && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 md:col-span-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span>Registered Address</span>
              </p>
              <p className="text-sm text-slate-800 leading-relaxed">{tm.applicant_address}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Attorney Information */}
      {(tm.attorney_name || tm.attorney_address) && (
        <div className="card">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Building className="h-4 w-4 text-primary-600" />
            <span>Attorney / Legal Representative</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tm.attorney_name && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Attorney / Agency</p>
                <p className="text-sm font-bold text-slate-900">{tm.attorney_name}</p>
              </div>
            )}
            
            {tm.attorney_address && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 md:col-span-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Service Address</p>
                <p className="text-sm text-slate-800 leading-relaxed">{tm.attorney_address}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Goods and Services */}
      {tm.goods_services && (
        <div className="card">
          <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center space-x-2 border-b border-slate-100 pb-3">
            <FileText className="h-4 w-4 text-primary-600" />
            <span>Specification of Goods & Services</span>
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            {tm.goods_services}
          </p>
        </div>
      )}
      
      {/* Raw Data (for inspection) */}
      {tm.raw_text && (
        <details className="card !p-4 bg-slate-50 border border-slate-200">
          <summary className="text-xs font-bold text-slate-700 cursor-pointer hover:text-slate-900 uppercase tracking-wider">
            View Raw OCR / Journal Extracted Text
          </summary>
          <pre className="mt-3 p-3 bg-white rounded-lg border border-slate-200 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-slate-700">
            {tm.raw_text}
          </pre>
        </details>
      )}

      {/* Fullscreen Image Preview Modal */}
      {isImageModalOpen && fullImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-4 pr-8">
              <h3 className="text-lg font-extrabold text-slate-900">{tm.trademark_name || 'Trademark Logo'}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">App #{tm.application_number} • Class {tm.class_number}</p>
            </div>

            <div className="max-h-[65vh] overflow-auto flex items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <img 
                src={fullImageUrl} 
                alt={tm.trademark_name || 'Trademark Full View'} 
                className="max-h-[60vh] max-w-full object-contain drop-shadow-md"
              />
            </div>

            <div className="mt-4 flex items-center space-x-3">
              <a
                href={fullImageUrl}
                download={`${tm.application_number || 'trademark'}_logo.jpg`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary !text-xs !py-2 !px-4 inline-flex items-center space-x-2 shadow-md"
              >
                <Download className="h-4 w-4" />
                <span>Download High-Res Logo</span>
              </a>
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="btn-secondary !text-xs !py-2 !px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
