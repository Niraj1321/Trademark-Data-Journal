"""
Pydantic schemas for API responses
"""
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List


# Journal Schemas
class JournalResponse(BaseModel):
    id: int
    journal_number: str
    publication_date: date
    availability_date: date
    pdf_count: int
    total_trademarks: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class JournalListResponse(BaseModel):
    journals: List[JournalResponse]
    total: int
    page: int
    limit: int
    pages: int


# Trademark Schemas
class TrademarkResponse(BaseModel):
    id: int
    application_number: Optional[str]
    filing_date: Optional[date]
    publication_date: Optional[date] = None
    journal_number: Optional[str] = None
    class_range: Optional[str] = None
    trademark_name: Optional[str]
    applicant_name: Optional[str]
    applicant_address: Optional[str]
    applicant_type: Optional[str]
    class_number: Optional[int]
    goods_services: Optional[str]
    attorney_name: Optional[str]
    attorney_address: Optional[str]
    used_since: Optional[str]
    associated_with: Optional[str]
    office_location: Optional[str]
    page_number: Optional[int]
    journal_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class TrademarkListResponse(BaseModel):
    trademarks: List[TrademarkResponse]
    total: int
    page: int
    limit: int
    pages: int


# Scraper Schemas
class ScraperLogResponse(BaseModel):
    id: int
    execution_date: datetime
    execution_type: str
    status: str
    journals_found: int
    journals_scraped: int
    pdfs_downloaded: int
    records_extracted: int
    error_message: Optional[str]
    execution_time_seconds: Optional[int]
    
    class Config:
        from_attributes = True


class ScraperStatusResponse(BaseModel):
    last_execution: Optional[ScraperLogResponse]
    total_journals: int
    total_pdfs: int
    total_trademarks: int
    scheduler_enabled: bool
    schedule: str
