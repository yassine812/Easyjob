from app.interview_ai.answer_analyzer import analyze
from app.interview_ai.follow_up_engine import decide
from app.interview_ai.rubric_builder import build_rubric


def test_local_rubric_and_answer_analysis_do_not_need_a_remote_provider():
    rubric = build_rubric(
        {'title': 'Python developer', 'description': 'Build Django REST APIs with PostgreSQL.', 'skills': [{'name': 'Python'}, {'name': 'Django'}]},
        {'text': 'Python Django PostgreSQL'}, 'TECHNICAL')
    result = analyze("J'ai conçu une API Django pour un incident client. J'ai ajouté des tests et réduit le délai de 40%.", 'Expliquez votre décision avec Django.', rubric, 30, 1)
    assert rubric['engine'] == 'local_deterministic'
    assert result['skill_coverage'] > 0
    assert result['personal_contribution'] >= .5
    assert result['result_present'] is True
    assert result['star_coverage'] >= .5


def test_weak_answer_reliably_requests_a_rule_based_follow_up():
    rubric = {'competencies': [{'label': 'Python'}]}
    result = analyze("Je connais Python.", 'Expliquez votre décision.', rubric)
    follow, code, wording = decide(result)
    assert follow is True
    assert code in {'ASK_FOR_EXAMPLE', 'ASK_FOR_RESULT', 'ASK_FOR_PERSONAL_ROLE', 'ASK_TECHNICAL_DETAIL'}
    assert wording


def test_analysis_remains_operational_when_the_embedding_model_is_unavailable(monkeypatch):
    import app.interview_ai.answer_analyzer as analyzer

    monkeypatch.setattr(analyzer, 'embedding_similarity', lambda _answer, _target: None)
    result = analyzer.analyze("J'ai corrigé une API Django.", 'Expliquez votre décision.', {'competencies': [{'label': 'Django'}]})
    assert result['analysis_engine'] == 'local_deterministic_fallback'
    assert result['job_relevance'] >= 0


def test_semantic_timeout_returns_deterministic_fallback(monkeypatch):
    import asyncio
    import time
    import app.interview_ai.runtime as runtime

    def delayed(*_args, use_embeddings=True, **_kwargs):
        if use_embeddings:
            time.sleep(.05)
        return {'analysis_engine': 'local_hybrid' if use_embeddings else 'local_deterministic_fallback', 'follow_up_needed': False}

    monkeypatch.setattr(runtime, 'analyze', delayed)
    monkeypatch.setattr(runtime, 'TIMEOUT_SECONDS', .01)
    result = asyncio.run(runtime.analyze_safely('answer', 'question', {}))
    assert result['analysis_engine'] == 'local_deterministic_fallback'


def test_preload_reuses_one_model_instance():
    from app.interview_ai.resources import preload

    first = preload(allow_download=False)
    second = preload(allow_download=False)
    assert first['model_instance_count'] == second['model_instance_count']
    assert second['model_instance_count'] <= 1
