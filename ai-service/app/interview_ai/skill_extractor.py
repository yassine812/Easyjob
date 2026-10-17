import re

SKILL_DICTIONARY = (
    'python', 'django', 'django rest framework', 'react', 'react native', 'javascript',
    'typescript', 'java', 'c#', '.net', 'php', 'laravel', 'sql', 'mysql', 'postgresql',
    'mongodb', 'redis', 'graphql', 'rest api', 'docker', 'kubernetes', 'aws', 'azure',
    'gcp', 'linux', 'git', 'agile', 'scrum', 'ci/cd', 'testing', 'microservices',
)

def normalized(text: str) -> str:
    return re.sub(r'\s+', ' ', text.lower()).strip()

def extract_skills(text: str, supplied: list[str] | None = None) -> list[str]:
    haystack = normalized(text)
    candidates = [str(value).strip() for value in supplied or [] if str(value).strip()] + list(SKILL_DICTIONARY)
    found: list[str] = []
    found_keys: set[str] = set()
    for skill in candidates:
        value = normalized(skill)
        if value and re.search(rf'(?<!\w){re.escape(value)}(?!\w)', haystack, re.I) and value not in found_keys:
            found.append(skill)
            found_keys.add(value)
    return found

def keyword_coverage(text: str, expected: list[str]) -> tuple[float, list[str]]:
    if not expected:
        return 1.0, []
    found = extract_skills(text, expected)
    expected_lower = {normalized(skill): skill for skill in expected}
    matched = [expected_lower[normalized(skill)] for skill in found if normalized(skill) in expected_lower]
    return len(matched) / len(expected), matched
