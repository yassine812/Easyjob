import json
import re
import socket
import subprocess
import sys
from pathlib import Path
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.job_drafting.engine import DraftQualityError, ENV, generate, validate_quality
from app.job_drafting.knowledge import knowledge_base
from app.job_drafting.models import DraftRequest, GeneratedJobDraft
from app.routers.job_drafting import router

KB = knowledge_base()

@pytest.mark.parametrize('role_id', list(KB.roles))
@pytest.mark.parametrize('locale', ['fr','en','ar'])
@pytest.mark.parametrize('seniority', ['JUNIOR','MID','SENIOR','LEAD'])
def test_complete_localized_drafts(role_id, locale, seniority):
    request = DraftRequest(roleId=role_id, locale=locale, seniority=seniority, company={'commercialName':'Example','industry':'Technology'}, location='Tunis')
    draft = generate(request)
    assert len(draft.responsibilities) >= 6
    assert len(set(draft.responsibilities)) == len(draft.responsibilities)
    assert len(draft.description.split('\n\n')) == 3
    assert len(draft.descriptions[1].text) < len(draft.description)
    assert all(' · ' not in item.text for item in draft.descriptions)
    assert draft.provenance['sourceTaskIds']
    # Some source occupations have no knowledge ratings; do not invent those.
    assert isinstance(draft.provenance['knowledgeAreas'], list)
    assert bool(draft.provenance['knowledgeAreas']) == bool(KB.source_records(KB.get(role_id))['knowledge'])
    if locale == 'fr':
        assert not re.search(r'\b(?:Technology|MID|Advanced|Full-time)\b', draft.description)
        assert 'Temps plein' not in draft.description and 'Hybride' not in draft.description
        assert draft.workingConditions.industry == 'Technologie'

def test_django_has_real_specialization_and_correct_optional_skills():
    draft = generate(DraftRequest(roleId='django_backend_developer', skills=['Python','Django','PostgreSQL']))
    assert 'Python/Django confirmé' in draft.title
    assert any('avec Django' in value for value in draft.responsibilities)
    assert any('PostgreSQL' in value for value in draft.responsibilities)
    assert {'Python','Django','SQL','Git'} <= {skill.name for skill in draft.skills}
    assert {'Django REST Framework','Docker','Redis','Celery','CI/CD'} <= set(draft.preferredSkills)
    text = draft.model_dump_json()
    assert all(value not in text for value in ['Swift','React Native','Figma'])

def test_employer_skill_exception_is_explicit_and_not_invented():
    draft = generate(DraftRequest(roleId='django_backend_developer', skills=['Swift']))
    assert any(skill.name == 'Swift' and skill.source == 'employer' for skill in draft.skills)

def test_devops_seniority_changes_scope_and_grammar():
    junior = generate(DraftRequest(roleId='devops_engineer', seniority='JUNIOR'))
    senior = generate(DraftRequest(roleId='devops_engineer', seniority='SENIOR', skills=['Terraform']))
    lead = generate(DraftRequest(roleId='devops_engineer', seniority='LEAD'))
    assert 'accompagnement' in junior.description
    assert 'architecture' in senior.description
    assert 'direction technique' in lead.description
    assert 'architecture' not in junior.description
    assert junior.responsibilities != senior.responsibilities != lead.responsibilities
    assert any('Terraform' in line for line in senior.responsibilities)
    assert 'React' not in senior.description

def test_titles_keep_family_anchors_and_reject_weak_matches():
    for q in ['DevOps','devop','Dev Ops']:
        result=KB.suggest(q)
        assert len(result) <= 6 and result[0]['id'] == 'devops_engineer'
        assert not {r['id'] for r in result} & {'django_backend_developer','mobile_developer'}
        assert {'platform_engineer','site_reliability_engineer'} <= {r['id'] for r in result}
        assert all(set(item)=={'id','label'} for item in result)
    assert KB.suggest('React Nat')[0]['id']=='mobile_developer'
    assert KB.suggest('Django back')[0]['id']=='django_backend_developer'
    assert KB.suggest('back dev')[0]['id']=='backend_developer'
    assert KB.suggest('devopps')[0]['id']=='devops_engineer'
    assert KB.suggest('astronaut accountant') == []
    assert KB.suggest('a') == []

def test_reproducible_and_offline(monkeypatch):
    def forbidden(*args, **kwargs): raise AssertionError('Network is not allowed')
    monkeypatch.setattr(socket, 'socket', forbidden)
    request=DraftRequest(roleId='django_backend_developer', company={'commercialName':'Example'})
    assert generate(request).model_dump() == generate(request).model_dump()
    changed=generate(request.model_copy(update={'seniority':'SENIOR'}))
    assert changed.provenance['seed'] != generate(request).provenance['seed']

def test_module_does_not_import_models_or_providers():
    code="from app.job_drafting.engine import generate; import sys; assert not any(k.startswith(('torch','transformers','sentence_transformers','app.providers','app.dependencies','spacy')) for k in sys.modules)"
    subprocess.run([sys.executable,'-c',code],check=True)

@pytest.mark.parametrize('corruption', ['duplicates','short','raw_locale','metadata','skills','claim'])
def test_quality_gate_rejects_bad_content(corruption):
    request=DraftRequest(roleId='django_backend_developer')
    draft=generate(request); role=KB.get(request.roleId)
    if corruption=='duplicates': draft.responsibilities[1]=draft.responsibilities[0]
    if corruption=='short': draft.responsibilities[0]='Tester.'
    if corruption=='raw_locale': draft.descriptions[0].text+=' Technology'
    if corruption=='metadata': draft.descriptions[0].text+=' ONSITE · FULL_TIME'
    if corruption=='skills': draft.skills[0].name='Swift'
    if corruption=='claim': draft.descriptions[0].text+=' Une équipe internationale.'
    with pytest.raises(DraftQualityError): validate_quality(draft,request,role)

def test_pydantic_rejects_unknown_keys_and_invalid_payloads():
    with pytest.raises(ValidationError): DraftRequest(roleId='devops_engineer', seniority='MID_RAW')
    with pytest.raises(ValidationError): DraftRequest(roleId='devops_engineer', skills=['x'*81])
    with pytest.raises(ValidationError): DraftRequest(roleId='devops_engineer', provider='openai')
    with pytest.raises(ValidationError): GeneratedJobDraft.model_validate({'description':'x'})

def test_family_macro_text_stays_in_sync_with_knowledge_base():
    for name,family in KB.families.items():
        for locale in ['fr','en','ar']:
            macro=ENV.get_template(f'{locale}/families/{name}.j2').module
            assert macro.purpose() == getattr(family.purpose,locale)
            assert macro.scope() == getattr(family.scope,locale)

def test_internal_endpoint_requires_service_key_and_validates_response(monkeypatch):
    monkeypatch.setenv('AI_API_KEY','drafting-test-key')
    app=FastAPI(); app.include_router(router,prefix='/drafting')
    client=TestClient(app)
    assert client.post('/drafting/jobs',json={'roleId':'devops_engineer'}).status_code==401
    headers={'Authorization':'Bearer drafting-test-key'}
    response=client.post('/drafting/jobs',headers=headers,json={'roleId':'devops_engineer'})
    assert response.status_code==200
    assert len(response.json()['responsibilities']) >= 6
    assert client.post('/drafting/jobs',headers=headers,json={'roleId':'unknown'}).status_code==422
