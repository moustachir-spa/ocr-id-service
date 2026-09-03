from app.models import IdentityFields
from app.validator import validate_identity


def test_exact_nin_and_date_are_strong_matches() -> None:
    result = validate_identity(
        IdentityFields(
            first_name="AHMED",
            last_name="BENALI",
            nin="123456789012345678",
            birth_date="1990-01-01",
        ),
        {
            "first_name": "AHMED",
            "last_name": "BENALI",
            "nin": "123456789012345678",
            "birth_date": "1990-01-01",
        },
    )

    assert result.matched is True
    assert result.score == 100
    assert "nin_exact_match" in result.reasons
