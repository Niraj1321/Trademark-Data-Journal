"""
Fast Migration and Backfill Script for Trademark Images
Extracts logo images from all downloaded PDFs and updates the database.
"""
import os
import io
import re
import time
from pathlib import Path
from PIL import Image
import pymupdf as fitz
from sqlalchemy import text
from src.config.database import engine, SessionLocal
from src.models.models import Journal, PDFFile, TrademarkApplication
from src.config.settings import settings


import sys
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def ensure_column_exists():
    """Ensure image_path column exists in trademark_applications table"""
    print("[1/3] [*] Verifying database schema...")
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text("SHOW COLUMNS FROM trademark_applications LIKE 'image_path'")).fetchone()
            if not result:
                print("   -> Adding 'image_path' column to trademark_applications table...")
                conn.execute(text("ALTER TABLE trademark_applications ADD COLUMN image_path VARCHAR(500) NULL AFTER page_number"))
                conn.commit()
                print("   [+] Column 'image_path' successfully added!")
            else:
                print("   [+] Column 'image_path' already exists in database.")
        except Exception as e:
            print(f"   [-] Schema check notice: {e}")


def backfill_trademark_images():
    """Extract trademark images from all downloaded PDFs and link them to DB"""
    db = SessionLocal()
    try:
        ensure_column_exists()
        
        pdf_files = db.query(PDFFile).all()
        print(f"\n[2/3] [*] Found {len(pdf_files)} PDF files in database.")
        
        total_extracted = 0
        total_updated = 0
        
        for idx, pdf_file in enumerate(pdf_files, 1):
            file_path = pdf_file.file_path
            if not file_path or not Path(file_path).exists():
                print(f"   [{idx}/{len(pdf_files)}] [!] File not found on disk: {file_path}")
                continue
                
            journal = pdf_file.journal
            journal_no = str(journal.journal_number) if journal else str(pdf_file.journal_id)
            
            images_dir = Path(settings.DOWNLOAD_DIR) / "images" / journal_no
            images_dir.mkdir(parents=True, exist_ok=True)
            
            print(f"\n   [{idx}/{len(pdf_files)}] [>] Processing {pdf_file.file_name} (Journal #{journal_no})...")
            
            try:
                doc = fitz.open(file_path)
            except Exception as e:
                print(f"   [-] Could not open PDF {file_path}: {e}")
                continue
                
            t0 = time.time()
            pdf_extracted = 0
            
            # Fetch all existing trademarks for this PDF file for fast in-memory lookup
            tms_by_app = {}
            tms_by_page = {}
            existing_tms = db.query(TrademarkApplication).filter(
                TrademarkApplication.pdf_file_id == pdf_file.id
            ).all()
            
            for tm in existing_tms:
                if tm.application_number:
                    tms_by_app[tm.application_number] = tm
                if tm.page_number:
                    tms_by_page[tm.page_number] = tm
                    
            for pno in range(len(doc)):
                page_num = pno + 1
                try:
                    page = doc.load_page(pno)
                    imgs = page.get_images()
                    if not imgs:
                        continue
                        
                    # Find corresponding application number
                    app_num = None
                    tm_record = tms_by_page.get(page_num)
                    if tm_record:
                        app_num = tm_record.application_number
                    else:
                        text_content = page.get_text()
                        m = re.search(r'(\b\d{7,10}\b)\s+(\d{2}/\d{2}/\d{4})', text_content)
                        if m:
                            app_num = m.group(1)
                            tm_record = tms_by_app.get(app_num)
                            
                    if not app_num:
                        app_num = f"page_{page_num}"
                        
                    # Extract image bytes
                    xref = imgs[0][0]
                    base_img = doc.extract_image(xref)
                    img_bytes = base_img.get("image")
                    
                    if img_bytes:
                        pil_img = Image.open(io.BytesIO(img_bytes))
                        if pil_img.mode in ('RGBA', 'LA') or (pil_img.mode == 'P' and 'transparency' in pil_img.info):
                            bg = Image.new('RGB', pil_img.size, (255, 255, 255))
                            if pil_img.mode == 'P':
                                pil_img = pil_img.convert('RGBA')
                            bg.paste(pil_img, mask=pil_img.split()[3])
                            pil_img = bg
                        elif pil_img.mode != 'RGB':
                            pil_img = pil_img.convert('RGB')
                            
                        app_num_clean = re.sub(r'[^\w\-]', '_', str(app_num))
                        img_filename = f"{app_num_clean}.jpg"
                        target_file = images_dir / img_filename
                        pil_img.save(target_file, "JPEG", quality=92, optimize=True)
                        
                        rel_path = f"images/{journal_no}/{img_filename}"
                        if tm_record and tm_record.image_path != rel_path:
                            tm_record.image_path = rel_path
                            total_updated += 1
                            
                        pdf_extracted += 1
                        total_extracted += 1
                except Exception as err:
                    continue
                    
            doc.close()
            db.commit()
            elapsed = time.time() - t0
            print(f"   -> Extracted {pdf_extracted} images in {elapsed:.2f}s [+]")
            
        print(f"\n========================================================")
        print(f" [3/3] [+] Extraction Complete!")
        print(f"   * Total Images Saved: {total_extracted:,}")
        print(f"   * Database Records Linked: {total_updated:,}")
        print(f"========================================================")
        
    finally:
        db.close()


if __name__ == "__main__":
    backfill_trademark_images()
