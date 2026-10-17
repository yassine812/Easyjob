import pytest

from app.interview_ai.resources import preload
from app.interview_ai.semantic_similarity import embedding_similarity, tfidf_similarity


@pytest.fixture(scope="module", autouse=True)
def local_multilingual_embeddings():
    state = preload(allow_download=False)
    if not state["embeddings"]:
        pytest.skip("Local sentence-transformer cache is unavailable")


def test_paraphrase_is_more_relevant_than_an_unrelated_answer():
    question = "Comment avez-vous conçu et validé une API Django sécurisée avec PostgreSQL ?"
    paraphrase = "J'ai créé des services web Python reliés à une base relationnelle et automatisé les vérifications."
    unrelated = "J'aime voyager et cuisiner le week-end."
    assert embedding_similarity(question, paraphrase) > embedding_similarity(question, unrelated) + 0.15
    # This preserves the benchmark's demonstration of why lexical matching alone is insufficient.
    assert tfidf_similarity(question, paraphrase) < embedding_similarity(question, paraphrase)


@pytest.mark.parametrize(
    ("job", "answer", "unrelated"),
    [
        ("Développer des API Django sécurisées avec PostgreSQL et des tests.", "J'ai conçu des services Python connectés à une base relationnelle et ajouté des vérifications automatiques.", "Je cuisine et je voyage le week-end."),
        ("Build secure Django REST APIs with PostgreSQL and automated tests.", "I built Python web services backed by a relational database and added automated checks.", "I enjoy cooking and travelling at weekends."),
        ("Build secure Django REST APIs with PostgreSQL and automated tests.", "J'ai développé des services Python reliés à une base de données relationnelle et automatisé les tests.", "Je préfère cuisiner pendant mon temps libre."),
    ],
)
def test_multilingual_embeddings_keep_relevant_answers_above_unrelated(job, answer, unrelated):
    assert embedding_similarity(job, answer) > embedding_similarity(job, unrelated) + 0.15
