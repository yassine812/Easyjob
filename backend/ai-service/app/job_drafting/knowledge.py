import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from rapidfuzz.distance import Levenshtein
from .models import Family, Role

DATA = Path(__file__).parent / 'data'

def normalize(value: str) -> str:
    value = ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if not unicodedata.combining(c))
    return re.sub(r'[^\w]+', ' ', value, flags=re.UNICODE).strip()

class JobKnowledgeBase:
    def __init__(self):
        self.roles = {role.id: role for role in (Role.model_validate(item) for item in json.loads((DATA / 'roles.json').read_text(encoding='utf-8')))}
        self.families = {key: Family.model_validate(value) for key, value in json.loads((DATA / 'families.json').read_text(encoding='utf-8')).items()}
        self.source = json.loads((DATA / 'onet-31.0.json').read_text(encoding='utf-8'))
        self.occupations = {item['onetsoc_code']: item for item in self.source['tables']['occupation_data']}
        for role in self.roles.values():
            if role.family not in self.families or any(code not in self.occupations for code in role.source_codes):
                raise ValueError(f'Incomplete provenance for {role.id}')
            if set(role.core_skills) & set(role.optional_skills):
                raise ValueError(f'Duplicate skill classification for {role.id}')
            if any(related not in self.roles for related in role.related_roles):
                raise ValueError(f'Unknown related role for {role.id}')

    def get(self, role_id: str) -> Role:
        if role_id not in self.roles:
            raise ValueError('Unknown occupation')
        return self.roles[role_id]

    def source_records(self, role: Role):
        return {table: [row for row in rows if row['onetsoc_code'] in role.source_codes] for table, rows in self.source['tables'].items()}

    def suggest(self, query: str):
        q = normalize(query[:150])
        if len(q) < 2:
            return []
        def tokens(candidate):
            return all(any(word.startswith(token) for word in candidate.split()) for token in q.split())
        def rank(role):
            labels = list(map(normalize, [role.canonical_title, *role.localized_titles.model_dump().values()]))
            aliases = list(map(normalize, role.aliases))
            if q in labels: return 100
            if any(label.startswith(q) for label in labels): return 98
            if any(tokens(label) for label in labels): return 90
            if any(alias.startswith(q) or tokens(alias) for alias in aliases): return 80
            if len(q) < 4: return 0
            similarity = max(Levenshtein.normalized_similarity(q, candidate) for candidate in labels + aliases)
            return 50 + similarity * 10 if similarity >= .82 else 0
        ranked = [(role, rank(role)) for role in self.roles.values()]
        best = max(score for _, score in ranked)
        anchors = [role for role, score in ranked if len(q) >= 4 and score == best and score >= 80]
        families = {role.family for role in anchors}
        allowed = {role.id for role, _ in ranked if role.family in families} | {r for role in anchors for r in role.related_roles}
        ranked = [(role, max(score, 70 if role.id in allowed else 0)) for role, score in ranked if not allowed or role.id in allowed]
        ranked = sorted(((r, s) for r, s in ranked if s >= 58.2), key=lambda item: (-item[1], len(item[0].canonical_title), item[0].canonical_title))[:6]
        locale = 'ar' if re.search(r'[\u0600-\u06ff]', q) else 'fr' if re.search('developpeur|ingenieur|analyste|designer|chef', q) else 'en'
        return [{'id': role.id, 'label': getattr(role.localized_titles, locale)} for role, _ in ranked]

@lru_cache(maxsize=1)
def knowledge_base():
    return JobKnowledgeBase()
