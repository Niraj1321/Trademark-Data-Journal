"""
Application settings from environment variables
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "mysql+pymysql://root:password@localhost:3306/trademark_db"
    
    # Application
    SECRET_KEY: str = "your-secret-key-change-this"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Scraper
    SCRAPER_SCHEDULE_ENABLED: bool = True
    SCRAPER_SCHEDULE_DAY: str = "monday"
    SCRAPER_SCHEDULE_HOUR: int = 9
    SCRAPER_SCHEDULE_MINUTE: int = 0
    MAX_JOURNALS_TO_SCRAPE: int = 1  # Download 1 most recent journal
    
    # Download
    DOWNLOAD_DIR: str = "downloads"
    DOWNLOAD_TIMEOUT: int = 300
    
    # PDF Processing
    PDF_EXTRACTION_TIMEOUT: int = 600
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "app.log"
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    model_config = {
        "env_file": ".env",
        "extra": "ignore",
        "case_sensitive": True,
    }


settings = Settings()

