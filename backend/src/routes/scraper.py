"""
Scraper control API routes
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Generator
from pathlib import Path
import asyncio
import json
from concurrent.futures import ThreadPoolExecutor

from ..config.database import get_db
from ..models.models import Journal, PDFFile, TrademarkApplication, ScraperLog, ExecutionType, ExecutionStatus, ExtractionStatus
from ..services.scraper_service import TrademarkScraper
from ..services.pdf_extractor_service import PDFExtractor
from ..config.settings import settings
from .schemas import ScraperLogResponse, ScraperStatusResponse


router = APIRouter()

# Thread pool for running sync Playwright in background
executor = ThreadPoolExecutor(max_workers=1)


def run_scraper_sync(db: Session, execution_type: ExecutionType = ExecutionType.MANUAL):
    """
    Synchronous scraper task (for Python 3.13 compatibility)
    """
    start_time = datetime.utcnow()
    log_entry = ScraperLog(
        execution_type=execution_type,
        status=ExecutionStatus.SUCCESS
    )
    
    try:
        # Initialize scraper
        scraper = TrademarkScraper(db)
        extractor = PDFExtractor(db)
        
        # Scrape journals (now synchronous)
        journals = scraper.scrape_latest_journals(
            max_journals=settings.MAX_JOURNALS_TO_SCRAPE
        )
        
        log_entry.journals_found = len(journals)
        log_entry.journals_scraped = len([j for j in journals if j.pdf_count > 0])
        
        # Count downloaded PDFs
        total_pdfs = sum(j.pdf_count for j in journals)
        log_entry.pdfs_downloaded = total_pdfs
        
        # Extract data from PDFs
        extraction_stats = extractor.extract_all_pending()
        log_entry.records_extracted = extraction_stats['records']
        
        # Update journal totals
        for journal in journals:
            from ..models.models import TrademarkApplication
            trademark_count = db.query(TrademarkApplication)\
                .filter(TrademarkApplication.journal_id == journal.id)\
                .count()
            journal.total_trademarks = trademark_count
        
        db.commit()
        
        # Calculate execution time
        end_time = datetime.utcnow()
        log_entry.execution_time_seconds = int((end_time - start_time).total_seconds())
        
        log_entry.details = {
            "extraction_stats": extraction_stats,
            "journals": [j.journal_number for j in journals]
        }
        
        print(f"[OK] Scraper completed successfully")
        print(f"   Journals: {log_entry.journals_found}")
        print(f"   PDFs: {log_entry.pdfs_downloaded}")
        print(f"   Records: {log_entry.records_extracted}")
        
    except Exception as e:
        log_entry.status = ExecutionStatus.FAILURE
        log_entry.error_message = str(e)
        print(f"[ERROR] Scraper failed: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        db.add(log_entry)
        db.commit()


async def run_scraper_task(db: Session, execution_type: ExecutionType = ExecutionType.MANUAL):
    """
    Background task wrapper to run sync scraper in thread pool
    """
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(executor, run_scraper_sync, db, execution_type)


@router.get("/stream")
@router.post("/stream")
async def stream_full_scraper(db: Session = Depends(get_db)):
    """
    Run full scraper (portal fetch -> parallel download -> fast extraction) with live SSE stream
    """
    import queue
    import threading

    def event_generator():
        q = queue.Queue()

        def callback(data):
            q.put(data)

        def worker():
            try:
                callback({"type": "start", "message": "Initiating high-speed scraper..."})
                
                scraper = TrademarkScraper(db)
                extractor = PDFExtractor(db)
                
                journals = scraper.scrape_latest_journals(
                    max_journals=settings.MAX_JOURNALS_TO_SCRAPE,
                    progress_callback=callback
                )
                
                # Fast Extract
                extraction_stats = extractor.extract_all_pending(progress_callback=callback)
                
                # Update journal totals
                for journal in journals:
                    count = db.query(TrademarkApplication)\
                        .filter(TrademarkApplication.journal_id == journal.id)\
                        .count()
                    journal.total_trademarks = count
                db.commit()
                
                total_pdfs = sum(j.pdf_count for j in journals)
                records_count = extraction_stats.get('records', 0)
                
                callback({
                    "type": "complete",
                    "step": "all_complete",
                    "journals": len(journals),
                    "pdfs": total_pdfs,
                    "records": records_count,
                    "message": f"Scraping & extraction completed! {len(journals)} journal, {total_pdfs} PDFs, {records_count:,} trademarks."
                })
            except Exception as err:
                callback({"type": "error", "message": str(err)})
            finally:
                q.put(None)  # Sentinel to finish

        t = threading.Thread(target=worker)
        t.start()

        while True:
            try:
                item = q.get(timeout=120)
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
            except queue.Empty:
                yield f"data: {json.dumps({'type': 'ping', 'message': 'Processing...'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/download-pdfs")
async def download_pdfs_only(db: Session = Depends(get_db)):
    """
    Download PDFs only (no extraction) with real-time progress via SSE
    """
    import queue
    import threading

    def generate_download_progress() -> Generator:
        q = queue.Queue()

        def callback(data):
            q.put(data)

        def worker():
            try:
                scraper = TrademarkScraper(db)
                journals = scraper.scrape_latest_journals(
                    max_journals=settings.MAX_JOURNALS_TO_SCRAPE,
                    progress_callback=callback
                )
                
                total_journals = len(journals)
                total_pdfs = sum(j.pdf_count for j in journals)
                
                callback({
                    "type": "complete",
                    "step": "download_complete",
                    "journals": total_journals,
                    "pdfs": total_pdfs,
                    "message": f"Successfully downloaded {total_pdfs} PDFs from {total_journals} journal(s)"
                })
            except Exception as e:
                callback({"type": "error", "message": str(e)})
            finally:
                q.put(None)

        t = threading.Thread(target=worker)
        t.start()

        while True:
            try:
                item = q.get(timeout=120)
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
            except queue.Empty:
                yield f"data: {json.dumps({'type': 'ping', 'message': 'Downloading...'})}\n\n"

    return StreamingResponse(
        generate_download_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/extract-pdfs")
async def extract_pdfs_only(db: Session = Depends(get_db)):
    """
    Extract data from PDFs only (assumes PDFs already downloaded) with real-time progress
    """
    import queue
    import threading

    def generate_extraction_progress() -> Generator:
        q = queue.Queue()

        def callback(data):
            q.put(data)

        def worker():
            try:
                extractor = PDFExtractor(db)
                
                extraction_stats = extractor.extract_all_pending(progress_callback=callback)
                
                # Update journal totals
                journals = db.query(Journal).all()
                for journal in journals:
                    trademark_count = db.query(TrademarkApplication)\
                        .filter(TrademarkApplication.journal_id == journal.id)\
                        .count()
                    journal.total_trademarks = trademark_count
                
                db.commit()
                
                records_count = extraction_stats.get('records', 0)
                pdfs_processed = extraction_stats.get('pdfs_processed', 0)
                
                callback({
                    "type": "complete",
                    "step": "extract_complete",
                    "records": records_count,
                    "pdfs_processed": pdfs_processed,
                    "message": f"Extracted {records_count:,} trademarks from {pdfs_processed} PDFs"
                })
            except Exception as e:
                callback({"type": "error", "message": str(e)})
            finally:
                q.put(None)

        t = threading.Thread(target=worker)
        t.start()

        while True:
            try:
                item = q.get(timeout=120)
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
            except queue.Empty:
                yield f"data: {json.dumps({'type': 'ping', 'message': 'Extracting...'})}\n\n"

    return StreamingResponse(
        generate_extraction_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/run")
async def trigger_scraper(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Manually trigger the scraper (download + extraction)
    """
    background_tasks.add_task(run_scraper_task, db, ExecutionType.MANUAL)
    
    return {
        "message": "Scraper started in background",
        "status": "running"
    }


