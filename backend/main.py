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
                
            # 4. Verify count query
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
