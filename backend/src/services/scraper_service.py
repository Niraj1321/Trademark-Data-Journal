"""
Web scraper service for Trademark Journal website (High-Speed Concurrent Edition)
"""
from typing import List, Dict, Optional, Callable
from playwright.sync_api import sync_playwright, Page
from pathlib import Path
from datetime import datetime
import requests
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session

from ..models.models import Journal, PDFFile, JournalStatus, ExtractionStatus
from ..config.settings import settings


class TrademarkScraper:
    """
    Scrapes trademark journal PDFs from IP India website with concurrent high-speed downloads.
    """
    
    BASE_URL = "https://search.ipindia.gov.in/IPOJournal/Journal/Trademark"
    DOWNLOAD_POST_URL = "https://search.ipindia.gov.in/IPOJournal/Journal/ViewJournal"
    
    def __init__(self, db: Session):
        self.db = db
        self.download_dir = Path(settings.DOWNLOAD_DIR)
        self.download_dir.mkdir(exist_ok=True)
    
    def scrape_latest_journals(
        self, 
        max_journals: int = 1,
        progress_callback: Optional[Callable[[Dict], None]] = None
    ) -> List[Journal]:
        """
        Scrape latest journal entries from the website
        
        Args:
            max_journals: Maximum number of journals to scrape (default: 1)
            progress_callback: Optional callback for live progress streaming
        
        Returns:
            List of Journal objects
        """
        journals = []
        
        if progress_callback:
            progress_callback({
                "step": "connect",
                "message": "Connecting to IP India Trademark Journal portal..."
            })
            
        print(f"\n========================================================")
        print(f" [1/3] 🌐 Connecting to IP India Trademark Journal Portal...")
        print(f"========================================================")
        
        start_total = time.time()
        journal_data = []
        
        # Primary Fast Method: Direct HTTP + BeautifulSoup (Ultra fast, minimal RAM)
        try:
            print("[+] Attempting ultra-fast direct portal fetch...")
            resp = requests.get(self.BASE_URL, timeout=25, verify=False)
            if resp.status_code == 200 and "table" in resp.text.lower():
                journal_data = self._extract_table_data_bs4(resp.text, max_journals)
                if journal_data:
                    print(f"[✓] Direct HTTP fast-fetch retrieved {len(journal_data)} journals in {time.time() - start_total:.2f}s")
        except Exception as e:
            print(f"[WARN] Direct HTTP fetch failed ({e}), falling back to headless browser...")

        # Secondary Fallback Method: Playwright with Linux sandbox arguments
        if not journal_data:
            print("[+] Launching Playwright browser fallback...")
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
                )
                context = browser.new_context()
                page = context.new_page()
                try:
                    page.goto(self.BASE_URL, timeout=60000)
                    page.wait_for_selector("table#Journal", timeout=30000)
                    journal_data = self._extract_table_data(page, max_journals)
                except Exception as e:
                    print(f"[ERROR] Scraper browser navigation failed: {str(e)}")
                    if progress_callback:
                        progress_callback({"step": "error", "message": f"Scraper error: {str(e)}"})
                    raise
                finally:
                    browser.close()
                    
        print(f"[✓] Successfully retrieved {len(journal_data)} journal entries from portal")
        
        if progress_callback:
            progress_callback({
                "step": "table_extracted",
                "journals_found": len(journal_data),
                "message": f"Found {len(journal_data)} latest journal(s)"
            })
        
        # Process each journal
        for j_idx, data in enumerate(journal_data, 1):
            # Check if already exists in DB
            existing = self.db.query(Journal).filter(
                Journal.journal_number == data["journal_number"]
            ).first()
            
            if existing:
                journal = existing
                if not journal.publication_date and data.get("publication_date"):
                    journal.publication_date = data["publication_date"]
                if not journal.availability_date and data.get("availability_date"):
                    journal.availability_date = data["availability_date"]
                self.db.commit()
                print(f"[INFO] Journal #{data['journal_number']} already in DB. Checking PDF files...")
            else:
                journal = Journal(
                    journal_number=data["journal_number"],
                    publication_date=data["publication_date"],
                    availability_date=data["availability_date"],
                    status=JournalStatus.PENDING
                )
                self.db.add(journal)
                self.db.commit()
                self.db.refresh(journal)
                print(f"[NEW] Registered Journal #{journal.journal_number} (Pub: {data['publication_date']})")
            
            # Download PDFs concurrently for this journal
            self._download_journal_pdfs_parallel(journal, data["pdf_forms"], progress_callback)
            journals.append(journal)
            
        elapsed = time.time() - start_total
        print(f"\n[✓] Journal scraping and downloads completed in {elapsed:.1f}s")
        return journals
    
    def _extract_table_data_bs4(self, html_text: str, max_journals: int) -> List[Dict]:
        """
        Ultra-fast HTML parsing using BeautifulSoup (0.2s runtime, minimal memory)
        """
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_text, "html.parser")
        table = soup.find("table", id="Journal")
        if not table:
            return []
            
        tbody = table.find("tbody")
        if not tbody:
            return []
            
        rows = tbody.find_all("tr")
        journal_data = []
        
        for idx, row in enumerate(rows[:max_journals]):
            try:
                cells = row.find_all("td")
                if len(cells) >= 5:
                    sr_no = cells[0].get_text(strip=True)
                    journal_no = cells[1].get_text(strip=True)
                    pub_date = cells[2].get_text(strip=True)
                    avail_date = cells[3].get_text(strip=True)
                    
                    try:
                        pub_date_obj = datetime.strptime(pub_date, "%d/%m/%Y").date()
                    except Exception:
                        pub_date_obj = datetime.utcnow().date()
                        
                    try:
                        avail_date_obj = datetime.strptime(avail_date, "%d/%m/%Y").date()
                    except Exception:
                        avail_date_obj = datetime.utcnow().date()
                        
                    pdf_forms = []
                    forms = cells[4].find_all("form")
                    for form in forms:
                        hidden_input = form.find("input", {"name": "FileName"})
                        btn = form.find(["button", "input"])
                        if hidden_input and hidden_input.get("value"):
                            filename = hidden_input["value"]
                            button_text = btn.get_text(strip=True) if btn else ""
                            if not button_text and btn and btn.get("value"):
                                button_text = btn["value"]
                            pdf_forms.append({
                                "filename": filename,
                                "button_text": button_text or f"Part-{len(pdf_forms) + 1}"
                            })
                            
                    if not pdf_forms:
                        for in_el in cells[4].find_all("input", {"name": "FileName"}):
                            fn = in_el.get("value")
                            if fn:
                                pdf_forms.append({
                                    "filename": fn,
                                    "button_text": f"Part-{len(pdf_forms) + 1}"
                                })
                                
                    journal_data.append({
                        "sr_no": sr_no,
                        "journal_number": journal_no,
                        "publication_date": pub_date_obj,
                        "availability_date": avail_date_obj,
                        "row_index": idx,
                        "pdf_forms": pdf_forms
                    })
                    print(f"   ↳ [BS4] Journal #{journal_no} | Published: {pub_date} | {len(pdf_forms)} PDF parts")
            except Exception as e:
                print(f"[WARN] Error parsing BS4 row {idx}: {e}")
                continue
                
        return journal_data
    
    def _extract_table_data(self, page: Page, max_journals: int) -> List[Dict]:
        """
        Extract journal data from table, including PDF form details
        """
        journal_data = []
        
        try:
            # Expand table length if dropdown exists
            select = page.query_selector("select[name='Journal_length']")
            if select:
                page.select_option("select[name='Journal_length']", "-1")
                page.wait_for_timeout(1000)
        except Exception:
            pass
            
        rows = page.query_selector_all("table#Journal tbody tr")
        print(f"[*] Found {len(rows)} rows in journal table. Selecting latest {max_journals}...")
        
        for idx, row in enumerate(rows[:max_journals]):
            try:
                cells = row.query_selector_all("td")
                if len(cells) >= 5:
                    sr_no = cells[0].inner_text().strip()
                    journal_no = cells[1].inner_text().strip()
                    pub_date = cells[2].inner_text().strip()
                    avail_date = cells[3].inner_text().strip()
                    
                    # Parse dates
                    try:
                        pub_date_obj = datetime.strptime(pub_date, "%d/%m/%Y").date()
                    except Exception:
                        pub_date_obj = datetime.utcnow().date()
                        
                    try:
                        avail_date_obj = datetime.strptime(avail_date, "%d/%m/%Y").date()
                    except Exception:
                        avail_date_obj = datetime.utcnow().date()
                    
                    # Extract PDF forms
                    pdf_forms = []
                    forms = cells[4].query_selector_all("form")
                    
                    for form in forms:
                        hidden_input = form.query_selector("input[name='FileName']")
                        btn = form.query_selector("button") or form.query_selector("input[type='submit']") or form.query_selector("input[type='button']")
                        
                        if hidden_input:
                            filename = hidden_input.get_attribute("value")
                            if filename:
                                button_text = ""
                                if btn:
                                    button_text = btn.inner_text().strip() or btn.get_attribute("value") or ""
                                button_text = " ".join(button_text.split())
                                
                                pdf_forms.append({
                                    "filename": filename,
                                    "button_text": button_text or f"Part-{len(pdf_forms) + 1}",
                                })
                    
                    if not pdf_forms:
                        # Fallback: find all input[name='FileName'] directly in the cell
                        all_inputs = cells[4].query_selector_all("input[name='FileName']")
                        for in_el in all_inputs:
                            filename = in_el.get_attribute("value")
                            if filename:
                                pdf_forms.append({
                                    "filename": filename,
                                    "button_text": f"Part-{len(pdf_forms) + 1}"
                                })
                    
                    journal_data.append({
                        "sr_no": sr_no,
                        "journal_number": journal_no,
                        "publication_date": pub_date_obj,
                        "availability_date": avail_date_obj,
                        "row_index": idx,
                        "pdf_forms": pdf_forms,
                    })
                    
                    print(f"   ↳ Journal #{journal_no} | Published: {pub_date} | {len(pdf_forms)} PDF parts available")
            except Exception as e:
                print(f"[WARN] Error extracting row {idx}: {str(e)}")
                continue
        
        return journal_data
    
    def _download_single_pdf(
        self, 
        session: requests.Session, 
        journal_id: int, 
        journal_number: str, 
        journal_dir: Path, 
        form_data: Dict, 
        form_idx: int, 
        total_forms: int
    ) -> Optional[Dict]:
        """
        Download a single PDF part via HTTP POST.
        """
        filename = form_data["filename"]
        button_text = form_data["button_text"]
        class_range = self._extract_class_range(button_text, form_idx)
        
        safe_filename = filename.split("\\")[-1].replace(" ", "_")
        if not safe_filename.lower().endswith('.pdf'):
            safe_filename += '.pdf'
        filepath = journal_dir / safe_filename
        
        def is_valid_pdf(p: Path) -> bool:
            if not p.exists() or p.stat().st_size < 10000:
                return False
            try:
                with open(p, 'rb') as f:
                    header = f.read(5)
                    if header != b'%PDF-':
                        return False
                    f.seek(-1024, 2)
                    tail = f.read()
                    if b'%%EOF' not in tail:
                        return False
                return True
            except Exception:
                return False

        # Check if already downloaded and valid on disk
        if is_valid_pdf(filepath):
            file_size = filepath.stat().st_size
            return {
                "journal_id": journal_id,
                "file_name": safe_filename,
                "file_path": str(filepath),
                "class_range": class_range,
                "file_size_bytes": file_size,
                "download_url": filename,
                "status": "cached",
                "index": form_idx + 1,
                "total": total_forms
            }
        
        # If exists but corrupted, remove it
        if filepath.exists():
            try:
                filepath.unlink()
            except Exception:
                pass
        
        # Download from IP India server using a temporary file
        tmp_filepath = filepath.with_suffix('.tmp')
        t0 = time.time()
        
        try:
            response = session.post(
                self.DOWNLOAD_POST_URL,
                data={"FileName": filename},
                timeout=settings.DOWNLOAD_TIMEOUT,
                stream=True
            )
            
            if response.status_code == 200:
                with open(tmp_filepath, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                
                if is_valid_pdf(tmp_filepath):
                    tmp_filepath.replace(filepath)
                    file_size = filepath.stat().st_size
                    elapsed = time.time() - t0
                    return {
                        "journal_id": journal_id,
                        "file_name": safe_filename,
                        "file_path": str(filepath),
                        "class_range": class_range,
                        "file_size_bytes": file_size,
                        "download_url": filename,
                        "status": "downloaded",
                        "elapsed": elapsed,
                        "index": form_idx + 1,
                        "total": total_forms
                    }
                else:
                    # In case EOF marker is slightly off, rename if > 500KB and starts with %PDF
                    if tmp_filepath.exists() and tmp_filepath.stat().st_size > 500000:
                        with open(tmp_filepath, 'rb') as f:
                            hdr = f.read(5)
                        if hdr == b'%PDF-':
                            tmp_filepath.replace(filepath)
                            file_size = filepath.stat().st_size
                            return {
                                "journal_id": journal_id,
                                "file_name": safe_filename,
                                "file_path": str(filepath),
                                "class_range": class_range,
                                "file_size_bytes": file_size,
                                "download_url": filename,
                                "status": "downloaded",
                                "elapsed": time.time() - t0,
                                "index": form_idx + 1,
                                "total": total_forms
                            }
                    tmp_filepath.unlink(missing_ok=True)
                    return None
            else:
                tmp_filepath.unlink(missing_ok=True)
                return None
        except Exception as e:
            tmp_filepath.unlink(missing_ok=True)
            print(f"[WARN] Error downloading {safe_filename}: {str(e)}")
            return None

    def _download_journal_pdfs_parallel(
        self, 
        journal: Journal, 
        pdf_forms: List[Dict],
        progress_callback: Optional[Callable[[Dict], None]] = None
    ):
        """
        Download all PDFs for a journal concurrently using ThreadPoolExecutor
        """
        try:
            journal.status = JournalStatus.PROCESSING
            self.db.commit()
            
            journal_dir = self.download_dir / journal.journal_number
            journal_dir.mkdir(exist_ok=True)
            
            total_count = len(pdf_forms)
            print(f"\n========================================================")
            print(f" [2/3] 📥 Downloading {total_count} PDFs in Parallel (Journal #{journal.journal_number})...")
            print(f"========================================================")
            
            if progress_callback:
                progress_callback({
                    "step": "download_start",
                    "journal_number": journal.journal_number,
                    "total_pdfs": total_count,
                    "message": f"Downloading {total_count} PDFs concurrently for Journal #{journal.journal_number}..."
                })
            
            # Setup requests Session with connection pool
            session = requests.Session()
            adapter = requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=10, max_retries=3)
            session.mount('https://', adapter)
            session.mount('http://', adapter)
            session.headers.update({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            })
            
            try:
                session.get(self.BASE_URL, timeout=20)
            except Exception:
                pass
            
            pdf_records = []
            downloaded_count = 0
            
            # Download concurrently with 2 workers (safe for PC performance)
            with ThreadPoolExecutor(max_workers=min(2, max(1, total_count))) as pool:
                futures = {
                    pool.submit(
                        self._download_single_pdf, 
                        session, 
                        journal.id, 
                        journal.journal_number, 
                        journal_dir, 
                        form_data, 
                        idx, 
                        total_count
                    ): form_data for idx, form_data in enumerate(pdf_forms)
                }
                
                for future in as_completed(futures):
                    result = future.result()
                    if result:
                        downloaded_count += 1
                        size_mb = result["file_size_bytes"] / (1024 * 1024)
                        status_tag = "✓ Cached" if result["status"] == "cached" else f"✓ Downloaded ({result.get('elapsed', 0):.1f}s)"
                        
                        print(f"   ↳ [{downloaded_count}/{total_count} ({int(downloaded_count/total_count*100)}%)] {result['file_name']} ({size_mb:.1f} MB) - {status_tag}")
                        
                        # Check/save to database
                        existing_pdf = self.db.query(PDFFile).filter(
                            PDFFile.journal_id == journal.id,
                            PDFFile.file_name == result["file_name"]
                        ).first()
                        
                        if not existing_pdf:
                            pdf_file = PDFFile(
                                journal_id=journal.id,
                                file_name=result["file_name"],
                                file_path=result["file_path"],
                                class_range=result["class_range"],
                                file_size_bytes=result["file_size_bytes"],
                                download_url=result["download_url"],
                                download_date=datetime.utcnow(),
                                extraction_status=ExtractionStatus.PENDING
                            )
                            self.db.add(pdf_file)
                            self.db.commit()
                            self.db.refresh(pdf_file)
                        
                        if progress_callback:
                            progress_callback({
                                "step": "download_progress",
                                "journal_number": journal.journal_number,
                                "downloaded": downloaded_count,
                                "total": total_count,
                                "percentage": int(downloaded_count / total_count * 100),
                                "filename": result["file_name"],
                                "size_mb": round(size_mb, 1),
                                "message": f"Downloaded [{downloaded_count}/{total_count}] {result['file_name']} ({size_mb:.1f} MB)"
                            })
            
            # Update journal status
            journal.pdf_count = downloaded_count
            journal.status = JournalStatus.COMPLETED if downloaded_count > 0 else JournalStatus.ERROR
            if downloaded_count == 0:
                journal.error_message = "No PDFs downloaded"
            self.db.commit()
            
            print(f"[✓] Parallel Download Done: {downloaded_count}/{total_count} PDFs saved for Journal #{journal.journal_number}")
            
            if progress_callback:
                progress_callback({
                    "step": "download_complete",
                    "journal_number": journal.journal_number,
                    "downloaded": downloaded_count,
                    "total": total_count,
                    "message": f"All {downloaded_count} PDFs downloaded successfully"
                })
                
        except Exception as e:
            journal.status = JournalStatus.ERROR
            journal.error_message = str(e)
            self.db.commit()
            print(f"[ERROR] Failed downloading PDFs for Journal #{journal.journal_number}: {str(e)}")
            if progress_callback:
                progress_callback({"step": "error", "message": str(e)})

    def _extract_class_range(self, link_text: str, index: int) -> str:
        """
        Extract class range from link text or generate from index
        """
        text = link_text.upper().strip()
        match = re.search(r'CLASS\s+(\d+)\s*-\s*(\d+)', text)
        if match:
            return f"Class {match.group(1)}-{match.group(2)}"
        
        match = re.search(r'(\d+)\s*-\s*(\d+)', text)
        if match:
            return f"Class {match.group(1)}-{match.group(2)}"
        
        return f"Part-{index + 1}"
