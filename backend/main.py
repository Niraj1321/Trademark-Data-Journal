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
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    print("[+] Database tables created/verified")
    
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(journals.router, prefix="/api/journals", tags=["Journals"])
app.include_router(trademarks.router, prefix="/api/trademarks", tags=["Trademarks"])
app.include_router(scraper.router, prefix="/api/scraper", tags=["Scraper"])
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(export.router, prefix="/api", tags=["Export"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Trademark Journal Scraper API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
