"""
Statistics API routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..config.database import get_db
from ..models.models import Journal, PDFFile, TrademarkApplication, ExtractionStatus


router = APIRouter()


@router.get("")
async def get_statistics(db: Session = Depends(get_db)):
    """
    Get dashboard statistics
    """
    # Basic counts
    total_journals = db.query(Journal).count()
    total_pdfs = db.query(PDFFile).count()
    total_trademarks = db.query(TrademarkApplication).count()
    pending_pdfs = db.query(PDFFile).filter(PDFFile.extraction_status == ExtractionStatus.PENDING).count()
    
    # Latest journal
    latest_journal = db.query(Journal)\
        .order_by(Journal.publication_date.desc())\
        .first()
    
    latest_journal_data = None
    if latest_journal:
        pdf_count = db.query(PDFFile).filter(PDFFile.journal_id == latest_journal.id).count()
        latest_journal_data = {
            "id": latest_journal.id,
            "journal_number": latest_journal.journal_number,
            "publication_date": str(latest_journal.publication_date) if latest_journal.publication_date else None,
            "availability_date": str(latest_journal.availability_date) if latest_journal.availability_date else None,
            "pdf_count": pdf_count,
            "total_trademarks": latest_journal.total_trademarks or 0
        }
        
    # Recent scraped trademarks (latest 6)
    recent_trademarks = db.query(TrademarkApplication)\
        .options(joinedload(TrademarkApplication.journal))\
        .order_by(TrademarkApplication.id.desc())\
        .limit(6)\
        .all()
    
    recent_trademarks_data = [
        {
            "id": tm.id,
            "trademark_name": tm.trademark_name,
            "application_number": tm.application_number,
            "applicant_name": tm.applicant_name,
            "class_number": tm.class_number,
            "publication_date": str(tm.journal.publication_date) if tm.journal and tm.journal.publication_date else None,
            "office_location": tm.office_location
        }
        for tm in recent_trademarks
    ]
    
    # Class distribution
    class_distribution = db.query(
        TrademarkApplication.class_number,
        func.count(TrademarkApplication.id).label('count')
    )\
        .filter(TrademarkApplication.class_number.isnot(None))\
        .group_by(TrademarkApplication.class_number)\
        .order_by(TrademarkApplication.class_number)\
        .all()
    
    # Recent journals
    recent_journals = db.query(Journal)\
        .order_by(Journal.publication_date.desc())\
        .limit(5)\
        .all()
    
    # Top applicants
    top_applicants = db.query(
        TrademarkApplication.applicant_name,
        func.count(TrademarkApplication.id).label('count')
    )\
        .filter(TrademarkApplication.applicant_name.isnot(None))\
        .group_by(TrademarkApplication.applicant_name)\
        .order_by(func.count(TrademarkApplication.id).desc())\
        .limit(10)\
        .all()
    
    # Office distribution
    office_distribution = db.query(
        TrademarkApplication.office_location,
        func.count(TrademarkApplication.id).label('count')
    )\
        .filter(TrademarkApplication.office_location.isnot(None))\
        .group_by(TrademarkApplication.office_location)\
        .all()
    
    return {
        "summary": {
            "total_journals": total_journals,
            "total_pdfs": total_pdfs,
            "total_trademarks": total_trademarks,
            "pending_pdfs": pending_pdfs
        },
        "latest_journal": latest_journal_data,
        "recent_trademarks": recent_trademarks_data,
        "class_distribution": [
            {"class": item[0], "count": item[1]}
            for item in class_distribution
        ],
        "office_distribution": [
            {"office": item[0], "count": item[1]}
            for item in office_distribution
        ],
        "recent_journals": [
            {
                "id": j.id,
                "journal_number": j.journal_number,
                "publication_date": str(j.publication_date) if j.publication_date else None,
                "trademark_count": j.total_trademarks
            }
            for j in recent_journals
        ],
        "top_applicants": [
            {"name": item[0], "count": item[1]}
            for item in top_applicants
        ]
    }
