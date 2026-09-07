"""
Database models for trademark journal system
"""
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Enum, ForeignKey, BigInteger, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from ..config.database import Base


class JournalStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class ExtractionStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class ExecutionType(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    MANUAL = "MANUAL"


class ExecutionStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    PARTIAL = "PARTIAL"


class Journal(Base):
    __tablename__ = "journals"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    journal_number = Column(String(50), unique=True, nullable=False, index=True)
    publication_date = Column(Date, nullable=False, index=True)
    availability_date = Column(Date, nullable=False)
    scrape_date = Column(DateTime, default=datetime.utcnow)
    pdf_count = Column(Integer, default=0)
    total_trademarks = Column(Integer, default=0)
    status = Column(Enum(JournalStatus), default=JournalStatus.PENDING, index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pdf_files = relationship("PDFFile", back_populates="journal", cascade="all, delete-orphan")
    trademarks = relationship("TrademarkApplication", back_populates="journal", cascade="all, delete-orphan")


class PDFFile(Base):
    __tablename__ = "pdf_files"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    journal_id = Column(Integer, ForeignKey("journals.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    class_range = Column(String(50), nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    download_url = Column(Text, nullable=True)
    download_date = Column(DateTime, nullable=True)
    extraction_status = Column(Enum(ExtractionStatus), default=ExtractionStatus.PENDING, index=True)
    extraction_date = Column(DateTime, nullable=True)
    records_extracted = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    journal = relationship("Journal", back_populates="pdf_files")
    trademarks = relationship("TrademarkApplication", back_populates="pdf_file", cascade="all, delete-orphan")


class TrademarkApplication(Base):
    __tablename__ = "trademark_applications"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    pdf_file_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False)
    journal_id = Column(Integer, ForeignKey("journals.id", ondelete="CASCADE"), nullable=False, index=True)
    application_number = Column(String(100), index=True)
    filing_date = Column(Date, nullable=True, index=True)
    trademark_name = Column(String(500), index=True)
    applicant_name = Column(String(500), index=True)
    applicant_address = Column(Text, nullable=True)
    applicant_type = Column(String(200), nullable=True)
    class_number = Column(Integer, index=True)
    goods_services = Column(Text, nullable=True)
    attorney_name = Column(String(500), nullable=True)
    attorney_address = Column(Text, nullable=True)
    used_since = Column(String(100), nullable=True)
    associated_with = Column(String(200), nullable=True)
    office_location = Column(String(200), nullable=True)  # Increased from 100 to 200
    page_number = Column(Integer, nullable=True)
    raw_text = Column(Text(16777215), nullable=True)  # MEDIUMTEXT - up to 16MB
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pdf_file = relationship("PDFFile", back_populates="trademarks")
    journal = relationship("Journal", back_populates="trademarks")

    @property
    def publication_date(self):
        return self.journal.publication_date if self.journal else None

    @property
    def journal_number(self):
        return self.journal.journal_number if self.journal else None

    @property
    def class_range(self):
        return self.pdf_file.class_range if self.pdf_file else None


class ScraperLog(Base):
    __tablename__ = "scraper_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    execution_date = Column(DateTime, default=datetime.utcnow, index=True)
    execution_type = Column(Enum(ExecutionType), default=ExecutionType.SCHEDULED)
    status = Column(Enum(ExecutionStatus), nullable=False, index=True)
    journals_found = Column(Integer, default=0)
    journals_scraped = Column(Integer, default=0)
    pdfs_downloaded = Column(Integer, default=0)
    records_extracted = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    execution_time_seconds = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
