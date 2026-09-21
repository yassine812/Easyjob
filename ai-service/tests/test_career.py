from fastapi.testclient import TestClient
from app.main import app
from app.providers.rule_based import RuleBasedProvider

client = TestClient(app)

def test_tailoring_never_adds_missing_skills_as_claims():
    source = 'Jane\n\nSkills\nReact\n\nExperience\nBuilt a React application.'
    result = RuleBasedProvider().tailor_cv(source, {'skills': [{'name': 'React'}, {'name': 'Django'}]})
    assert 'Django' not in result['tailored_cv']
    assert sorted(source.split('\n\n')) == sorted(result['tailored_cv'].split('\n\n'))
    assert result['suggested_keywords'] == ['django']

def test_no_cv_means_no_score_or_invented_missing_skills():
    result = RuleBasedProvider().analyze_cv('')
    assert result['overall_score'] is None
    assert result['missing_skills'] == []

def test_coach_questions_use_the_actual_skill_and_locale():
    response = client.post('/ai/career/coach', json={'action': 'questions', 'locale': 'fr',
        'interviewType': 'TECHNICAL', 'job': {'title': 'Développeur', 'skills': [{'name': 'Django'}]}})
    assert response.status_code == 200
    assert any('Django' in q for q in response.json()['questions'])

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
