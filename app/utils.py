"""Small utilities used by OCR extraction and queue input handling."""

import base64
import binascii
import re
import unicodedata


def normalize_text(value: str) -> str:
    """Normalize OCR text while retaining Arabic characters."""

    value = unicodedata.normalize("NFKC", value).replace("\u00a0", " ")
    value = re.sub(r"[\t\r\n]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def normalize_label(value: str) -> str:
    """Normalize a Latin label for fuzzy comparison."""

    decomposed = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(char for char in decomposed if not unicodedata.combining(char))
    ascii_value = ascii_value.upper().replace("0", "O").replace("1", "I")
    return re.sub(r"[^A-Z ]", "", ascii_value).strip()


def compact_digits(value: str) -> str:
    """Return digits from a possibly space-separated OCR value."""

    return re.sub(r"\D", "", value)


def decode_base64_image(value: str) -> bytes:
    """Decode a raw or data-URL base64 image payload with a clear error."""

    encoded = value.split(",", 1)[-1]
    try:
        return base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("image_base64 is not valid base64") from exc
