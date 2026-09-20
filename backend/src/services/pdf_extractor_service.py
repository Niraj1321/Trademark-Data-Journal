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
            
            print(f"   -> [{file_index}/{total_files}] {pdf_file.file_name} ({total_pages} pgs): {records_saved} TMs in {elapsed:.2f}s ({pages_per_sec:.0f} pgs/s) [OK]")
            
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
            print(f"   -> [ERROR] Failed extracting {pdf_file.file_name}: {str(e)}")
            return 0
    
    def _process_pdf_fast(self, pdf_file: PDFFile) -> tuple[List[Dict], int]:
        """
        Process PDF and extract trademark records and logos using PyMuPDF (fitz) or fallback
        """
        records = []
        file_path = pdf_file.file_path
        
        if not file_path or not Path(file_path).exists():
            return records, 0

        # Determine journal number and setup image directory
        journal_no = "unknown"
        if pdf_file.journal and pdf_file.journal.journal_number:
            journal_no = str(pdf_file.journal.journal_number)
        elif pdf_file.journal_id:
            j = self.db.query(Journal).filter(Journal.id == pdf_file.journal_id).first()
            if j and j.journal_number:
                journal_no = str(j.journal_number)
                
        images_dir = Path(settings.DOWNLOAD_DIR) / "images" / journal_no
        images_dir.mkdir(parents=True, exist_ok=True)
            
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
                            # Extract trademark logo image if embedded on the page
                            imgs = page.get_images()
                            has_logo = False
                            if imgs:
                                try:
                                    xref = imgs[0][0]
                                    base_img = doc.extract_image(xref)
                                    img_bytes = base_img.get("image")
                                    if img_bytes:
                                        from PIL import Image
                                        import io
                                        pil_img = Image.open(io.BytesIO(img_bytes))
                                        if pil_img.mode in ('RGBA', 'LA') or (pil_img.mode == 'P' and 'transparency' in pil_img.info):
                                            bg = Image.new('RGB', pil_img.size, (255, 255, 255))
                                            if pil_img.mode == 'P':
                                                pil_img = pil_img.convert('RGBA')
                                            bg.paste(pil_img, mask=pil_img.split()[3])
                                            pil_img = bg
                                        elif pil_img.mode != 'RGB':
                                            pil_img = pil_img.convert('RGB')
                                            
                                        app_num_clean = re.sub(r'[^\w\-]', '_', str(record['application_number']))
                                        img_filename = f"{app_num_clean}.jpg"
                                        target_path = images_dir / img_filename
                                        pil_img.save(target_path, "JPEG", quality=92, optimize=True)
                                        record["image_path"] = f"images/{journal_no}/{img_filename}"
                                        has_logo = True
                                except Exception:
                                    pass

                            # If no embedded image (Word Mark), generate clean specimen plate image
                            if not has_logo:
                                try:
                                    pil_img = self._generate_wordmark_image(
                                        trademark_name=record.get("trademark_name") or "WORD MARK",
                                        app_number=str(record.get("application_number") or ""),
                                        class_number=record.get("class_number")
                                    )
                                    app_num_clean = re.sub(r'[^\w\-]', '_', str(record['application_number']))
                                    img_filename = f"{app_num_clean}.jpg"
                                    target_path = images_dir / img_filename
                                    pil_img.save(target_path, "JPEG", quality=92, optimize=True)
                                    record["image_path"] = f"images/{journal_no}/{img_filename}"
                                except Exception:
                                    pass

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
                            has_logo = False
                            if hasattr(page, 'images') and page.images:
                                try:
                                    from PIL import Image
                                    import io
                                    first_img = page.images[0]
                                    img_stream = first_img.get('stream')
                                    if img_stream:
                                        raw_bytes = img_stream.get_data()
                                        pil_img = Image.open(io.BytesIO(raw_bytes)).convert('RGB')
                                        app_num_clean = re.sub(r'[^\w\-]', '_', str(record['application_number']))
                                        img_filename = f"{app_num_clean}.jpg"
                                        target_path = images_dir / img_filename
                                        pil_img.save(target_path, "JPEG", quality=92)
                                        record["image_path"] = f"images/{journal_no}/{img_filename}"
                                        has_logo = True
                                except Exception:
                                    pass

                            if not has_logo:
                                try:
                                    pil_img = self._generate_wordmark_image(
                                        trademark_name=record.get("trademark_name") or "WORD MARK",
                                        app_number=str(record.get("application_number") or ""),
                                        class_number=record.get("class_number")
                                    )
                                    app_num_clean = re.sub(r'[^\w\-]', '_', str(record['application_number']))
                                    img_filename = f"{app_num_clean}.jpg"
                                    target_path = images_dir / img_filename
                                    pil_img.save(target_path, "JPEG", quality=92, optimize=True)
                                    record["image_path"] = f"images/{journal_no}/{img_filename}"
                                except Exception:
                                    pass

                            records.append(record)
                    except Exception:
                        continue
            return records, total_pages
        except Exception as e:
            print(f"[ERROR] pdfplumber fallback failed on {file_path}: {e}")
            return records, total_pages
    
    def _parse_page_text(self, text: str, page_num: int) -> Optional[Dict]:
        """
        Parse text of a single page to extract trademark application details with high precision
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
        
        # 1. Class number detection from top header lines
        class_num = None
        for line in lines[:min(6, len(lines))]:
            m_cls = re.search(r'\bClass\s+(\d+)\b', line, re.IGNORECASE)
            if m_cls:
                class_num = int(m_cls.group(1))
                break
            
        # 2. Priority info & Word Mark extraction from lines before application number
        priority_parts = []
        tm_lines = []
        is_in_priority = False
        
        for l in lines[:app_idx]:
            # Filter out journal header lines and page numbers
            if re.search(r'Trade\s*Marks?\s*Journal', l, re.IGNORECASE) or re.search(r'International\s+Registration\s+designating\s+India', l, re.IGNORECASE):
                continue
            if re.match(r'^\d+$', l):
                continue
            if re.match(r'^Class\s+\d+$', l, re.IGNORECASE):
                continue
                
            # Detect priority claim lines (can span multiple lines)
            if re.search(r'Priority\s+claimed', l, re.IGNORECASE):
                is_in_priority = True
                priority_parts.append(l)
                continue
                
            if is_in_priority:
                if re.search(r'Application\s*No\.?\s*:', l, re.IGNORECASE) or re.match(r'^[;\s\w\.\-]+$', l) or re.match(r'^\d+$', l):
                    priority_parts.append(l)
                    if ';' in l or re.search(r'\b(Union|America|States|Germany|France|Japan|Italy|China|Kingdom|India|Canada|Australia|Spain|Switzerland)\b', l, re.IGNORECASE):
                        is_in_priority = False
                    continue
                else:
                    is_in_priority = False
                    
            if re.search(r'Application\s*No\.?\s*:', l, re.IGNORECASE):
                priority_parts.append(l)
                continue
                
            tm_lines.append(l)
            
        trademark_name = " ".join(tm_lines).strip() if tm_lines else None
        priority_str = " ".join(priority_parts).strip() if priority_parts else None
            
        # 3. Parse lines after application number
        after_lines = lines[app_idx + 1:]
        applicant_name = None
        applicant_address = []
        applicant_type = None
        attorney_name = None
        attorney_address = []
        associated_with_parts = []
        
        if priority_str:
            associated_with_parts.append(f"Priority: {priority_str}")
            
        used_since = None
        office_location = None
        goods_services = []
        
        state = "APPLICANT"
        type_keywords = [
            'INDIVIDUAL', 'PARTNERSHIP FIRM', 'PARTNERSHIP', 'PRIVATE LIMITED', 'LIMITED COMPANY', 
            'LLP', 'PROPRIETORSHIP FIRM', 'PROPRIETORSHIP', 'BODY INCORPORATE', 'HUF', 'SOLE PROPRIETOR',
            'COMPANY', 'SOCIETY', 'TRUST', 'GMBH', 'INC', 'CORPORATION', 'LIMITED', 'LTD', 
            'JOINT APPLICANT', 'SINGLE FIRM', 'S.P.A.', 'S.R.L.', 'A.G.', 'B.V.'
        ]
        cities = ['MUMBAI', 'DELHI', 'KOLKATA', 'CHENNAI', 'AHMEDABAD']
        
        for line in after_lines:
            if re.match(r'^\d+$', line):
                continue

            # Capture International Registration No.
            intl_match = re.search(r'\[?International Registration No\.?\s*:\s*([^\]\)]+)\]?', line, re.IGNORECASE)
            if intl_match:
                associated_with_parts.append(f"IR No: {intl_match.group(1).strip()}")
                continue
                
            if re.search(r'Priority\s+claimed', line, re.IGNORECASE):
                associated_with_parts.append(f"Priority: {line}")
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
                if line.startswith("IR DIVISION") or "International Registration" in line:
                    continue
                if not applicant_name:
                    applicant_name = line
                    # Auto-detect entity type from applicant name with word boundaries
                    for kw in ['GMBH', 'INC', 'CORP', 'CORPORATION', 'AG', 'SARL', 'B.V.', 'LIMITED', 'LTD', 'PVT LTD', 'PRIVATE LIMITED', 'LLP', 'S.P.A.', 'S.R.L.', 'S.A.']:
                        if re.search(rf'\b{re.escape(kw)}\b', line, re.IGNORECASE):
                            applicant_type = 'Company / Body Incorporate' if kw in ['GMBH', 'INC', 'CORP', 'CORPORATION', 'AG', 'SARL', 'B.V.', 'S.P.A.', 'S.R.L.', 'S.A.'] else kw.title()
                            break
                else:
                    # Distinguish Address vs Entity Type with comprehensive Indian & International patterns
                    is_address_line = bool(
                        re.search(r'\b\d{3}\s?\d{3}\b', line) or
                        re.search(r'\b\d{5,6}\b', line) or
                        re.search(r'\b(PLOT|FLAT|SHOP|HOUSE|ROOM|H\.?\s*NO|OFFICE|SURVEY|GALA|KHASRA|GAT|SECTOR|NAGAR|ROAD|STREET|LANE|MARG|AVENUE|BLDG|BUILDING|BUILDINGS|APARTMENT|APARTMENTS|RESIDENCY|TOWER|TOWERS|VILLAGE|VILL|TALUK|DIST|DISTRICT|POST|P\.?O\.?|BEHIND|OPP|NEAR|BESIDE|C\/O|D\.?NO|DOOR|FLOOR|COMPLEX|COMPLEXES|ESTATE|ESTATES|ENCLAVE|ENCLAVES|CHAMBERS|MANSION|SOCIETY|SOCIETIES)\b', line, re.IGNORECASE) or
                        re.search(r'\b(INDIA|GUJARAT|MAHARASHTRA|DELHI|RAJASTHAN|HARYANA|PUNJAB|UTTAR PRADESH|MADHYA PRADESH|KARNATAKA|TAMIL NADU|TELANGANA|ANDHRA|KERALA|WEST BENGAL|BIHAR|ODISHA|ASSAM|UTTARAKHAND|JHARKHAND|HIMACHAL|GOA|CHHATTISGARH)\b', line, re.IGNORECASE) or
                        re.search(r'\b(MUMBAI|KOLKATA|CHENNAI|AHMEDABAD|BANGALORE|BENGALURU|HYDERABAD|PUNE|SURAT|JAIPUR|CHANDIGARH|LUCKNOW|KANPUR|NAGPUR|INDORE|THANE|BHOPAL|PATNA|VADODARA|GHAZIABAD|LUDHIANA|AGRA|NASHIK|FARIDABAD|MEERUT|RAJKOT|VARANASI|NOIDA|GURGAON|GURUGRAM|CHEMBUR|ANDHERI|BORIVALI)\b', line, re.IGNORECASE) or
                        re.search(r'\b(GERMANY|FRANCE|ITALY|JAPAN|CHINA|SPAIN|USA|UNITED STATES|UNITED KINGDOM|SWITZERLAND|CANADA|AUSTRALIA)\b', line, re.IGNORECASE) or
                        re.search(r'^[A-Za-z0-9\-\/]+,\s+', line)
                    )
                    
                    is_type = False
                    if not is_address_line:
                        for kw in type_keywords:
                            if re.search(rf'\b{re.escape(kw)}\b', line, re.IGNORECASE):
                                applicant_type = line
                                is_type = True
                                break
                        if not is_type and re.search(r'^(Individual\b|A\s+Corporation|A\s+Company|Registered under|SOCIETY\s+Registered|TRUST\s+Registered)', line, re.IGNORECASE):
                            applicant_type = line
                            is_type = True
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
                if not found_city and not line.startswith("IR DIVISION"):
                    goods_services.append(line)
                    
            elif state == "GOODS":
                if line.startswith("IR DIVISION"):
                    continue
                if not class_num:
                    m_cl = re.search(r'\bCl(?:ass)?\.?\s*(\d+)\b', line, re.IGNORECASE)
                    if m_cl:
                        class_num = int(m_cl.group(1))
                if not line.startswith("IT IS A CONDITION") and not line.startswith("THIS IS SUBJECT TO"):
                    goods_services.append(line)

        # 4. Fallback for class number from goods & services
        if not class_num and goods_services:
            for g in goods_services[:5]:
                m_cl = re.search(r'\bCl(?:ass)?\.?\s*(\d+)\b', g, re.IGNORECASE)
                if m_cl:
                    class_num = int(m_cl.group(1))
                    break

        # 5. If trademark_name is empty (e.g. Device / Logo mark), determine clean mark
        if not trademark_name:
            if applicant_name:
                is_person = bool(re.match(r'^(MR\.?|MRS\.?|MS\.?|SH\.?|SHRI|SMT\.?|DR\.?|M\/S\.?)\b', applicant_name, re.IGNORECASE)) or (applicant_type == 'INDIVIDUAL')
                if is_person:
                    trademark_name = "DEVICE MARK"
                else:
                    clean_brand = re.sub(
                        r'\b(LIMITED LIABILITY COMPANY|LLC|GMBH|INC\.?|CORP\.?|CORPORATION|AG|S\.?A\.?|SARL|B\.?V\.?|LIMITED|LTD\.?|PVT\.?\s+LTD\.?|PRIVATE\s+LIMITED|LLP|COMPANY|CO\.?|S\.?P\.?A\.?|S\.?R\.?L\.?)\b',
                        '',
                        applicant_name,
                        flags=re.IGNORECASE
                    ).strip(' ,.-&')
                    trademark_name = clean_brand or "DEVICE MARK"
            else:
                trademark_name = "DEVICE MARK"
                    
        return {
            "application_number": app_num,
            "filing_date": filing_date,
            "trademark_name": trademark_name or "DEVICE MARK",
            "applicant_name": applicant_name or "Unknown",
            "applicant_address": ", ".join(applicant_address) if applicant_address else None,
            "applicant_type": applicant_type,
            "class_number": class_num,
            "attorney_name": attorney_name,
            "attorney_address": ", ".join(attorney_address) if attorney_address else None,
            "associated_with": " | ".join(associated_with_parts) if associated_with_parts else None,
            "used_since": used_since,
            "office_location": office_location,
            "goods_services": " ".join(goods_services) if goods_services else None,
            "page_number": page_num,
            "image_path": None,
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
    
    @staticmethod
    def _generate_wordmark_image(trademark_name: str, app_number: str = "", class_number: Optional[int] = None):
        """
        Generate a clean, high-resolution visual specimen card for Word Mark (text) trademarks
        """
        from PIL import Image, ImageDraw, ImageFont
        
        width, height = 600, 300
        img = Image.new('RGB', (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        
        # Elegant outer border
        draw.rectangle([(10, 10), (width - 11, height - 11)], outline=(226, 232, 240), width=2)
        
        # Top badge: 'TRADE MARK (WORD)' • CLASS XX
        header_text = 'TRADE MARK (WORD)'
        if class_number:
            header_text += f' • CLASS {class_number}'
            
        try:
            font_small = ImageFont.truetype('arial.ttf', 13)
        except Exception:
            font_small = ImageFont.load_default()
            
        draw.text((25, 22), header_text, fill=(100, 116, 139), font=font_small)
        
        # Main trademark text (auto-fit to box)
        clean_name = trademark_name.strip() if trademark_name else "WORD MARK"
        font_size = 46
        font = None
        while font_size >= 14:
            try:
                font = ImageFont.truetype('arialbd.ttf', font_size)
            except Exception:
                try:
                    font = ImageFont.truetype('arial.ttf', font_size)
                except Exception:
                    font = ImageFont.load_default()
                    break
            bbox = draw.textbbox((0, 0), clean_name, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            if text_w <= width - 60 and text_h <= height - 110:
                break
            font_size -= 4
            
        bbox = draw.textbbox((0, 0), clean_name, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        x = (width - text_w) // 2 - bbox[0]
        y = (height - text_h) // 2 - bbox[1]
        
        draw.text((x, y), clean_name, fill=(15, 23, 42), font=font)
        
        # Bottom footer info
        if app_number:
            bottom_text = f'App No: {app_number}'
            draw.text((25, height - 36), bottom_text, fill=(148, 163, 184), font=font_small)
            
        return img
    
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
        print(f" [3/3] [+] Fast-Extracting Trademarks from {total_pending} PDFs...")
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
        print(f"\n[+] Fast Extraction Complete: {stats['records']:,} trademarks extracted from {stats['processed']}/{total_pending} PDFs in {total_time:.1f}s")
        
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

