from __future__ import annotations
import random

TEMPLATES = {
    'ASK_FOR_EXAMPLE': ['Peux-tu donner un exemple précis ?', 'Sur quel cas concret t’appuies-tu ?'],
    'ASK_FOR_RESULT': ['Quel a été le résultat concret ?', 'Comment as-tu mesuré l’impact de cette action ?'],
    'ASK_FOR_PERSONAL_ROLE': ['Quel a été ton rôle personnel dans cette action ?', 'Qu’as-tu fait toi-même, précisément ?'],
    'ASK_TECHNICAL_DETAIL': ['Quelle technologie ou quelle méthode as-tu utilisée ?', 'Peux-tu détailler ton raisonnement technique ?'],
}

def decide(analysis: dict, seed: int = 0) -> tuple[bool, str | None, str | None]:
    if analysis['specificity'] < .6:
        code = 'ASK_FOR_EXAMPLE'
    elif not analysis['result_present']:
        code = 'ASK_FOR_RESULT'
    elif analysis['personal_contribution'] < .5:
        code = 'ASK_FOR_PERSONAL_ROLE'
    elif analysis['skill_coverage'] < .55:
        code = 'ASK_TECHNICAL_DETAIL'
    else:
        return False, None, None
    return True, code, random.Random(seed).choice(TEMPLATES[code])
