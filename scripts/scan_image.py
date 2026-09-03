"""Synchronous command-line scanner for local development."""

import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.ocr_engine import AlgerianIDOCR  # noqa: E402


def main() -> int:
    """Scan an image and print its JSON result."""

    parser = argparse.ArgumentParser(description="Scan an Algerian national ID card image")
    parser.add_argument("image", type=Path, help="Path to the image")
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Save preprocessing stages, OCR overlay, and structured debug JSON",
    )
    args = parser.parse_args()
    if not args.image.is_file():
        parser.error(f"Image does not exist: {args.image}")
    settings = get_settings()
    if args.debug:
        settings.ocr_debug = True
    logging.basicConfig(
        level=settings.ocr_log_level.upper(), format="%(levelname)s %(name)s: %(message)s"
    )
    result = AlgerianIDOCR(settings).scan(str(args.image))
    print(json.dumps(result.model_dump(mode="json"), ensure_ascii=False, indent=2))
    return 0 if result.success else 1


if __name__ == "__main__":
    sys.exit(main())
