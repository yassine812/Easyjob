from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.providers.rule_based import RuleBasedProvider

client = TestClient(app)

def test_tailoring_never_adds_missing_skills_as_claims():
    source = 'Jane\n\nSkills\nReact\n\nExperience\nBuilt a React application.'
    result = RuleBasedProvider().tailor_cv(source, {'skills': [{'name': 'React'}, {'name': 'Django'}]})
    assert 'Django' not in result['tailored_cv']
    assert sorted(source.split('\n\n')) == sorted(result['tailored_cv'].split('\n\n'))
    assert result['suggested_keywords'] == ['django']


def test_local_rewrite_changes_selected_french_responsibility_without_inventing_results():
    source = '• Mise en œuvre de 4 fonctionnalités clés avec React Native (Expo).'
    result = RuleBasedProvider().tailor_cv(source, {'editing_scope': 'line', 'skills': []})
    assert result['tailored_cv'] == '• Mettre en œuvre 4 fonctionnalités clés avec React Native (Expo).'
    assert RuleBasedProvider().tailor_cv(result['tailored_cv'], {'editing_scope': 'line'})['tailored_cv'] == result['tailored_cv']


def test_local_section_rewrite_preserves_employers_dates_and_technical_facts():
    source = '## EXPÉRIENCE\nAB Serve · Janvier 2024 - Février 2024\n• Développement de fonctionnalités avec Laravel et MySQL.\n• Maintien de la fiabilité des postes.'
    result = RuleBasedProvider().tailor_cv(source, {'editing_scope': 'section'})['tailored_cv']
    assert result == '## EXPÉRIENCE\nAB Serve · Janvier 2024 - Février 2024\n• Développer des fonctionnalités avec Laravel et MySQL.\n• Maintenir la fiabilité des postes.'


@pytest.mark.parametrize('bullet', ['● ', '• ', '▪ ', '◦ ', '‣ ', '∙ ', '\uf0b7 ', '●\u00a0', '●'])
@pytest.mark.parametrize('scope', ['line', 'section'])
def test_rewrites_actual_pdf_audit_line_with_extracted_bullets(bullet, scope):
    source = bullet + "Mise en œuvre de 4 fonctionnalités clés d'audit : gestion des workflows, administration des données de référence, "
    result = RuleBasedProvider().tailor_cv(source, {'editing_scope': scope})['tailored_cv']
    assert result == source.replace('Mise en œuvre de 4', 'Mettre en œuvre 4')
    assert "4 fonctionnalités clés d'audit" in result


def test_rewrite_does_not_turn_a_heading_or_skill_list_into_a_claim():
    source = 'Développement Full-Stack\nPython, Django, SQL\n2024 - 2026'
    assert RuleBasedProvider().tailor_cv(source, {})['tailored_cv'] == source

def test_no_cv_means_no_score_or_invented_missing_skills():
    result = RuleBasedProvider().analyze_cv('')
    assert result['overall_score'] is None
    assert result['missing_skills'] == []

def test_fallback_cover_letter_does_not_invent_experience_or_job_fit():
    result = RuleBasedProvider().cover_letter(
        {'name': 'Jane Doe', 'skills': [{'name': 'Python'}], 'experiences': []},
        {'title': 'Backend Developer', 'company': 'Acme'},
    )['cover_letter']
    assert 'Python' in result
    assert 'experience' not in result.lower()
    assert 'maps well' not in result.lower()
    assert 'Backend Developer' in result


def test_cover_letter_uses_selected_cv_and_job_in_french():
    result = RuleBasedProvider().cover_letter(
        {'name': 'Jane', 'sourceCvText': 'Compétences : Django, Python\nDéveloppement d’une application de gestion avec Django et Python.',
         'skills': [{'name': 'React'}, {'name': 'Python'}]},
        {'title': 'Développeur Django', 'company': 'Acme', 'locale': 'fr', 'skills': [{'name': 'Django'}, {'name': 'React'}]},
    )['cover_letter']
    assert 'Madame, Monsieur' in result
    assert 'Django' in result and 'Acme' in result
    assert 'React' not in result
    assert 'application de gestion' in result


def test_changing_selected_cv_changes_letter_evidence():
    provider = RuleBasedProvider()
    job = {'title': 'Engineer', 'skills': [{'name': 'Python'}, {'name': 'React'}]}
    first = provider.cover_letter({'sourceCvText': 'Skills: Python'}, job)['cover_letter']
    second = provider.cover_letter({'sourceCvText': 'Skills: React'}, job)['cover_letter']
    assert 'Python' in first and 'React' not in first
    assert 'React' in second and 'Python' not in second

def test_coach_questions_use_the_actual_skill_and_locale():
    response = client.post('/ai/career/coach', json={'action': 'questions', 'locale': 'fr',
        'interviewType': 'TECHNICAL', 'job': {'title': 'Développeur', 'skills': [{'name': 'Django'}]}})
    assert response.status_code == 200
    assert any('Django' in q for q in response.json()['questions'])

def test_job_analysis_returns_recommendations_and_candidate_gaps():
    response = client.post('/ai/career/coach', json={'action': 'job_analysis', 'job': {
        'title': 'Full-Stack Developer', 'description': 'Build REST APIs with Django and collaborate with the team.',
        'skills': [{'name': 'Django'}, {'name': 'Docker'}]}, 'candidate': {'text': 'Experience with Django'}})
    assert response.status_code == 200
    body = response.json()
    assert 'TECHNICAL' in body['recommendedTypes']
    assert 'Docker' in body['gaps']
    assert body['requirements'][0]['evidence']

def test_situational_interview_uses_situational_questions():
    response = client.post('/ai/career/coach', json={'action': 'questions', 'locale': 'fr', 'interviewType': 'SITUATIONAL'})
    assert response.status_code == 200
    assert any('incident critique' in question for question in response.json()['questions'])

def test_coach_distinguishes_measured_speech_from_typed_text():
    payload = {'action': 'feedback', 'answer': 'I built a React project with my team.',
        'question': 'Describe your project', 'job': {'skills': [{'name': 'React'}]}}
    typed = client.post('/ai/career/coach', json=payload).json()
    spoken = client.post('/ai/career/coach', json={**payload, 'speakingSeconds': 30}).json()
    assert typed['wordsPerMinute'] is None
    assert spoken['wordsPerMinute'] == 16
    assert typed['keywords'] == ['React']
    assert '[real context]' in typed['betterAnswer']

def test_camera_feedback_is_limited_and_does_not_persist():
    from pathlib import Path
    frame = Path(__file__).parent / 'fixtures' / 'astronaut.png'
    response = client.post('/ai/career/vision', files={'frame': ('frame.png', frame.read_bytes(), 'image/png')})
    assert response.status_code == 200
    assert response.json()['supported'] == ['framing', 'camera_distance']
    assert response.json()['stored'] is False
    assert 'emotions' in response.json()['unsupported']

def test_career_endpoints_require_server_key(monkeypatch):
    monkeypatch.setenv('AI_API_KEY', 'private-test-key')
    assert client.post('/ai/career/coach', json={'action': 'questions'}).status_code == 401

def test_invalid_camera_image_is_rejected():
    assert client.post('/ai/career/vision', files={'frame': ('bad.jpg', b'not an image', 'image/jpeg')}).status_code == 400
