from __future__ import annotations
import re
from .communication_metrics import measure
from .skill_extractor import keyword_coverage
from .semantic_similarity import combine_relevance, embedding_similarity, tfidf_similarity
from .follow_up_engine import decide

PERSONAL = re.compile(r"\b(je|j['’]ai|j['’]étais|j['’]ai conçu|i|i['’]ve|i['’]m|my)\b", re.I)
ACTION = re.compile(r"\b(développ|conçu|corrig|mis en œuvre|optimis|implément|analys|tested|built|designed|implemented|fixed|improved)\w*", re.I)
RESULT = re.compile(r"\b(résultat|impact|réduit|augment|amélior|mesur|gagn|réussi|result|impact|reduced|increased|improved|saved)\w*|\d+(?:[.,]\d+)?\s*(?:%|ms|s|jours?|heures?)", re.I)
SITUATION = re.compile(r"\b(contexte|situation|projet|client|incident|when|situation|project)\b", re.I)

def analyze(answer: str, question: str, rubric: dict, speaking_seconds: int | None = None, pauses: int | None = None, use_embeddings: bool = True) -> dict:
    metrics = measure(answer, speaking_seconds, pauses)
    expected = [str(item.get('label')) for item in rubric.get('competencies', []) if item.get('label')]
    skill_coverage, matched = keyword_coverage(answer, expected)
    target = f"{question} {' '.join(expected)}"
    lexical = tfidf_similarity(answer, target)
    semantic = embedding_similarity(answer, target) if use_embeddings else None
    relevance = combine_relevance(lexical, semantic, skill_coverage if expected else None)
    word_factor = min(1.0, metrics['word_count'] / 70)
    personal = 1.0 if PERSONAL.search(answer) and ACTION.search(answer) else .45 if PERSONAL.search(answer) else 0.0
    result_present = bool(RESULT.search(answer))
    specificity = min(1.0, .35 * word_factor + .35 * min(1.0, len(re.findall(r'\d+', answer)) / 2) + .3 * (1 if ACTION.search(answer) else 0))
    star = sum(bool(pattern.search(answer)) for pattern in (SITUATION, PERSONAL, ACTION, RESULT)) / 4
    evidence = round((star * .6 + (1 if result_present else 0) * .2 + personal * .2), 3)
    output = {'job_relevance': round(relevance, 3), 'skill_coverage': round(skill_coverage, 3), 'specificity': round(specificity, 3),
      'evidence_quality': evidence, 'personal_contribution': round(personal, 3), 'result_present': result_present,
      'star_coverage': round(star, 3), 'communication_clarity': metrics['communication_clarity'], 'missing_points': [],
      'matched_skills': matched, 'tfidf_similarity': round(lexical, 3),
      'embedding_similarity': None if semantic is None else round(semantic, 3),
      'analysis_engine': 'local_hybrid' if semantic is not None else 'local_deterministic_fallback',
      **metrics}
    follow, code, wording = decide(output)
    if output['specificity'] < .6: output['missing_points'].append('Ajoute un exemple précis.')
    if not result_present: output['missing_points'].append('Indique un résultat ou une validation observable.')
    if personal < .5: output['missing_points'].append('Précise ton action personnelle.')
    if skill_coverage < .55 and expected: output['missing_points'].append(f"Relie ta réponse à {expected[0]}.")
    output.update({'follow_up_needed': follow, 'follow_up_reason': code, 'follow_up_question': wording})
    return output
