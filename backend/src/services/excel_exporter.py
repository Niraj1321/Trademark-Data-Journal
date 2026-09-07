"""
Excel export service for trademark data
"""
from io import BytesIO
from datetime import datetime
from typing import List, Optional
import pandas as pd
from sqlalchemy.orm import Session

from ..models.models import Journal, TrademarkApplication, PDFFile


class ExcelExporter:
    """
    Export trademark data to Excel with multiple sheets
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def export_by_journal(self, journal_ids: Optional[List[int]] = None) -> BytesIO:
        """
        Export trademarks grouped by journal, one sheet per journal
        
        Args:
            journal_ids: Optional list of journal IDs to export. If None, exports all.
        
        Returns:
            BytesIO object containing the Excel file
        """
        # Query journals
        query = self.db.query(Journal).order_by(Journal.publication_date.desc())
        if journal_ids:
            query = query.filter(Journal.id.in_(journal_ids))
        
        journals = query.all()
        
        # Create Excel writer
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Summary sheet
            self._create_summary_sheet(writer, journals)
            
            # One sheet per journal
            for journal in journals:
                self._create_journal_sheet(writer, journal)
        
        output.seek(0)
        return output
    
    def export_all_trademarks(self, filters: dict = None) -> BytesIO:
        """
        Export all trademarks to a single Excel sheet with filters
        
        Args:
            filters: Optional dict with filter criteria
        
        Returns:
            BytesIO object containing the Excel file
        """
        query = self.db.query(TrademarkApplication)
        
        # Apply filters
        if filters:
            if filters.get('journal_number'):
                query = query.join(Journal).filter(
                    Journal.journal_number == filters['journal_number']
                )
            if filters.get('class_number'):
                query = query.filter(
                    TrademarkApplication.class_number == filters['class_number']
                )
            if filters.get('application_number'):
                query = query.filter(
                    TrademarkApplication.application_number.like(f"%{filters['application_number']}%")
                )
            if filters.get('office_location'):
                query = query.filter(
                    TrademarkApplication.office_location == filters['office_location']
                )
            if filters.get('search'):
                search_term = f"%{filters['search']}%"
                query = query.filter(
                    (TrademarkApplication.trademark_name.like(search_term)) |
                    (TrademarkApplication.applicant_name.like(search_term))
                )
        
        trademarks = query.order_by(TrademarkApplication.filing_date.desc()).all()
        
        # Create DataFrame
        df = self._trademarks_to_dataframe(trademarks)
        
        # Export to Excel
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Trademarks', index=False)
            
            # Auto-adjust column widths
            worksheet = writer.sheets['Trademarks']
            self._adjust_column_widths(worksheet, df)
        
        output.seek(0)
        return output
    
    def export_by_pdf(self, journal_id: int) -> BytesIO:
        """
        Export trademarks grouped by PDF file (one sheet per PDF)
        
        Args:
            journal_id: Journal ID to export
        
        Returns:
            BytesIO object containing the Excel file
        """
        journal = self.db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise ValueError(f"Journal {journal_id} not found")
        
        pdf_files = self.db.query(PDFFile).filter(
            PDFFile.journal_id == journal_id
        ).all()
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Summary sheet for this journal
            summary_data = {
                'Journal Number': [journal.journal_number],
                'Publication Date': [journal.publication_date.strftime('%Y-%m-%d')],
                'Total PDFs': [journal.pdf_count],
                'Total Trademarks': [journal.total_trademarks],
                'Status': [journal.status.value]
            }
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            # One sheet per PDF
            for pdf_file in pdf_files:
                self._create_pdf_sheet(writer, pdf_file)
        
        output.seek(0)
        return output
    
    def _create_summary_sheet(self, writer, journals: List[Journal]):
        """Create summary sheet with journal statistics"""
        summary_data = []
        
        for journal in journals:
            summary_data.append({
                'Journal Number': journal.journal_number,
                'Publication Date': journal.publication_date.strftime('%Y-%m-%d'),
                'PDF Count': journal.pdf_count,
                'Total Trademarks': journal.total_trademarks,
                'Status': journal.status.value,
                'Scrape Date': journal.scrape_date.strftime('%Y-%m-%d %H:%M') if journal.scrape_date else ''
            })
        
        df = pd.DataFrame(summary_data)
        df.to_excel(writer, sheet_name='Summary', index=False)
        
        # Auto-adjust columns
        worksheet = writer.sheets['Summary']
        self._adjust_column_widths(worksheet, df)
    
    def _create_journal_sheet(self, writer, journal: Journal):
        """Create sheet for a specific journal"""
        trademarks = self.db.query(TrademarkApplication).filter(
            TrademarkApplication.journal_id == journal.id
        ).all()
        
        if not trademarks:
            return
        
        df = self._trademarks_to_dataframe(trademarks)
        
        # Clean sheet name (Excel max 31 chars, no special chars)
        sheet_name = f"J_{journal.journal_number}"[:31]
        df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        # Auto-adjust columns
        worksheet = writer.sheets[sheet_name]
        self._adjust_column_widths(worksheet, df)
    
    def _create_pdf_sheet(self, writer, pdf_file: PDFFile):
        """Create sheet for a specific PDF file"""
        trademarks = self.db.query(TrademarkApplication).filter(
            TrademarkApplication.pdf_file_id == pdf_file.id
        ).all()
        
        if not trademarks:
            return
        
        df = self._trademarks_to_dataframe(trademarks)
        
        # Clean sheet name (use class range or file name)
        sheet_name = pdf_file.class_range or pdf_file.file_name[:25]
        sheet_name = sheet_name.replace('/', '-').replace('\\', '-')[:31]
        
        df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        # Auto-adjust columns
        worksheet = writer.sheets[sheet_name]
        self._adjust_column_widths(worksheet, df)
    
    def _clean_text(self, text: Optional[str]) -> str:
        """Remove illegal characters for Excel (control chars except \t, \n, \r)"""
        if not text:
            return ''
        # Remove control characters except tab, newline, carriage return
        import re
        return re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]', '', str(text))
    
    def _trademarks_to_dataframe(self, trademarks: List[TrademarkApplication]) -> pd.DataFrame:
        """Convert trademark list to pandas DataFrame"""
        data = []
        
        for tm in trademarks:
            data.append({
                'Application Number': self._clean_text(tm.application_number),
                'Filing Date': tm.filing_date.strftime('%Y-%m-%d') if tm.filing_date else '',
                'Trademark Name': self._clean_text(tm.trademark_name),
                'Applicant Name': self._clean_text(tm.applicant_name),
                'Applicant Address': self._clean_text(tm.applicant_address),
                'Applicant Type': self._clean_text(tm.applicant_type),
                'Class Number': self._clean_text(tm.class_number),
                'Goods/Services': self._clean_text(tm.goods_services),
                'Attorney Name': self._clean_text(tm.attorney_name),
                'Attorney Address': self._clean_text(tm.attorney_address),
                'Used Since': self._clean_text(tm.used_since),
                'Associated With': self._clean_text(tm.associated_with),
                'Office Location': self._clean_text(tm.office_location),
                'Page Number': tm.page_number
            })
        
        return pd.DataFrame(data)
    
    def _adjust_column_widths(self, worksheet, dataframe: pd.DataFrame):
        """Auto-adjust column widths based on content"""
        for idx, col in enumerate(dataframe.columns):
            max_length = max(
                dataframe[col].astype(str).apply(len).max(),
                len(col)
            )
            # Cap at 50 for very long content
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[chr(65 + idx)].width = adjusted_width