@router.get("/status", response_model=ScraperStatusResponse)
async def get_scraper_status(db: Session = Depends(get_db)):
    """
    Get current scraper status
    """
    # Get last execution
    last_execution = db.query(ScraperLog)\
        .order_by(ScraperLog.execution_date.desc())\
        .first()
    
    # Get statistics
    from ..models.models import Journal, PDFFile, TrademarkApplication
    
    total_journals = db.query(Journal).count()
    total_pdfs = db.query(PDFFile).count()
    total_trademarks = db.query(TrademarkApplication).count()
    
    return {
        "last_execution": last_execution,
        "total_journals": total_journals,
        "total_pdfs": total_pdfs,
        "total_trademarks": total_trademarks,
        "scheduler_enabled": settings.SCRAPER_SCHEDULE_ENABLED,
        "schedule": f"Every {settings.SCRAPER_SCHEDULE_DAY} at {settings.SCRAPER_SCHEDULE_HOUR}:{settings.SCRAPER_SCHEDULE_MINUTE:02d}"
    }


@router.get("/logs", response_model=List[ScraperLogResponse])
async def get_scraper_logs(
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get scraper execution logs
    """
    logs = db.query(ScraperLog)\
        .order_by(ScraperLog.execution_date.desc())\
        .limit(limit)\
        .all()
    
    return logs


@router.delete("/cleanup")
async def cleanup_all_data(db: Session = Depends(get_db)):
    """
    Delete all records from database and downloaded PDF files
    ⚠️ WARNING: This will permanently delete all data!
    """
    import shutil
    from ..models.models import Journal, PDFFile, TrademarkApplication
    
    try:
        # 1. Delete all database records (CASCADE will handle related records)
        deleted_trademarks = db.query(TrademarkApplication).delete()
        deleted_pdfs = db.query(PDFFile).delete()
        deleted_journals = db.query(Journal).delete()
        deleted_logs = db.query(ScraperLog).delete()
        
        db.commit()
        
        # 2. Delete all downloaded PDF files
        download_dir = Path(settings.DOWNLOAD_DIR)
        deleted_files = 0
        if download_dir.exists():
            for item in download_dir.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                    deleted_files += len(list(item.glob("*.pdf")))
                elif item.suffix == '.pdf':
                    item.unlink()
                    deleted_files += 1
        
        return {
            "message": "All data cleaned up successfully",
            "deleted": {
                "trademarks": deleted_trademarks,
                "pdfs": deleted_pdfs,
                "journals": deleted_journals,
                "logs": deleted_logs,
                "files": deleted_files
            }
        }
        
    except Exception as e:
        db.rollback()
        return {
            "message": "Error during cleanup",
            "error": str(e)
        }
