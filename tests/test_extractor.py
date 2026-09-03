from app.extractor import extract_identity


def test_extracts_labeled_french_fields_and_spaced_nin() -> None:
    result = extract_identity(
        [
            "NOM: BENALI",
            "PREN0M: AHMED",
            "Né le: 01/01/1990",
            "Lieu de naissance: ALGER",
            "SEXE: M",
            "NIN: 1234 5678 9012 3456 78",
            "N°: 987654321",
            "أحمد بن علي",
        ]
    )

    assert result.fields.last_name == "BENALI"
    assert result.fields.first_name == "AHMED"
    assert result.fields.birth_date == "1990-01-01"
    assert result.fields.birth_place == "ALGER"
    assert result.fields.gender == "M"
    assert result.fields.nin == "123456789012345678"
    assert result.fields.document_number == "987654321"
    assert result.fields.arabic_name == "أحمد بن علي"
    assert result.fields.document_type == "unknown"


def test_falls_back_to_eighteen_digit_nin_and_handles_ocr_date() -> None:
    result = extract_identity("N0M BENALI\nPRENOM AHMED\n01-02-90\n123456789012345678")

    assert result.fields.nin == "123456789012345678"
    assert result.fields.birth_date == "1990-02-01"


def test_classifies_a_passport_from_label_and_mrz() -> None:
    result = extract_identity(
        [
            "PASSPORT / PASSEPORT",
            "P<DZAABBOUD<<NABIL<<<<<<<<<<<<<<<<<<<<<<",
        ]
    )

    assert result.fields.document_type == "passport"
    assert result.fields.document_type_confidence == 0.98
    assert result.fields.last_name == "ABBOUD"
    assert result.fields.first_name == "NABIL"


def test_classifies_a_driving_license_from_french_label() -> None:
    result = extract_identity(["PERMIS DE CONDUIRE", "NOM: BENALI"])

    assert result.fields.document_type == "driving_license"


def test_classifies_an_arabic_national_id() -> None:
    result = extract_identity(["بطاقة التعريف الوطنية", "الرقم الوطني: 123456789012345678"])

    assert result.fields.document_type == "national_id"
    assert result.fields.document_type_confidence == 0.98


def test_classifies_a_tokenized_arabic_national_id_heading() -> None:
    result = extract_identity(["بطاقة", "التعريف الوطنية", "الجمهورية الجزائرية"])

    assert result.fields.document_type == "national_id"


def test_extracts_arabic_identity_fields() -> None:
    result = extract_identity(
        [
            "بطاقة",
            "التعريف الوطنية",
            "محمد بن علي",
            "الإسم",
            "مكان الميلاد",
            "الجزائر",
            "ذكر",
            "1964.05.06",
            "123456789012345678",
        ]
    )

    assert result.fields.document_type == "national_id"
    assert result.fields.arabic_name == "محمد بن علي"
    assert result.fields.birth_date == "1964-05-06"
    assert result.fields.birth_place == "الجزائر"
    assert result.fields.gender == "M"
    assert result.fields.nin == "123456789012345678"
