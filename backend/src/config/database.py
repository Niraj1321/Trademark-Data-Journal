"""
Database configuration and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from .settings import settings

import ssl
import urllib.parse

# Ensure proper driver is used in connection URL
db_url = settings.DATABASE_URL
if db_url.startswith("mysql://"):
    db_url = db_url.replace("mysql://", "mysql+pymysql://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Clean query parameters that PyMySQL doesn't support natively as query args
connect_args = {}
try:
    parsed = urllib.parse.urlparse(db_url)
    if parsed.query:
        query_dict = urllib.parse.parse_qs(parsed.query)
        needs_ssl = False
        
        for key in list(query_dict.keys()):
            if key.lower() in ["ssl-mode", "ssl_mode", "sslmode", "ssl"]:
                needs_ssl = True
                del query_dict[key]
        
        # If cloud DB requires SSL, setup SSLContext for PyMySQL
        if needs_ssl or (parsed.hostname and parsed.hostname not in ["localhost", "127.0.0.1"]):
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            connect_args["ssl"] = ssl_ctx
            
        # Rebuild clean URL without invalid kwargs
        clean_query = urllib.parse.urlencode(query_dict, doseq=True)
        db_url = urllib.parse.urlunparse(parsed._replace(query=clean_query))
    elif parsed.hostname and parsed.hostname not in ["localhost", "127.0.0.1"]:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx
except Exception as e:
    print(f"[-] Database URL parsing notice: {e}")

# Create database engine
engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# Dependency to get database session
def get_db():
    """
    Database session dependency for FastAPI routes
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
