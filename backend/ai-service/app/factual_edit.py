"""Conservative generation gate. Unsupported output falls back to source-preserving edits.

Not a fact verifier: candidates must still review relationships and meaning. In particular,
job requirements may never become candidate credentials merely through generation.
"""
import re
import unicodedata


def _normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text.casefold()) if not unicodedata.combining(c))

def factual_rewrite(source: str, proposal: str, letter: bool = False, section_type: str | None = None) -> bool:
    if not proposal.strip():
        return False
    # A new year, percentage, count, contact address or URL is never a harmless rewrite.
    if set(re.findall(r'\d+(?:[.,]\d+)?', proposal)) - set(re.findall(r'\d+(?:[.,]\d+)?', source)):
        return False
    for pattern in (r'[\w.+-]+@[\w.-]+', r'https?://[^\s)]+'):
        if set(re.findall(pattern, proposal)) - set(re.findall(pattern, source)):
            return False
    # Neutral category labels are layout, not new candidate facts. Only exempt
    # known labels at the start of skills lines, never vocabulary in the body.
    if not letter and section_type in {'skills', 'technical'}:
        from app.editorial import STRUCTURAL_LABELS, key
        proposal = '\n'.join(line.split(':', 1)[1] if ':' in line and key(line.split(':', 1)[0].strip('* ')) in STRUCTURAL_LABELS else line for line in proposal.splitlines())
    source_words = set(re.findall(r'\w+', _normalize(source)))
    grammar = set('a an the and or of to for in on with by from at as this that my your le la les un une des du de d l et ou en dans sur avec pour par au aux ce cette mon ma mes son sa ses est sont etre be is are was were je i vous pendant durant'.split())
    if letter:
        grammar |= set('dear hiring cordialement madame monsieur regards sincerely thank thanks consideration opportunity discuss application applying position role cv presents lists background yours sincerely candidate candidature poste parcours entretien discuter remercie attention souhaiterais heureux presente mentionne offre votre vos nous motivation professional professionalisme respectueusement vous adresse notamment egalement describes described remercie opportunite rejoindre interesse salutations competences'.split())
    families = ['developpement developper developpe developpes developpee developed develop developing', 'conception concevoir concu design designed designing', 'gestion gerer gere manage managed managing', 'maintenance maintenir maintenu maintain maintained maintaining', 'livraison livrer livre deliver delivered delivering', 'creation creer cree create created creating', 'contribution contribuer contribue contribute contributed contributing', 'implementation implementer implemente implemented implement implementing', 'utilisation utiliser utilise use used using', 'mise mettre mis']
    vocabulary = source_words | grammar
    families += ['optimisation optimiser optimise', 'configuration configurer configure', 'administration administrer administre', 'integration integrer integre', 'automatisation automatiser automatise', 'analyse analyser analyse', 'realisation realiser realise', 'renforcement renforcer renforce', 'participation participer participe', 'maintien maintenir maintenu']
    for family in families:
        words = set(family.split())
        if source_words & words:
            vocabulary |= words
    novel = set(re.findall(r'\w+', _normalize(proposal))) - vocabulary
    # Only plural inflections are accepted beyond existing factual vocabulary.
    return all(word.rstrip('s') in vocabulary for word in novel)
