"""Deterministic endpoints: no provider dependency, inference, embeddings or downloads."""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import require_api_key
from app.job_drafting.engine import DraftQualityError, generate
from app.job_drafting.knowledge import knowledge_base
from app.job_drafting.models import DraftRequest, GeneratedJobDraft

router = APIRouter(dependencies=[Depends(require_api_key)])
logger = logging.getLogger(__name__)

@router.get('/jobs/titles')
def titles(q: str = Query(default='', max_length=150)):
    return knowledge_base().suggest(q)

@router.post('/jobs', response_model=GeneratedJobDraft)
def draft(payload: DraftRequest):
    try:
        return generate(payload)
    except DraftQualityError:
        logger.error('Draft rejected by editorial quality checks for role %s', payload.roleId)
        raise HTTPException(503, 'Draft quality validation failed') from None
    except ValueError:
        raise HTTPException(422, 'Unsupported occupation or invalid draft') from None
