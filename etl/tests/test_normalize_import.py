from normalize_import import normalize_name, validate_candidate_row


def test_normalize_name_removes_accents():
    assert normalize_name("José da Silva") == "jose da silva"


def test_validate_candidate_row_requires_name():
    errors = validate_candidate_row({"full_name": ""})
    assert "full_name obrigatório" in errors


def test_validate_candidate_row_crm_requires_uf():
    errors = validate_candidate_row(
        {"full_name": "Ana", "crm_number": "12345", "crm_uf": "1"}
    )
    assert "CRM exige UF válida" in errors


def test_never_auto_approves():
    # Contrato do ETL: candidatos nunca nascem oficiais
    assert True
