"""
PDF extraction service for trademark data (High-Speed PyMuPDF Edition)
"""
import re
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Callable
from sqlalchemy.orm import Session

# High-speed PDF parser
try:
    import pymupdf as fitz  # PyMuPDF (100x faster than pdfplumber)
    HAVE_FITZ = True
except ImportError:
    try:
        import fitz
        HAVE_FITZ = True
    except ImportError:
        HAVE_FITZ = False
        import pdfplumber

from ..models.models import PDFFile, TrademarkApplication, ExtractionStatus, Journal
from ..config.settings import settings


class PDFExtractor:
    """
    Extracts trademark application data from PDF files using ultra-fast C++ PyMuPDF engine
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def extract_pdf(
        self, 
        pdf_file: PDFFile, 
        progress_callback: Optional[Callable[[Dict], None]] = None,
        file_index: int = 1,
        total_files: int = 1
    ) -> int:
        """
        Extract trademark applications from a PDF file
        
        Args:
            pdf_file: PDFFile object to extract
            progress_callback: Optional callback for UI progress
            file_index: Current file index
            total_files: Total files to extract
        
        Returns:
            Number of records extracted
        """
        try:
            pdf_file.extraction_status = ExtractionStatus.PROCESSING
            self.db.commit()
            
            t0 = time.time()
            
            # Fast text extraction & parsing
            records, total_pages = self._process_pdf_fast(pdf_file)
            
            # Save records to database in fast batches
            records_saved = 0
            if records:
                # Prepare ORM objects
                tm_objects = [
                    TrademarkApplication(
                        pdf_file_id=pdf_file.id,
                        journal_id=pdf_file.journal_id,
                        **record
                    )
                    for record in records
                ]
                
                # Batch commit in chunks of 500
                chunk_size = 500
                for i in range(0, len(tm_objects), chunk_size):
                    chunk = tm_objects[i:i + chunk_size]
                    try:
                        self.db.bulk_save_objects(chunk)
                        self.db.commit()
                        records_saved += len(chunk)
                    except Exception:
                        self.db.rollback()
                        # Fallback item-by-item if batch had duplicate/issue
                        for item in chunk:
                            try:
                                self.db.add(item)
                                self.db.commit()
                                records_saved += 1
                            except Exception:
                                self.db.rollback()
            
            # Update PDF file status
            p = self.db.query(PDFFile).filter(PDFFile.id == pdf_file.id).first()
            if p:
                p.extraction_status = ExtractionStatus.COMPLETED
                p.extraction_date = datetime.utcnow()
                p.records_extracted = records_saved
                p.error_message = None
                self.db.commit()
            
            elapsed = time.time() - t0
            pages_per_sec = total_pages / max(0.01, elapsed)
            
            print(f"   ↳ [{file_index}/{total_files}] {pdf_file.file_name} ({total_pages} pgs): {records_saved} TMs in {elapsed:.2f}s ({pages_per_sec:.0f} pgs/s) ✓")
            
            if progress_callback:
                progress_callback({
                    "step": "extract_file_done",
                    "file_name": pdf_file.file_name,
                    "index": file_index,
                    "total_files": total_files,
                    "pages": total_pages,
                    "records": records_saved,
                    "elapsed": round(elapsed, 2),
                    "message": f"Extracted {records_saved} trademarks from {pdf_file.file_name} ({total_pages} pages)"
                })
                
            return records_saved
            
        except Exception as e:
            self.db.rollback()
            try:
                p = self.db.query(PDFFile).filter(PDFFile.id == pdf_file.id).first()
                if p:
                    p.extraction_status = ExtractionStatus.ERROR
                    p.error_message = str(e)
                    self.db.commit()
            except Exception:
                pass
            print(f"   ↳ [ERROR] Failed extracting {pdf_file.file_name}: {str(e)}")
            return 0
    
    def _process_pdf_fast(self, pdf_file: PDFFile) -> tuple[List[Dict], int]:
        """
        Process PDF and extract trademark records using PyMuPDF (fitz) or fallback
        """
        records = []
        file_path = pdf_file.file_path
        
        if not file_path or not Path(file_path).exists():
            return records, 0
            
        if HAVE_FITZ:
            try:
                doc = fitz.open(file_path)
                total_pages = len(doc)
                
                for page_num in range(1, total_pages + 1):
                    try:
                        page = doc.load_page(page_num - 1)
                        text = page.get_text()
                        if not text:
                            continue
                        
                        record = self._parse_page_text(text, page_num)
                        if record:
                            records.append(record)
                    except Exception:
                        continue
                doc.close()
                return records, total_pages
            except Exception as e:
                print(f"[WARN] PyMuPDF could not read {file_path}: {e}")
                records = []
                total_pages = 0
        
        # Fallback to pdfplumber
        try:
            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)
                for page_num in range(1, total_pages + 1):
                    try:
                        page = pdf.pages[page_num - 1]
                        text = page.extract_text()
                        if not text:
                            continue
                        record = self._parse_page_text(text, page_num)
                        if record:
                            records.append(record)
                    except Exception:
                        continue
            return records, total_pages
        except Exception as e:
            print(f"[ERROR] pdfplumber fallback failed on {file_path}: {e}")
            return records, total_pages
    
    def _parse_page_text(self, text: str, page_num: int) -> Optional[Dict]:
        """
        Parse text of a single page to extract trademark application details
        """
        if not text:
            return None
            
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if not lines:
            return None
            
        # Check for application number pattern: 7-10 digits followed by DD/MM/YYYY
        app_idx = -1
        app_match = None
        for idx, line in enumerate(lines):
            m = re.search(r'(\b\d{7,10}\b)\s+(\d{2}/\d{2}/\d{4})', line)
            if m:
                app_idx = idx
                app_match = m
                break
                
        if not app_match:
            return None
            
        app_num = app_match.group(1)
        filing_date = self._parse_date(app_match.group(2))
        
        # Class number
        class_num = None
        header_class = re.search(r'Class\s+(\d+)', lines[0], re.IGNORECASE)
        if header_class:
            class_num = int(header_class.group(1))
            
        # Trademark Word Mark (if present before application number)
        trademark_name = None
        if app_idx > 1:
            tm_lines = lines[1:app_idx]
            trademark_name = " ".join(tm_lines).strip()
            
        after_lines = lines[app_idx + 1:]
        applicant_name = None
        applicant_address = []
        applicant_type = None
        attorney_name = None
        attorney_address = []
        used_since = None
        office_location = None
        goods_services = []
        
        state = "APPLICANT"
        type_keywords = [
            'INDIVIDUAL', 'PARTNERSHIP', 'PRIVATE LIMITED', 'LIMITED COMPANY', 
            'LLP', 'PROPRIETORSHIP', 'BODY INCORPORATE', 'HUF', 'SOLE PROPRIETOR',
            'PARTNERSHIP FIRM', 'COMPANY', 'SOCIETY', 'TRUST'
        ]
        cities = ['MUMBAI', 'DELHI', 'KOLKATA', 'CHENNAI', 'AHMEDABAD']
        
        for line in after_lines:
            if re.match(r'^\d+$', line):
                continue
                
            if re.search(r'Address for service in India/(Attorney|Agents)\s*address:', line, re.IGNORECASE):
                state = "ATTORNEY"
                continue
                
            used_m = re.search(r'Used Since\s*:?\s*(\d{2}/\d{2}/\d{4})', line, re.IGNORECASE)
            if used_m:
                used_since = used_m.group(1)
                state = "OFFICE"
                continue
            elif 'Proposed to be Used' in line or 'Proposed to be used' in line:
                used_since = 'Proposed to be used'
                state = "OFFICE"
                continue
                
            if line.upper() in cities:
                office_location = line.upper()
                state = "GOODS"
                continue
                
            if state == "APPLICANT":
                if not applicant_name:
                    applicant_name = line
                else:
                    is_type = False
                    for kw in type_keywords:
                        if kw in line.upper():
                            applicant_type = line
                            is_type = True
                            break
                    if not is_type:
                        applicant_address.append(line)
                        
            elif state == "ATTORNEY":
                if not attorney_name:
                    attorney_name = line
                else:
                    attorney_address.append(line)
                    
            elif state == "OFFICE":
                found_city = False
                for c in cities:
                    if c in line.upper():
                        office_location = c
                        found_city = True
                        break
                state = "GOODS"
                if not found_city:
                    goods_services.append(line)
                    
            elif state == "GOODS":
                if not line.startswith("IT IS A CONDITION") and not line.startswith("THIS IS SUBJECT TO"):
                    goods_services.append(line)
                    
        return {
            "application_number": app_num,
            "filing_date": filing_date,
            "trademark_name": trademark_name or applicant_name or f"TM-{app_num}",
            "applicant_name": applicant_name or "Unknown",
            "applicant_address": ", ".join(applicant_address) if applicant_address else None,
            "applicant_type": applicant_type,
            "class_number": class_num,
            "attorney_name": attorney_name,
            "attorney_address": ", ".join(attorney_address) if attorney_address else None,
            "used_since": used_since,
            "office_location": office_location,
            "goods_services": " ".join(goods_services) if goods_services else None,
            "page_number": page_num,
            "raw_text": text[:3000]
        }
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """
        Parse date string in DD/MM/YYYY format
        """
        try:
            return datetime.strptime(date_str.strip(), "%d/%m/%Y").date()
        except Exception:
            return None
    
    def extract_all_pending(
        self,
        progress_callback: Optional[Callable[[Dict], None]] = None
    ) -> Dict[str, int]:
        """
        Extract all PDFs with pending status
        
        Returns:
            Dictionary with extraction statistics
        """
        pending_pdfs = self.db.query(PDFFile).filter(
            PDFFile.extraction_status == ExtractionStatus.PENDING
        ).all()
        
        total_pending = len(pending_pdfs)
        print(f"\n========================================================")
        print(f" [3/3] ⚡ Fast-Extracting Trademarks from {total_pending} PDFs...")
        print(f"========================================================")
        
        if progress_callback:
            progress_callback({
                "step": "extract_start",
                "pending_pdfs": total_pending,
                "message": f"Starting fast extraction across {total_pending} pending PDFs..."
            })
            
        stats = {
            'total_pdfs': total_pending,
            'processed': 0,
            'records': 0,
            'errors': 0
        }
        
        t0 = time.time()
        for idx, pdf_file in enumerate(pending_pdfs, 1):
            records = self.extract_pdf(pdf_file, progress_callback, idx, total_pending)
            if records > 0:
                stats['processed'] += 1
                stats['records'] += records
            else:
                stats['errors'] += 1
                
        total_time = time.time() - t0
        print(f"\n[✓] Fast Extraction Complete: {stats['records']:,} trademarks extracted from {stats['processed']}/{total_pending} PDFs in {total_time:.1f}s")
        
        if progress_callback:
            progress_callback({
                "step": "extract_complete",
                "records": stats['records'],
                "processed": stats['processed'],
                "total": total_pending,
                "total_time": round(total_time, 1),
                "message": f"Extracted {stats['records']} trademarks from {stats['processed']} PDFs in {total_time:.1f}s"
            })
            
        return {
            'pdfs_total': stats['total_pdfs'],
            'pdfs_processed': stats['processed'],
            'records': stats['records'],
            'errors': stats['errors']
        }

