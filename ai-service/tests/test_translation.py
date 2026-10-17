from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_translation_rejects_ui_language_labels_with_field_details():
    response = client.post(
        "/ai/cv/translate",
        json={
            "document": {},
            "sourceLocale": "English",
            "targetLocale": "de-DE",
            "sourceLanguage": "en",
            "targetLanguage": "de",
        },
    )

    assert response.status_code == 400
    body = response.json()["detail"]
    assert body["error"] == "invalid_translation_request"
    assert "sourceLocale" in body["fields"]


def test_translation_accepts_canonical_locales_and_language_codes():
    response = client.post(
        "/ai/cv/translate",
        json={
            "document": {"locale": "en-CA", "personal": {"title": "Developer"}, "sections": []},
            "sourceLocale": "en-CA",
            "targetLocale": "de-DE",
            "sourceLanguage": "en",
            "targetLanguage": "de",
        },
    )

    assert response.status_code == 200
    assert response.json()["translated"] is True
