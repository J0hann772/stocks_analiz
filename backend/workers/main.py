from arq import cron
from arq.connections import RedisSettings
from core.config import settings
from workers.scanner_tasks import background_scan_batch
from workers.monitor_cron import monitor_tickers_job
from workers.formation_tasks import daily_formation_scan

async def startup(ctx):
    pass

async def shutdown(ctx):
    pass

class WorkerSettings:
    functions = [background_scan_batch, daily_formation_scan]
    cron_jobs = [
        # Запускать мониторинг каждые 4 часа
        cron(monitor_tickers_job, minute=0, hour={0, 4, 8, 12, 16, 20}),
        # Запускать сканер формаций ежедневно в 10:00 по Москве (перед торгами)
        cron(daily_formation_scan, hour=10, minute=0)
    ]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    on_startup = startup
    on_shutdown = shutdown
    job_timeout = 900 # 15 минут максимум для всего рынка

