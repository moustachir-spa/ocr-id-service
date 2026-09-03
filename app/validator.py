"""Placeholder identity-record validation for a future backend integration."""

from rapidfuzz.fuzz import ratio

from app.models import IdentityFields, ValidationResult


def _similarity(left: str | None, right: object) -> float:
    if not left or right is None:
        return 0.0
    return float(ratio(left.casefold(), str(right).casefold()))


def validate_identity(
    ocr_fields: IdentityFields, database_record: dict[str, object]
) -> ValidationResult:
    """Compare exact NIN/date signals and fuzzy name signals with an explainable score."""

    reasons: list[str] = []
    weighted_score = 0.0
    total_weight = 0.0
    if ocr_fields.nin and database_record.get("nin") is not None:
        total_weight += 50
        if ocr_fields.nin == str(database_record["nin"]).replace(" ", ""):
            weighted_score += 50
            reasons.append("nin_exact_match")
        else:
            reasons.append("nin_mismatch")
    if ocr_fields.birth_date and database_record.get("birth_date") is not None:
        total_weight += 25
        if ocr_fields.birth_date == str(database_record["birth_date"]):
            weighted_score += 25
            reasons.append("birth_date_exact_match")
        else:
            reasons.append("birth_date_mismatch")
    for field in ("first_name", "last_name"):
        similarity = _similarity(getattr(ocr_fields, field), database_record.get(field))
        if similarity:
            total_weight += 12.5
            weighted_score += 12.5 * similarity / 100
            reasons.append(f"{field}_similarity_{round(similarity)}")
    score = round(weighted_score / total_weight * 100) if total_weight else 0
    return ValidationResult(matched=score >= 80, score=score, reasons=reasons)
