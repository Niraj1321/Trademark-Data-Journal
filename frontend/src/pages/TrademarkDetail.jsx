import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getTrademark } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { ArrowLeft, Calendar, Building, User, FileText, MapPin } from 'lucide-react'
import { format } from 'date-fns'

export default function TrademarkDetail() {
  const { id } = useParams()
  
  const { data: trademark, isLoading, error } = useQuery({
    queryKey: ['trademark', id],
    queryFn: () => getTrademark(id)
  })
  
  if (isLoading) return <LoadingSpinner size="lg" />
  if (error) return <ErrorMessage message={error.message} />
  
  const tm = trademark
  
  return (
    <div className="space-y-6">
      <Link to="/trademarks" className="inline-flex items-center text-primary-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Trademarks
      </Link>
      
      {/* Header */}
      <div className="card bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
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
                <span className="badge bg-slate-700 text-slate-200 border-slate-600 text-xs font-semibold">{tm.applicant_type}</span>
              )}
            </div>
          </div>

          {/* Publication Tag Box */}
          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 text-right">
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
      
      {/* Application Details */}
      <div className="card">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2 border-b border-slate-100 pb-3">
          <FileText className="h-4 w-4 text-primary-600" />
          <span>Application & Registration Metadata</span>
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tm.application_number && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Application Number</p>
              <p className="text-sm font-extrabold text-slate-900 mt-1">{tm.application_number}</p>
            </div>
          )}
          
          {tm.filing_date && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Filing Date</p>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {format(new Date(tm.filing_date), 'dd MMMM yyyy')}
              </p>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Publication Date</p>
            <p className="text-sm font-bold text-primary-700 mt-1">
              {tm.publication_date ? format(new Date(tm.publication_date), 'dd MMMM yyyy') : 'N/A'}
            </p>
          </div>
          
          {tm.used_since && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Used Since</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{tm.used_since}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Applicant Information */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>Applicant Information</span>
        </h2>
        
        <div className="space-y-4">
          {tm.applicant_name && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Name</p>
              <p className="text-base font-medium text-gray-900">{tm.applicant_name}</p>
            </div>
          )}
          
          {tm.applicant_address && (
            <div>
              <p className="text-sm text-gray-500 mb-1 flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>Address</span>
              </p>
              <p className="text-base text-gray-900">{tm.applicant_address}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Attorney Information */}
      {(tm.attorney_name || tm.attorney_address) && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Attorney / Agent Information</span>
          </h2>
          
          <div className="space-y-4">
            {tm.attorney_name && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Name</p>
                <p className="text-base font-medium text-gray-900">{tm.attorney_name}</p>
              </div>
            )}
            
            {tm.attorney_address && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Address</p>
                <p className="text-base text-gray-900">{tm.attorney_address}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Goods and Services */}
      {tm.goods_services && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Goods and Services Description
          </h2>
          <p className="text-base text-gray-700 leading-relaxed">
            {tm.goods_services}
          </p>
        </div>
      )}
      
      {/* Raw Data (for debugging) */}
      {tm.raw_text && (
        <details className="card">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
            View Raw Extracted Text
          </summary>
          <pre className="mt-4 p-4 bg-gray-50 rounded text-xs overflow-x-auto whitespace-pre-wrap">
            {tm.raw_text}
          </pre>
        </details>
      )}
    </div>
  )
}
