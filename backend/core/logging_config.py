"""
Centralized logging configuration for Stock Analyzer backend.

Rules:
  - All loggers: WARNING and above (reduces noise)
  - All loggers: ERROR and above always shown (never suppress)
  - Timestamps in every line: 2026-03-05 23:15:00,123
  - Noisy 3rd-party libs (httpx, sqlalchemy, asyncio) set to WARNING
"""

import logging
import sys
from logging.config import dictConfig

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "error": {
            "format": "%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "default",
            "level": "INFO",
        },
        "stderr_errors": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
            "formatter": "error",
            "level": "ERROR",
        },
    },
    "loggers": {
        # Our own app logger — WARNING and above to stdout, ERROR to stderr
        "app": {
            "handlers": ["stdout", "stderr_errors"],
            "level": "WARNING",
            "propagate": False,
        },
        # Uvicorn — only warnings (removes every request log spam)
        "uvicorn": {
            "handlers": ["stdout", "stderr_errors"],
            "level": "WARNING",
            "propagate": False,
        },
        "uvicorn.access": {
            "handlers": ["stdout"],  # Show request logs in docker logs
            "level": "INFO",
            "propagate": False,
        },
        "uvicorn.error": {
            "handlers": ["stderr_errors"],
            "level": "ERROR",
            "propagate": False,
        },
        # FastAPI
        "fastapi": {
            "handlers": ["stdout", "stderr_errors"],
            "level": "WARNING",
            "propagate": False,
        },
        # SQLAlchemy — only warnings (removes every SQL query log)
        "sqlalchemy.engine": {
            "handlers": ["stderr_errors"],
            "level": "ERROR",
            "propagate": False,
        },
        "sqlalchemy.pool": {
            "handlers": ["stderr_errors"],
            "level": "ERROR",
            "propagate": False,
        },
        # httpx — silence connection-level noise
        "httpx": {
            "handlers": ["stderr_errors"],
            "level": "ERROR",
            "propagate": False,
        },
        "httpcore": {
            "handlers": ["stderr_errors"],
            "level": "ERROR",
            "propagate": False,
        },
        # asyncio
        "asyncio": {
            "handlers": ["stderr_errors"],
            "level": "ERROR",
            "propagate": False,
        },
        # ARQ worker
        "arq": {
            "handlers": ["stdout", "stderr_errors"],
            "level": "WARNING",
            "propagate": False,
        },
    },
    # Root logger — catches anything not explicitly named
    "root": {
        "handlers": ["stdout", "stderr_errors"],
        "level": "WARNING",
    },
}


def setup_logging() -> None:
    """Apply logging configuration. Call once at application startup."""
    dictConfig(LOGGING_CONFIG)


# Convenience: module-level app logger
logger = logging.getLogger("app")
