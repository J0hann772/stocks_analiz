from arq import cron
from arq.connections import RedisSettings
from core.config import settings
from workers.scanner_tasks import background_scan_batch
from workers.monitor_cron import monitor_tickers_job

async def startup(ctx):
    pass

async def shutdown(ctx):
    pass

class WorkerSettings:
    functions = [background_scan_batch]
    cron_jobs = [
        # Запускать мониторинг каждые 4 часа
        cron(monitor_tickers_job, minute=0, hour={0, 4, 8, 12, 16, 20})
    ]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    on_startup = startup
    on_shutdown = shutdown
    job_timeout = 600 # 10 минут максимум (с запасом для 1000 тикеров)

