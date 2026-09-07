export default function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  limit,
  onLimitChange,
  limitOptions = [10, 50, 100, 200],
  totalRecords
}) {
  const pages = []
  const maxPagesToShow = 5
  
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)
  
  if (endPage - startPage < maxPagesToShow - 1) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1)
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }
  
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-200 text-xs">
      {/* Records Count & Limit Selector */}
      <div className="flex items-center space-x-3 text-slate-600 font-medium">
        {totalRecords !== undefined && (
          <span>Total Records: <strong className="text-slate-900">{totalRecords.toLocaleString()}</strong></span>
        )}
        
        {onLimitChange && (
          <div className="flex items-center space-x-2">
            <span>Show:</span>
            <select
              value={limit || 50}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="bg-white border border-slate-300 text-slate-900 rounded-lg text-xs font-bold py-1 px-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs cursor-pointer"
            >
              {limitOptions.map(option => (
                <option key={option} value={option}>{option} / page</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Buttons */}
      <div className="flex items-center space-x-1.5 font-medium">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-xs"
        >
          Previous
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              1
            </button>
            {startPage > 2 && <span className="px-1 text-slate-400">...</span>}
          </>
        )}
        
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1.5 rounded-lg border transition-all shadow-xs ${
              page === currentPage
                ? 'bg-primary-600 text-white border-primary-600 font-bold'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {page}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-1 text-slate-400">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-xs"
        >
          Next
        </button>
      </div>
    </div>
  )
}
