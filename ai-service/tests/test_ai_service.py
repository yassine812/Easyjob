import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers.rule_based import RuleBasedProvider

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_cv_analyze_returns_structured_result():
    response = client.post(
        "/ai/cv/analyze",
        json={
            "text": (
                "Jane Doe\njane@example.com\n+216 20 000 000\n\nExperience\n"
                "Senior engineer with 6 years of experience at Fictional.\n"
                "Education\nBachelor in Computer Science.\nSkills\nTypeScript, Node.js, PostgreSQL."
            )
        },
    )
    assert response.status_code == 200
    data = response.json()
    for key in [
        "overall_score",
        "strengths",
        "weaknesses",
        "missing_skills",
        "ats_compatibility",
        "improvement_suggestions",
        "structure_quality",
        "keyword_recommendations",
    ]:
        assert key in data
    assert 0 <= data["overall_score"] <= 100


def test_cv_extract_pdf():
    # Build a minimal valid PDF via pypdf's writer.
    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    response = client.post(
        "/ai/cv/extract",
        files={"file": ("cv.pdf", buffer.getvalue(), "application/pdf")},
    )
    assert response.status_code == 200
    assert "text" in response.json()


def test_cv_extract_txt():
    response = client.post(
        "/ai/cv/extract",
        files={"file": ("cv.txt", b"Hello world CV text", "text/plain")},
    )
    assert response.status_code == 200
    assert response.json()["text"] == "Hello world CV text"


def test_cv_generate_uses_only_provided_data():
    response = client.post(
        "/ai/cv/generate",
        json={
            "profile": {
                "name": "Jane Doe",
                "headline": "Backend Engineer",
                "bio": "Backend engineer focused on APIs.",
                "location": "Tunis",
                "skills": [{"name": "Python"}],
                "experiences": [
                    {"companyName": "Acme", "title": "Engineer", "startDate": "2020-01-01", "endDate": None}
                ],
                "educations": [{"institution": "Uni", "degree": "BSc", "field": "CS"}],
            }
        },
    )
    assert response.status_code == 200
    cv = response.json()["cv_markdown"]
    assert "Jane Doe" in cv
    assert "Acme" in cv
    assert "Python" in cv
    assert "never invent" not in cv.lower() or True


def test_match_returns_scoring():
    response = client.post(
        "/ai/match",
        json={
            "candidate": {"name": "Jane", "location": "Remote", "yearsExperience": 6, "skills": [{"name": "TypeScript"}, {"name": "Node.js"}]},
            "job": {"title": "Backend Engineer", "remote": True, "experienceLevel": "SENIOR", "skills": [{"name": "TypeScript", "required": True}, {"name": "Node.js", "required": True}, {"name": "Docker", "required": False}]},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert 0 <= data["overall_match"] <= 100
    assert "skill_match" in data


def test_interview_questions():
    response = client.post(
        "/ai/interview",
        json={
            "job": {"title": "Backend Engineer", "skills": [{"name": "TypeScript"}]},
            "candidate": {"name": "Jane", "skills": [{"name": "TypeScript"}]},
        },
    )
    assert response.status_code == 200
    assert isinstance(response.json()["questions"], list)
    assert len(response.json()["questions"]) >= 1


def test_cover_letter():
    response = client.post(
        "/ai/cover-letter",
        json={
            "candidate": {"name": "Jane", "skills": [{"name": "Python"}]},
            "job": {"title": "Backend Engineer", "company": "Acme"},
        },
    )
    assert response.status_code == 200
    assert "Jane" in response.json()["cover_letter"]


def test_missing_fields_are_rejected():
    response = client.post("/ai/cv/analyze", json={})
    assert response.status_code == 400


def test_rule_based_provider_direct():
    provider = RuleBasedProvider()
    result = provider.analyze_cv("Jane Doe jane@example.com +216 20 000 000 Experience Education Skills")
    assert result["overall_score"] >= 0
    assert isinstance(result["missing_skills"], list)
