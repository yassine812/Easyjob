import re

FILLERS = ('euh', 'heu', 'uh', 'um', 'like', 'en fait', 'du coup', 'genre')

def measure(answer: str, speaking_seconds: int | None = None, pauses: int | None = None) -> dict:
    words = re.findall(r"[\wÀ-ÿ'-]+", answer)
    lowered = answer.lower()
    fillers = sum(len(re.findall(rf'(?<!\w){re.escape(word)}(?!\w)', lowered)) for word in FILLERS)
    wpm = round(len(words) * 60 / speaking_seconds) if speaking_seconds else None
    pace = 0.7 if wpm is None else max(0.0, 1 - min(abs(wpm - 145) / 145, 1))
    filler_score = max(0.0, 1 - fillers / max(1, len(words) / 15))
    pause_score = max(0.0, 1 - (pauses or 0) / 8)
    clarity = round((pace * .45 + filler_score * .35 + pause_score * .2), 3)
    return {'word_count': len(words), 'filler_count': fillers, 'words_per_minute': wpm, 'reported_pauses': pauses, 'communication_clarity': clarity}
