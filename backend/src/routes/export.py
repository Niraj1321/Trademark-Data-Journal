"""
Excel and ZIP export routes
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from ..config.database import get_db
from ..services.excel_exporter import ExcelExporter
from ..models.models import Journal


router = APIRouter()


@router.get("/export/by-journal")
async def export_by_journal(
    journal_ids: Optional[str] = Query(None, description="Comma-separated journal IDs"),
    format: str = Query("zip", description="Export format: 'zip' (with images) or 'xlsx' (excel only)"),
    db: Session = Depends(get_db)
):
    """
    Export trademarks grouped by journal (one sheet per journal)
    """
    exporter = ExcelExporter(db)
    
    # Parse journal IDs
    journal_id_list = None
    if journal_ids:
        journal_id_list = [int(id.strip()) for id in journal_ids.split(',')]
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if format.lower() == "xlsx":
        file_obj = exporter.export_by_journal(journal_id_list)
        filename = f"trademarks_by_journal_{timestamp}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        file_obj = exporter.export_by_journal_zip(journal_id_list)
        filename = f"trademarks_by_journal_{timestamp}.zip"
        media_type = "application/zip"
    
    return StreamingResponse(
        file_obj,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/all")
async def export_all_trademarks(
    journal_number: Optional[str] = None,
    class_number: Optional[int] = None,
    application_number: Optional[str] = None,
    office_location: Optional[str] = None,
    search: Optional[str] = None,
    format: str = Query("zip", description="Export format: 'zip' (with images) or 'xlsx' (excel only)"),
    db: Session = Depends(get_db)
):
    """
    Export all trademarks to a single Excel sheet or ZIP package (Excel + images) with optional filters
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
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if format.lower() == "xlsx":
        file_obj = exporter.export_all_trademarks(filters)
        filename = f"trademarks_all_{timestamp}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif format.lower() in ("images", "images_only"):
        file_obj = exporter.export_images_only_zip(filters)
        filename = f"trademark_images_{timestamp}.zip"
        media_type = "application/zip"
    else:
        file_obj = exporter.export_all_trademarks_zip(filters)
        filename = f"trademarks_all_{timestamp}.zip"
        media_type = "application/zip"
    
    return StreamingResponse(
        file_obj,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/journal/{journal_id}/by-pdf")
async def export_journal_by_pdf(
    journal_id: int,
    format: str = Query("zip", description="Export format: 'zip' (with images) or 'xlsx' (excel only)"),
    db: Session = Depends(get_db)
):
    """
    Export a specific journal with one sheet per PDF file
    """
    exporter = ExcelExporter(db)
    
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        return {"error": f"Journal {journal_id} not found"}
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if format.lower() == "xlsx":
        try:
            file_obj = exporter.export_by_pdf(journal_id)
        except ValueError as e:
            return {"error": str(e)}
        filename = f"journal_{journal.journal_number}_by_pdf_{timestamp}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        try:
            file_obj = exporter.export_by_pdf_zip(journal_id)
        except ValueError as e:
            return {"error": str(e)}
        filename = f"journal_{journal.journal_number}_by_pdf_{timestamp}.zip"
        media_type = "application/zip"
    
    return StreamingResponse(
        file_obj,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
