"""
Main FastAPI application entry point
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from src.config.database import engine, Base
from src.config.settings import settings
from src.routes import journals, trademarks, scraper, stats, export
from src.schedulers.weekly_scraper import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown events
    """
    # Startup
    print("[+] Starting Trademark Journal Scraper API...")
    
    # Create database tables and ensure schema columns exist
    try:
        Base.metadata.create_all(bind=engine)
        print("[+] Database tables created/verified")
        
        # Auto-migrate schema on startup for cloud databases
        from sqlalchemy import text
        with engine.connect() as conn:
            try:
                col_check = conn.execute(text("SHOW COLUMNS FROM trademark_applications LIKE 'image_path'")).fetchone()
                if not col_check:
                    print("[+] Adding missing 'image_path' column to trademark_applications...")
                    conn.execute(text("ALTER TABLE trademark_applications ADD COLUMN image_path VARCHAR(500) NULL AFTER page_number"))
                    conn.commit()
                    print("[+] Column 'image_path' added successfully!")
                else:
                    print("[+] Schema verified: 'image_path' column exists.")
            except Exception as schema_err:
                print(f"[-] Schema migration notice: {schema_err}")
                
        # Auto-clean contaminated records on startup
        try:
            from src.config.database import SessionLocal
            from src.models.models import TrademarkApplication
            from src.services.pdf_extractor_service import PDFExtractor
            
            db_init = SessionLocal()
            try:
                corrupted_count = db_init.query(TrademarkApplication).filter(
                    (TrademarkApplication.trademark_name.like('Priority claimed%')) |
                    (TrademarkApplication.trademark_name.like('Application No%')) |
                    (TrademarkApplication.applicant_name.like('[International%'))
                ).count()
                
                if corrupted_count > 0:
                    print(f"[+] Found {corrupted_count} legacy corrupted records. Auto-repairing...")
                    extractor = PDFExtractor(db_init)
                    corrupted = db_init.query(TrademarkApplication).filter(
                        (TrademarkApplication.trademark_name.like('Priority claimed%')) |
                        (TrademarkApplication.trademark_name.like('Application No%')) |
                        (TrademarkApplication.applicant_name.like('[International%'))
                    ).all()
                    for tm in corrupted:
                        if tm.raw_text:
                            parsed = extractor._parse_page_text(tm.raw_text, tm.page_number or 1)
                            if parsed:
                                tm.trademark_name = parsed["trademark_name"]
                                tm.applicant_name = parsed["applicant_name"]
                                tm.applicant_address = parsed["applicant_address"]
                                tm.applicant_type = parsed["applicant_type"]
                                if parsed.get("class_number"):
                                    tm.class_number = parsed["class_number"]
                                if parsed.get("associated_with"):
                                    tm.associated_with = parsed["associated_with"]
                                if parsed.get("used_since"):
                                    tm.used_since = parsed["used_since"]
                                if parsed.get("goods_services"):
                                    tm.goods_services = parsed["goods_services"]
                                if parsed.get("office_location"):
                                    tm.office_location = parsed["office_location"]
                    db_init.commit()
                    print(f"[✓] Repaired {corrupted_count} trademark records successfully!")
                
                # Auto-repair any missing applicant addresses
                no_addr = db_init.query(TrademarkApplication).filter(
                    (TrademarkApplication.applicant_address == None) | (TrademarkApplication.applicant_address == '')
                ).all()
                if no_addr:
                    print(f"[+] Found {len(no_addr)} records with missing applicant address. Repairing...")
                    extractor = PDFExtractor(db_init)
                    fixed_addr = 0
                    for tm in no_addr:
                        if tm.raw_text:
                            parsed = extractor._parse_page_text(tm.raw_text, tm.page_number or 1)
                            if parsed and parsed.get("applicant_address"):
                                tm.applicant_address = parsed["applicant_address"]
                                if parsed.get("applicant_type"):
                                    tm.applicant_type = parsed["applicant_type"]
                                fixed_addr += 1
                    db_init.commit()
                    print(f"[✓] Repaired {fixed_addr} applicant addresses successfully!")
            except Exception as e_clean:
                db_init.rollback()
                print(f"[-] Auto-clean notice: {e_clean}")
            finally:
                db_init.close()
        except Exception:
            pass
    except Exception as e:
        print(f"[-] Warning: Database initialization failed: {e}")
        print("[-] Server will continue running, but database features may fail until connection is fixed.")
    
    # Start scheduler if enabled
    if settings.SCRAPER_SCHEDULE_ENABLED:
        start_scheduler()
        print(f"[+] Scheduler started - runs every {settings.SCRAPER_SCHEDULE_DAY} at {settings.SCRAPER_SCHEDULE_HOUR}:{settings.SCRAPER_SCHEDULE_MINUTE:02d}")
    
    yield
    
    # Shutdown
    print("[-] Shutting down...")
    if settings.SCRAPER_SCHEDULE_ENABLED:
        stop_scheduler()
        print("[-] Scheduler stopped")


