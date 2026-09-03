"""Process entry point for the Redis/BullMQ OCR worker."""

import asyncio
import logging

from app.config import get_settings
from app.queue_worker import run_worker


def main() -> None:
    """Configure logging and start consuming OCR jobs."""

    settings = get_settings()
    logging.basicConfig(
        level=settings.ocr_log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(run_worker(settings))


if __name__ == "__main__":
    main()
