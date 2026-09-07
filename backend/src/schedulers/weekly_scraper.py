"""
Weekly scraper scheduler using APScheduler
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime

from ..config.settings import settings
from ..config.database import SessionLocal
from ..models.models import ExecutionType

scheduler = None


def scheduled_scrape_job():
    """
    Job function to run the scraper on schedule
    """
    print(f"\n[*] Scheduled scraper job started at {datetime.now()}")
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Import here to avoid circular imports
        from ..routes.scraper import run_scraper_sync
        
        # Run the scraper task synchronously (Python 3.13 compatible)
        run_scraper_sync(db, ExecutionType.SCHEDULED)
        
    except Exception as e:
        print(f"[!] Scheduled scraper job failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def start_scheduler():
    """
    Start the APScheduler background scheduler
    """
    global scheduler
    
    if scheduler is not None:
        print("[!] Scheduler already running")
        return
    
    scheduler = BackgroundScheduler()
    
    # Create cron trigger
    # Convert day name to cron format (mon=0, tue=1, ..., sun=6)
    day_map = {
        'monday': 0, 'tuesday': 1, 'wednesday': 2,
        'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6
    }
    
    day_of_week = day_map.get(settings.SCRAPER_SCHEDULE_DAY.lower(), 0)
    
    trigger = CronTrigger(
        day_of_week=day_of_week,
        hour=settings.SCRAPER_SCHEDULE_HOUR,
        minute=settings.SCRAPER_SCHEDULE_MINUTE,
        timezone='Asia/Kolkata'  # IST timezone
    )
    
    # Add job to scheduler
    scheduler.add_job(
        scheduled_scrape_job,
        trigger=trigger,
        id='trademark_scraper',
        name='Weekly Trademark Journal Scraper',
        replace_existing=True
    )
    
    scheduler.start()
    print(f"[+] Scheduler started - next run: {scheduler.get_jobs()[0].next_run_time}")


def stop_scheduler():
    """
    Stop the scheduler
    """
    global scheduler
    
    if scheduler is not None:
        scheduler.shutdown()
        scheduler = None
        print("[-] Scheduler stopped")
