"""
배치 스케줄러 (APScheduler).

하루 2회 — 새벽 4시와 오후 4시(서울 기준).
새벽은 그날치를 미리 채워두는 실행이고, 오후는 날씨가 바뀐 경우를 반영하는
갱신이다. 실시간 계산이 아니라 사전 계산이므로 이 정도로 충분하다(PRD ⑦).

배치가 실패해도 서비스는 죽지 않는다. 예측치가 테이블에 남아 있어서
Next.js 는 마지막 저장분을 계속 읽는다.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import SEOUL_TZ
from app.jobs import run_forecast_job

logger = logging.getLogger(__name__)

JOB_ID = "forecast-refresh"

_scheduler: BackgroundScheduler | None = None


def _run() -> None:
    try:
        result = run_forecast_job()
        logger.info(
            "배치 완료 — %s, 장소 %d곳, %d행 저장",
            result.forecast_date,
            result.places_scored,
            result.rows_written,
        )
        for note in result.notes:
            logger.info("  · %s", note)
    except Exception:
        # 여기서 예외가 새면 스케줄러가 job 을 죽인 채로 남을 수 있다.
        # 다음 실행 기회를 잃지 않도록 잡아서 로그만 남긴다.
        logger.exception("배치 실패")


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = BackgroundScheduler(timezone=SEOUL_TZ)
    scheduler.add_job(
        _run,
        trigger=CronTrigger(hour="4,16", minute=0, timezone=SEOUL_TZ),
        id=JOB_ID,
        name="혼잡 예측 갱신",
        # 서버가 잠깐 내려갔다 올라오면 밀린 실행이 한꺼번에 몰릴 수 있다.
        # 1회로 합치고, 1시간 넘게 늦은 실행은 그냥 건너뛴다.
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    scheduler.start()
    _scheduler = scheduler

    next_run = scheduler.get_job(JOB_ID).next_run_time
    logger.info("스케줄러 시작 — 다음 실행 %s", next_run)
    return scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
