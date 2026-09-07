import { Download, FileSpreadsheet, FileStack, File } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

export default function ExportButton({ type, filters, journalId, journalIds }) {
  const [isExporting, setIsExporting] = useState(false)

  const getExportUrl = () => {
    const baseUrl = 'http://localhost:8000/api'
    
    switch (type) {
      case 'all':
        // Export all trademarks with filters
        const params = new URLSearchParams()
        if (filters?.journal_number) params.append('journal_number', filters.journal_number)
        if (filters?.class_number) params.append('class_number', filters.class_number)
        if (filters?.application_number) params.append('application_number', filters.application_number)
        if (filters?.office_location) params.append('office_location', filters.office_location)
        if (filters?.search) params.append('search', filters.search)
        return `${baseUrl}/export/all?${params.toString()}`
      
      case 'by-journal':
        // Export with one sheet per journal
        if (journalIds && journalIds.length > 0) {
          return `${baseUrl}/export/by-journal?journal_ids=${journalIds.join(',')}`
        }
        return `${baseUrl}/export/by-journal`
      
      case 'by-pdf':
        // Export specific journal with one sheet per PDF
        return `${baseUrl}/export/journal/${journalId}/by-pdf`
      
      default:
        return null
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const url = getExportUrl()
      if (!url) {
        alert('Invalid export type')
        return
      }

      // Download file
      const link = document.createElement('a')
      link.href = url
      link.download = '' // Let backend set filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Show success message
      setTimeout(() => {
        alert('✅ Excel file downloaded successfully!')
      }, 500)
      
    } catch (error) {
      console.error('Export error:', error)
      alert('❌ Export failed. Please try again.')
    } finally {
      setTimeout(() => setIsExporting(false), 2000)
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'all':
        return <FileSpreadsheet className="h-4 w-4" />
      case 'by-journal':
        return <FileStack className="h-4 w-4" />
      case 'by-pdf':
        return <File className="h-4 w-4" />
      default:
        return <Download className="h-4 w-4" />
    }
  }

  const getLabel = () => {
    switch (type) {
      case 'all':
        return 'Export All'
      case 'by-journal':
        return 'Export by Journal'
      case 'by-pdf':
        return 'Export by PDF'
      default:
        return 'Export'
    }
  }

  return (
    <motion.button
      onClick={handleExport}
      disabled={isExporting}
      className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {getIcon()}
      <span>{isExporting ? 'Exporting...' : getLabel()}</span>
      {isExporting && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Download className="h-4 w-4" />
        </motion.div>
      )}
    </motion.button>
  )
}
