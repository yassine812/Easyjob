import asyncio
from unittest.mock import AsyncMock, patch

from app.editorial import organize_skills
from app.factual_edit import factual_rewrite
from app.providers.openai import OpenAIProvider
from app.providers.rule_based import RuleBasedProvider

SKILLS = """Backend : Python · Django · Django REST Framework · PHP · Laravel · API REST · Authentification
Frontend & Mobile : HTML · CSS · JavaScript · React Native (Expo) · Interfaces responsives
Données & Outils : MySQL · SQLite · SQL · Git · Agile/Scrum · Modélisation de données · Optimisation de bases de données
Ingénierie : Architecture logicielle · Développement d'API · Revue de code · CRUD · Débogage · Migrations de base de
données"""


def test_reported_skills_regroup_without_clarification_or_new_facts():
    result = RuleBasedProvider().tailor_cv(SKILLS, {'editing_scope': 'content', 'section_type': 'technical', 'skills': [{'name': 'Docker'}]})['tailored_cv']
    assert result != SKILLS
    assert 'Outils & méthodes : Git · Agile/Scrum' in result
    assert 'Bases de données : MySQL · SQLite · SQL · Modélisation de données · Optimisation de bases de données · Migrations de base de données' in result
    assert 'Docker' not in result
    assert 'React Native (Expo)' in result and 'Authentification' in result and "Développement d'API" in result
    assert factual_rewrite(SKILLS, result, section_type='technical')
    assert organize_skills(result) == result


def test_unknown_skills_retain_context_and_aliases_do_not_add_frameworks():
    result = organize_skills('Design : Figma · Portfolio\nWeb : javascript · django · javascript')
    assert 'Design : Figma · Portfolio' in result
    assert result.count('JavaScript') == 1
    assert 'Django REST Framework' not in result


def test_existing_skills_can_be_ordered_by_relevance_without_importing_missing_skills():
    assert organize_skills('Python · PHP · Laravel', relevant=['Laravel', 'Docker']).startswith('Backend : Laravel · Python · PHP')


def test_prose_becomes_action_bullets_without_inventing_impact():
    source = 'Développement de services API avec python. Maintenance des modules de reporting.'
    result = RuleBasedProvider().tailor_cv(source, {'editing_scope': 'content', 'section_type': 'experience'})['tailored_cv']
    assert result == '• Développer des services API avec Python.\n• Maintenir les modules de reporting.'
    assert factual_rewrite(source, result)


def test_category_exemption_is_not_a_global_vocabulary_allowlist():
    assert not factual_rewrite('Python', 'Architecture logicielle : Python', section_type='skills')
    assert not factual_rewrite('Python', 'Backend : Python · Docker', section_type='skills')
    assert not factual_rewrite('Python', 'Backend : expert Python pour 500 utilisateurs', section_type='skills')
    assert not factual_rewrite('Python', 'Conception & qualité : Python', letter=True)


def test_unchanged_generative_output_still_attempts_structural_improvement():
    with patch('app.providers.openai._chat', new=AsyncMock(return_value={'tailored_cv': SKILLS})):
        result = asyncio.run(OpenAIProvider().tailor_cv(SKILLS, {'editing_scope': 'content', 'section_type': 'technical'}))
    assert result['tailored_cv'] != SKILLS
    assert 'Outils & méthodes' in result['tailored_cv']


def test_offline_translation_translates_structured_cv_content_and_preserves_identity():
    document = {
        'schemaVersion': 1,
        'personal': {'name': 'Yassine Zerni', 'title': 'Développeur Full-Stack', 'email': 'y@example.com'},
        'sections': [{'title': 'Profil professionnel', 'entries': [{'title': '', 'text': 'Développeur Full-Stack expérimenté en développement web.', 'period': '', 'bullets': []}]}],
    }
    result = RuleBasedProvider().translate_cv(document, 'fr-FR', 'en-CA', {})
    translated = result['document']
    assert result['translated'] is True
    assert translated['personal']['name'] == 'Yassine Zerni'
    assert translated['personal']['title'] == 'Full-Stack Developer'
    assert translated['sections'][0]['title'] == 'Professional Summary'
    assert 'experienced across web development' not in translated['sections'][0]['entries'][0]['text']
    assert 'Full-Stack Developer' in translated['sections'][0]['entries'][0]['text']
