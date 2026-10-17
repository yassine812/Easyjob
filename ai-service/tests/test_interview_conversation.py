import asyncio
from types import SimpleNamespace
from app.routers.career import CoachInput, coach


def test_coach_forwards_rubric_and_history_to_the_existing_provider(monkeypatch):
    captured = []
    analysis = dict(overall_relevance=80, specificity=70, evidence_quality=60,
                    communication_clarity=85, role_alignment=80, strengths=['Specific decision'],
                    missing_points=['Validation'], detected_claims=['Changed rendering'],
                    follow_up_needed=True, follow_up_reason='Validation is missing')

    async def respond(prompt):
        captured.append(str(prompt))
        return dict(good=['Specific decision'], improve=['Explain validation'], keywords=[],
                    betterAnswer='Use your actual example.', clarity='Clear', relevance='Relevant',
                    answerAnalysis=analysis, followUpQuestion='How did you verify the rendering change?')

    monkeypatch.setattr('app.providers.openai._chat', respond)
    data = CoachInput(action='feedback', locale='en', interviewType='TECHNICAL',
                      question='How did you improve the app?', answer='I changed rendering.',
                      rubric={'competencies': [{'label': 'React Native rendering'}]},
                      history=[{'answer': 'A previous mobile example'}])
    result = asyncio.run(coach(data, SimpleNamespace(name='openai')))
    assert result['answerAnalysis'] == analysis
    assert result['followUpQuestion'].startswith('How did you verify')
    assert 'React Native rendering' in captured[0]
    assert 'A previous mobile example' in captured[0]
