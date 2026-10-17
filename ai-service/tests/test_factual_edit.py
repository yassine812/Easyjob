from app.factual_edit import factual_rewrite
from app.providers.rule_based import RuleBasedProvider
from app.providers.openai import OpenAIProvider
import asyncio
from unittest.mock import AsyncMock, patch

def test_rewrite_cannot_add_metrics_or_credentials():
    assert not factual_rewrite('Developed Python applications', 'Developed Python applications for 500 users')
    assert not factual_rewrite('Developed Python applications', 'Developed Python and Docker applications')
    assert not factual_rewrite('Developed Python applications', 'Managed a team developing Python applications')
    assert factual_rewrite('Développement des outils Python', 'Développer les outils Python')

def test_tailoring_preserves_role_and_bullet_adjacency():
    source = '# Candidate\n\n## Experience\nRole A 2020\n\nPython work\n\nRole B 2022\nOther work\n\n## Skills\nPython'
    result = RuleBasedProvider().tailor_cv(source, {'skills': [{'name': 'Python'}]})['tailored_cv']
    assert 'Role A 2020\n\nPython work\n\nRole B 2022\nOther work' in result

def test_letter_length_uses_relevant_evidence_only():
    candidate = {'name': 'Candidate', 'sourceCvText': 'Developed Python applications for internal management tools.\nMaintained Python modules supporting reporting workflows.\nUnrelated photography project without relevant technology.', 'skills': []}
    job = {'title': 'Python Developer', 'company': 'Company', 'skills': [{'name': 'Python'}], 'locale': 'en'}
    provider = RuleBasedProvider()
    letters = [provider.cover_letter(candidate, {**job, 'length': length})['cover_letter'] for length in ('short', 'standard', 'detailed')]
    assert len(letters[0]) < len(letters[1]) < len(letters[2])
    assert all('photography' not in letter for letter in letters)

def test_generative_tailoring_rejects_new_achievement_before_returning_content():
    with patch('app.providers.openai._chat', new=AsyncMock(return_value={'tailored_cv': 'Developed Python applications for 500 users'})):
        result = asyncio.run(OpenAIProvider().tailor_cv('Developed Python applications', {'title': 'Developer'}))
    assert '500' not in result['tailored_cv']

def test_generative_profile_cv_rejects_unsupported_credentials():
    with patch('app.providers.openai._chat', new=AsyncMock(return_value={'cv_markdown': '# Candidate\nDoctorate from Harvard'})):
        result = asyncio.run(OpenAIProvider().generate_cv({'name': 'Candidate', 'headline': 'Developer', 'skills': []}))
    assert 'Harvard' not in result['cv_markdown']
