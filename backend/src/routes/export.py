"""
Excel export routes
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from ..config.database import get_db
from ..services.excel_exporter import ExcelExporter


router = APIRouter()


@router.get("/export/by-journal")
async def export_by_journal(
    journal_ids: Optional[str] = Query(None, description="Comma-separated journal IDs"),
    db: Session = Depends(get_db)
):
    """
    Export trademarks grouped by journal (one sheet per journal)
    
    Query params:
    - journal_ids: Optional comma-separated list of journal IDs (e.g., "1,2,3")
                   If not provided, exports all journals
    """
    exporter = ExcelExporter(db)
    
    # Parse journal IDs
    journal_id_list = None
    if journal_ids:
        journal_id_list = [int(id.strip()) for id in journal_ids.split(',')]
    
    # Generate Excel file
    excel_file = exporter.export_by_journal(journal_id_list)
    
    # Create filename with timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"trademarks_by_journal_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/all")
async def export_all_trademarks(
    journal_number: Optional[str] = None,
    class_number: Optional[int] = None,
    application_number: Optional[str] = None,
    office_location: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Export all trademarks to a single Excel sheet with optional filters
    
    Query params:
    - journal_number: Filter by journal number
    - class_number: Filter by class (1-99)
    - application_number: Filter by application number
    - office_location: Filter by office (MUMBAI, DELHI, etc.)
    - search: Search in trademark name or applicant name
    """
    exporter = ExcelExporter(db)
    
    # Build filters
    filters = {}
    if journal_number:
        filters['journal_number'] = journal_number
    if class_number:
        filters['class_number'] = class_number
    if application_number:
        filters['application_number'] = application_number
    if office_location:
        filters['office_location'] = office_location
    if search:
        filters['search'] = search
    
    # Generate Excel file
    excel_file = exporter.export_all_trademarks(filters)
    
    # Create filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"trademarks_all_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/journal/{journal_id}/by-pdf")
async def export_journal_by_pdf(
    journal_id: int,
    db: Session = Depends(get_db)
):
    """
    Export a specific journal with one sheet per PDF file
    
    Path params:
    - journal_id: Journal ID to export
    """
    exporter = ExcelExporter(db)
    
    # Generate Excel file
    try:
        excel_file = exporter.export_by_pdf(journal_id)
    except ValueError as e:
        return {"error": str(e)}
    
    # Get journal number for filename
    from ..models.models import Journal
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"journal_{journal.journal_number}_by_pdf_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