# Create FastAPI app
app = FastAPI(
    title="Trademark Journal Scraper API",
    description="API for scraping and managing India's Trademark Journal data",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - allows all origins, headers and methods
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?:\/\/.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

from pathlib import Path
from fastapi.staticfiles import StaticFiles

# Create downloads directory if not exists
downloads_path = Path(settings.DOWNLOAD_DIR)
downloads_path.mkdir(parents=True, exist_ok=True)
(downloads_path / "images").mkdir(parents=True, exist_ok=True)

# Mount static downloads directory for images & PDFs
app.mount("/downloads", StaticFiles(directory=str(downloads_path)), name="downloads")

# Include routers
app.include_router(journals.router, prefix="/api/journals", tags=["Journals"])
app.include_router(trademarks.router, prefix="/api/trademarks", tags=["Trademarks"])
app.include_router(scraper.router, prefix="/api/scraper", tags=["Scraper"])
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(export.router, prefix="/api", tags=["Export"])


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    """Root endpoint"""
    return {
        "message": "Trademark Journal Scraper API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/api/migrate-db")
async def run_db_migration():
    """Run database schema migration on the active database"""
    results = []
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # 1. Check trademark_applications columns
            col_rows = conn.execute(text("SHOW COLUMNS FROM trademark_applications")).fetchall()
            cols = [r[0] for r in col_rows]
            results.append({"existing_columns": cols})
            
            # 2. Add image_path if missing
            if "image_path" not in cols:
                conn.execute(text("ALTER TABLE trademark_applications ADD COLUMN image_path VARCHAR(500) NULL AFTER page_number"))
                conn.commit()
                results.append({"action": "added image_path column"})
            else:
                results.append({"action": "image_path already exists"})
                
            # 3. Check office_location column length
            conn.execute(text("ALTER TABLE trademark_applications MODIFY COLUMN office_location VARCHAR(200) NULL"))
            conn.commit()
            results.append({"action": "verified office_location column"})
                
            # 4. Auto-clean existing contaminated trademark records (Priority claimed / International Reg headers)
            from src.config.database import SessionLocal
            from src.models.models import TrademarkApplication
            from src.services.pdf_extractor_service import PDFExtractor
            
            db = SessionLocal()
            try:
                extractor = PDFExtractor(db)
                contaminated = db.query(TrademarkApplication).filter(
                    (TrademarkApplication.trademark_name.like('Priority claimed%')) |
                    (TrademarkApplication.trademark_name.like('Application No%')) |
                    (TrademarkApplication.trademark_name.like(';%')) |
                    (TrademarkApplication.applicant_name.like('[International%')) |
                    (TrademarkApplication.applicant_name.like('International Registration%'))
                ).all()
                
                cleaned_records = []
                for tm in contaminated:
                    if tm.raw_text:
                        parsed = extractor._parse_page_text(tm.raw_text, tm.page_number or 1)
                        if parsed:
                            tm.trademark_name = parsed["trademark_name"]
                            tm.applicant_name = parsed["applicant_name"]
                            tm.applicant_address = parsed["applicant_address"]
                            tm.applicant_type = parsed["applicant_type"]
                            if parsed.get("class_number"):
                                tm.class_number = parsed["class_number"]
                            if parsed.get("associated_with"):
                                tm.associated_with = parsed["associated_with"]
                            if parsed.get("used_since"):
                                tm.used_since = parsed["used_since"]
                            if parsed.get("goods_services"):
                                tm.goods_services = parsed["goods_services"]
                            if parsed.get("office_location"):
                                tm.office_location = parsed["office_location"]
                                
                            cleaned_records.append({
                                "id": tm.id,
                                "app_no": tm.application_number,
                                "fixed_name": tm.trademark_name,
                                "applicant": tm.applicant_name,
                                "class": tm.class_number
                            })
                    
                db.commit()
                results.append({"action": f"Cleaned {len(cleaned_records)} corrupted trademark records", "cleaned": cleaned_records[:10]})
                
                # Check missing addresses
                no_addr_recs = db.query(TrademarkApplication).filter(
                    (TrademarkApplication.applicant_address == None) | (TrademarkApplication.applicant_address == '')
                ).all()
                fixed_addr_count = 0
                for tm in no_addr_recs:
                    if tm.raw_text:
                        parsed = extractor._parse_page_text(tm.raw_text, tm.page_number or 1)
                        if parsed and parsed.get("applicant_address"):
                            tm.applicant_address = parsed["applicant_address"]
                            if parsed.get("applicant_type"):
                                tm.applicant_type = parsed["applicant_type"]
                            fixed_addr_count += 1
                db.commit()
                results.append({"action": f"Repaired {fixed_addr_count} missing applicant addresses"})
                
                # Backfill wordmark images
                no_img_recs = db.query(TrademarkApplication).filter(
                    (TrademarkApplication.image_path == None) | (TrademarkApplication.image_path == '')
                ).all()
                import re
                from pathlib import Path
                from src.models.models import Journal
                download_dir = Path(settings.DOWNLOAD_DIR)
                fixed_img_count = 0
                for tm in no_img_recs:
                    journal_no = str(tm.journal.journal_number) if tm.journal and tm.journal.journal_number else 'general'
                    images_dir = download_dir / 'images' / journal_no
                    images_dir.mkdir(parents=True, exist_ok=True)
                    app_clean = re.sub(r'[^\w\-]', '_', str(tm.application_number))
                    img_name = f'{app_clean}.jpg'
                    target_img = images_dir / img_name
                    if not target_img.exists():
                        try:
                            img = extractor._generate_wordmark_image(
                                trademark_name=tm.trademark_name or 'WORD MARK',
                                app_number=str(tm.application_number),
                                class_number=tm.class_number
                            )
                            img.save(target_img, 'JPEG', quality=92, optimize=True)
                        except Exception:
                            pass
                    tm.image_path = f'images/{journal_no}/{img_name}'
                    fixed_img_count += 1
                db.commit()
                results.append({"action": f"Backfilled {fixed_img_count} wordmark images"})
            except Exception as clean_err:
                db.rollback()
                results.append({"cleanup_error": str(clean_err)})
            finally:
                db.close()
                
            # 5. Verify count query
            tm_count = conn.execute(text("SELECT count(*) FROM trademark_applications")).scalar()
            results.append({"total_trademarks": tm_count})
            
        return {"status": "success", "results": results}
    except Exception as e:
        return {"status": "error", "error": str(e), "results": results}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
