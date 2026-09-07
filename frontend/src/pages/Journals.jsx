import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getJournals, deleteJournal } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import Pagination from '../components/Pagination'
import ExportButton from '../components/ExportButton'
import { format } from 'date-fns'
import { Eye, Trash2, BookOpen, Calendar, ArrowUpRight } from 'lucide-react'

export default function Journals() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const queryClient = useQueryClient()
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['journals', page, status],
    queryFn: () => getJournals({ page, limit: 20, status: status || undefined })
  })
  
  const deleteMutation = useMutation({
    mutationFn: deleteJournal,
    onSuccess: () => {
      queryClient.invalidateQueries(['journals'])
      queryClient.invalidateQueries(['statistics'])
    }
  })
  
  const handleDelete = (journal) => {
    if (window.confirm(
      `Delete Journal #${journal.journal_number}?\n\n` +
      `This will permanently remove:\n` +
      `- ${journal.pdf_count} downloaded PDF parts\n` +
      `- ${journal.total_trademarks || 0} indexed trademarks\n` +
      `- Journal database records`
    )) {
      deleteMutation.mutate(journal.id)
    }
  }
  
  if (isLoading) return <LoadingSpinner size="lg" />
  if (error) return <ErrorMessage message={error.message} />
  
  const journals = data?.journals || []
  const totalPages = data?.pages || 1
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Trademark Journals
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Archived and extracted gazette publications from IP India.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <ExportButton 
            type="by-journal" 
            journalIds={journals.map(j => j.id)}
          />
        </div>
      </div>
      
      {/* Filters */}
      <div className="card !p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 text-xs">
          <label className="font-bold text-slate-700">Filter Status:</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="input-field !py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING">Pending</option>
            <option value="ERROR">Error</option>
          </select>
        </div>
        <span className="text-xs text-slate-500 font-semibold">
          Total: {data?.total || 0} Journals
        </span>
      </div>
      
      {/* Journals Table */}
      <div className="card !p-0 overflow-hidden border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Journal Number
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Publication Date
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  PDF Parts
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Trademarks
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {journals.map((journal) => (
                <tr 
                  key={journal.id} 
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4 text-primary-600" />
                      <span className="text-sm font-extrabold text-slate-900">
                        #{journal.journal_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-700">
                    {journal.publication_date ? format(new Date(journal.publication_date), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-800">
                    {journal.pdf_count} Parts
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-extrabold text-emerald-600">
                    {(journal.total_trademarks || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={
                      journal.status === 'COMPLETED' ? 'badge badge-success' :
                      journal.status === 'PROCESSING' ? 'badge badge-warning' :
                      journal.status === 'ERROR' ? 'badge badge-error' : 'badge badge-info'
                    }>
                      {journal.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                    <div className="flex items-center justify-end space-x-2">
                      <Link
                        to={`/journals/${journal.id}`}
                        className="btn-secondary !py-1.5 !px-3 !text-xs flex items-center space-x-1"
                      >
                        <span>View</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(journal)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete journal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {journals.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-xs text-slate-500 font-medium">No journals recorded in the database.</p>
        </div>
      )}
      
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
