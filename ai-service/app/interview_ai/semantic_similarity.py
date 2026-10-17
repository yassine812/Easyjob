"""Local lexical and semantic comparisons used by the interview engine."""
from __future__ import annotations

from .resources import embedding_model


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def tfidf_similarity(left: str, right: str) -> float:
    if not left.strip() or not right.strip():
        return 0.0
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        matrix = TfidfVectorizer(stop_words=None, ngram_range=(1, 2)).fit_transform([left, right])
        return _clamp(float(cosine_similarity(matrix[0], matrix[1])[0][0]))
    except Exception:
        a, b = set(left.lower().split()), set(right.lower().split())
        return len(a & b) / max(1, len(a | b))


def embedding_similarity(left: str, right: str) -> float | None:
    if not left.strip() or not right.strip():
        return 0.0
    model = embedding_model()
    if model is None:
        return None
    try:
        vectors = model.encode([left, right], normalize_embeddings=True, show_progress_bar=False)
        return _clamp(float(vectors[0] @ vectors[1]))
    except Exception:
        return None


def combine_relevance(
    lexical_score: float,
    semantic_score: float | None,
    skill_coverage: float | None,
    lexical_weight: float = 0.1,
    semantic_weight: float = 0.65,
    skill_weight: float = 0.25,
) -> float:
    """Combine independent signals; unavailable semantic scoring is never faked."""
    components = [(lexical_score, lexical_weight)]
    if skill_coverage is not None:
        components.append((skill_coverage, skill_weight))
    if semantic_score is not None:
        components.append((semantic_score, semantic_weight))
    denominator = sum(weight for _, weight in components)
    return _clamp(sum(score * weight for score, weight in components) / denominator)


def similarity(left: str, right: str) -> float:
    """Compatibility helper: semantic score when preloaded, otherwise TF-IDF."""
    semantic = embedding_similarity(left, right)
    return semantic if semantic is not None else tfidf_similarity(left, right)
