"""Source-only editorial operations, separate from factual enrichment.

Category labels describe existing items, never a proficiency or achievement.
Unknown items retain their original category rather than guessing their meaning.
"""
import re
import unicodedata


def key(text: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFKD', text.casefold()) if not unicodedata.combining(c)).strip()


TECH_NAMES = {
    'python': 'Python', 'django': 'Django', 'django rest framework': 'Django REST Framework',
    'javascript': 'JavaScript', 'typescript': 'TypeScript', 'php': 'PHP', 'laravel': 'Laravel',
    'html': 'HTML', 'css': 'CSS', 'sql': 'SQL', 'mysql': 'MySQL', 'sqlite': 'SQLite',
    'postgresql': 'PostgreSQL', 'git': 'Git', 'react native': 'React Native', 'react': 'React',
    'expo': 'Expo', 'node.js': 'Node.js', 'api rest': 'API REST', 'rest api': 'REST API',
    'crud': 'CRUD', 'docker': 'Docker', 'agile/scrum': 'Agile/Scrum',
}
_TECH_PATTERN = re.compile(r'(?<![\w.-])(' + '|'.join(re.escape(x) for x in sorted(TECH_NAMES, key=len, reverse=True)) + r')(?!(?:[\w-]|\.\w))', re.I)


def normalize_technologies(text: str) -> str:
    return _TECH_PATTERN.sub(lambda m: TECH_NAMES[m[0].lower()], text)


GROUPS = (
    ('Backend', 'Backend', 'Python|Django|Django REST Framework|PHP|Laravel|API REST|REST API|Authentification|Node.js'),
    ('Frontend & mobile', 'Frontend & mobile', 'HTML|CSS|JavaScript|TypeScript|React|React Native|React Native (Expo)|Expo|Interfaces responsives'),
    ('Bases de données', 'Databases', 'SQL|MySQL|SQLite|PostgreSQL|Modélisation de données|Optimisation de bases de données|Migrations de base de données'),
    ('Outils & méthodes', 'Tools & methods', 'Git|Agile/Scrum|Docker'),
    ('Conception & qualité', 'Design & quality', "Architecture logicielle|Développement d’API|Développement d'API|Revue de code|CRUD|Débogage"),
)
STRUCTURAL_LABELS = {key(label) for group in GROUPS for label in group[:2]} | {'competences', 'skills'}


def organize_skills(source: str, language: str = 'fr', relevant: list[str] | None = None) -> str:
    # Recover PDF wrapping only inside a category. Never join different categories.
    lines: list[str] = []
    for raw in source.splitlines():
        line = raw.strip().lstrip('• ').strip()
        if not line:
            continue
        if lines and ':' not in line and ':' in lines[-1]:
            lines[-1] += ' ' + line
        else:
            lines.append(line)
    categories: dict[str, list[str]] = {}
    seen: set[str] = set()
    lookup = {key(item): (en if language.startswith('en') else fr) for fr, en, items in GROUPS for item in items.split('|')}
    for line in lines:
        original, content = line.split(':', 1) if ':' in line else ('Skills' if language.startswith('en') else 'Compétences', line)
        # Separators are list delimiters, not slashes inside technology names.
        for item in re.split(r'\s*[·•;|,]\s*', content):
            item = normalize_technologies(item.strip())
            if not item or key(item) in seen:
                continue
            seen.add(key(item))
            category = lookup.get(key(item), original.strip().strip('*'))
            categories.setdefault(category, []).append(item)
    relevance = {key(item): i for i, item in enumerate(relevant or [])}
    for values in categories.values():
        values.sort(key=lambda item: relevance.get(key(item), len(relevance)))
    order = [en if language.startswith('en') else fr for fr, en, _ in GROUPS]
    ordered = sorted(categories, key=lambda label: order.index(label) if label in order else len(order))
    return '\n'.join(f'{label} : {" · ".join(categories[label])}' for label in ordered)


def editorial_text(source: str, job: dict, rewrite_line) -> str:
    scope, kind = job.get('editing_scope'), job.get('section_type')
    if kind in {'skills', 'technical'} and scope != 'line':
        return organize_skills(source, job.get('language') or 'fr', [s['name'] for s in job.get('skills', []) if s.get('name')])
    # Whole-CV callers retain role/date boundaries. Targeted content can be reformatted.
    if scope not in {'content', 'line'}:
        return '\n'.join(rewrite_line(line) for line in source.split('\n'))
    text = normalize_technologies(source)
    if scope == 'line':
        return '\n'.join(rewrite_line(line, selected=True) for line in text.split('\n'))
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in text.splitlines() if line.strip()]
    if kind == 'summary':
        return ' '.join(dict.fromkeys(lines))
    if scope == 'content' and kind in {'experience', 'projects', 'volunteering'} and len(lines) == 1:
        # Split at complete sentences, never decimal numbers or technology punctuation.
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-ZÀ-Ý])', lines[0])
        if len(sentences) > 1:
            lines = ['• ' + part.lstrip('• ') for part in sentences]
    result = '\n'.join(dict.fromkeys(rewrite_line(line, selected=True) for line in lines))
    instruction = str(job.get('writing_instruction') or job.get('instruction') or '').casefold()
    if any(token in instruction for token in ('plus concis', 'plus court', 'shorter', 'concise', 'résumé court')):
        # Compact repeated prose without deleting a supported fact. Sentence and
        # line de-duplication is deterministic and keeps every distinct claim.
        compact: list[str] = []
        for line in result.splitlines():
            normalized = re.sub(r'\s+', ' ', line).strip()
            if normalized and normalized.casefold() not in {item.casefold() for item in compact}:
                compact.append(normalized)
        result = '\n'.join(compact)
    return result
