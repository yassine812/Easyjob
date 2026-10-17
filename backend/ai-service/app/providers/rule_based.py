"""Deterministic heuristic provider.

Used in development and automated tests so the whole AI pipeline is exercisable
without external credentials. Scores are computed from structured data — no
hallucinated facts: generated CVs contain only the provided profile fields.
"""
import re
import json
from typing import Any

from app.providers.base import AIProvider
from app.editorial import editorial_text


def _contextual_translation(value: str, source_locale: str, target_locale: str) -> str:
    """Small offline safety net for full structured variants.

    The hosted provider performs the professional translation. When it is not
    configured, this still translates the common CV vocabulary and preserves
    every structured field instead of silently producing a labels-only copy.
    """
    if not value or source_locale[:2] == target_locale[:2]:
        return value
    if source_locale.startswith('fr') and target_locale.startswith('en'):
        pairs = (
            ('Développeur Full-Stack', 'Full-Stack Developer'), ('Développeur Backend', 'Backend Developer'), ('Chef de projet', 'Project Manager'),
            ('Profil professionnel', 'Professional Summary'), ('Expérience professionnelle', 'Work Experience'), ('Compétences techniques', 'Technical Skills'),
            ('Compétences', 'Skills'), ('Formation', 'Education'), ('Langues', 'Languages'), ('Certifications', 'Certifications'), ('Projets', 'Projects'),
            ('Réalisations', 'Achievements'), ('Bénévolat', 'Volunteer Experience'), ('Publications', 'Publications'), ('Centres d’intérêt', 'Interests'),
            ('Liens / Portfolio', 'Links / Portfolio'), ('Rubrique personnalisée', 'Custom Section'), ('expérimenté en développement web, mobile et backend', 'with experience across web, mobile, and backend development'),
            ('Maîtrise de', 'Skilled in'), ('Développement et maintenance d’API REST avec', 'Developed and maintained REST APIs using'), ('Développement et maintenance d\'API REST avec', 'Developed and maintained REST APIs using'),
            ('A développé des applications métier pour la gestion de l’audit', 'Developed business applications for audit management'), ('A développé des applications métier pour la gestion d\'audit', 'Developed business applications for audit management'),
            ('A développé', 'Developed'), ('applications métier', 'business applications'), ('gestion de l’audit', 'audit management'), ('gestion d\'audit', 'audit management'), ('l’authentification', 'authentication'), ('l\'authentification', 'authentication'), ('la gestion des données', 'data management'), ('le reporting', 'reporting'), ('Expérience en développement d’API REST', 'Experience developing REST APIs'), ('Expérience en développement d\'API REST', 'Experience developing REST APIs'), ('optimisation de bases de données', 'database optimization'), ('revue de code', 'code review'), ('travail en équipe Agile', 'Agile team collaboration'), (' et ', ' and '),
            ('Développement', 'Development'), ('Maintenance', 'Maintenance'), ('aujourd’hui', 'Present'), ('Aujourd’hui', 'Present'), ('Présent', 'Present'),
            ('janvier', 'January'), ('février', 'February'), ('mars', 'March'), ('avril', 'April'), ('mai', 'May'), ('juin', 'June'), ('juillet', 'July'),
            ('août', 'August'), ('septembre', 'September'), ('octobre', 'October'), ('novembre', 'November'), ('décembre', 'December'),
        )
    else:
        labels = {
            'es': {'Profil professionnel': 'Perfil profesional', 'Expérience professionnelle': 'Experiencia profesional', 'Formation': 'Formación', 'Compétences techniques': 'Habilidades técnicas', 'Compétences': 'Habilidades', 'Projets': 'Proyectos'},
            'de': {'Profil professionnel': 'Berufliches Profil', 'Expérience professionnelle': 'Berufserfahrung', 'Formation': 'Ausbildung', 'Compétences techniques': 'Technische Kenntnisse', 'Compétences': 'Kenntnisse', 'Projets': 'Projekte'},
            'it': {'Profil professionnel': 'Profilo professionale', 'Expérience professionnelle': 'Esperienza professionale', 'Formation': 'Formazione', 'Compétences techniques': 'Competenze tecniche', 'Compétences': 'Competenze', 'Projets': 'Progetti'},
            'pt': {'Profil professionnel': 'Resumo profissional', 'Expérience professionnelle': 'Experiência profissional', 'Formation': 'Formação', 'Compétences techniques': 'Competências técnicas', 'Compétences': 'Competências', 'Projets': 'Projetos'},
            'nl': {'Profil professionnel': 'Professioneel profiel', 'Expérience professionnelle': 'Werkervaring', 'Formation': 'Opleiding', 'Compétences techniques': 'Technische vaardigheden', 'Compétences': 'Vaardigheden', 'Projets': 'Projecten'},
            'ar': {'Profil professionnel': 'الملف المهني', 'Expérience professionnelle': 'الخبرة المهنية', 'Formation': 'التعليم', 'Compétences techniques': 'المهارات التقنية', 'Compétences': 'المهارات', 'Projets': 'المشاريع'},
        }
        pairs = tuple(labels.get(target_locale[:2], {}).items())
    for source, target in pairs:
        value = re.sub(re.escape(source), target, value, flags=re.I)
    return value


def _translate_document(document: dict[str, Any], source_locale: str, target_locale: str) -> dict[str, Any]:
    next_document = json.loads(json.dumps(document, ensure_ascii=False))
    personal = next_document.get('personal') or {}
    if isinstance(personal, dict):
        for key in ('title', 'extra'):
            if isinstance(personal.get(key), str): personal[key] = _contextual_translation(personal[key], source_locale, target_locale)
    for section in next_document.get('sections') or []:
        if isinstance(section, dict):
            if isinstance(section.get('title'), str): section['title'] = _contextual_translation(section['title'], source_locale, target_locale)
            for entry in section.get('entries') or []:
                if not isinstance(entry, dict): continue
                # Organization and location are proper nouns or factual
                # identity fields; never run them through translation.
                for key in ('title', 'period', 'text'):
                    if isinstance(entry.get(key), str): entry[key] = _contextual_translation(entry[key], source_locale, target_locale)
                for bullet in entry.get('bullets') or []:
                    if isinstance(bullet, dict) and isinstance(bullet.get('text'), str): bullet['text'] = _contextual_translation(bullet['text'], source_locale, target_locale)
    return next_document

SENIORITY_LEVELS = {"JUNIOR": 1, "MID": 2, "SENIOR": 3, "LEAD": 4, "EXECUTIVE": 5}
EXPERIENCE_LEVELS = {"JUNIOR": 1, "MID": 2, "SENIOR": 3, "LEAD": 4, "EXECUTIVE": 5}


def _normalize(skill: str) -> str:
    return skill.strip().lower()


def _clamp(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _rewrite_cv_line(line: str, *, selected: bool = False) -> str:
    """Make evidenced responsibility statements direct; never supply missing results."""
    # PDF extractors preserve several visually identical bullet glyphs.
    bullet = r"[-*•●▪◦‣∙\uf0b7]"
    match = re.match(rf"^(\s*(?:{bullet}\s*)?)(.*)$", line)
    prefix, text = match.groups()
    if not selected and not re.match(rf"\s*{bullet}", line):
        return line
    # Infinitives keep the source's responsibility scope: no new accomplishment claims.
    verbs = (
        (r"Conception et livraison", "Concevoir et livrer"),
        (r"Conception et développement", "Concevoir et développer"),
        (r"Mise en (?:œ|oe)uvre", "Mettre en œuvre"),
        (r"Développement", "Développer"), (r"Conception", "Concevoir"),
        (r"Gestion", "Gérer"), (r"(?:Maintien|Maintenance)", "Maintenir"),
        (r"Optimisation", "Optimiser"), (r"Création", "Créer"),
        (r"Configuration", "Configurer"), (r"Administration", "Administrer"),
        (r"Intégration", "Intégrer"), (r"Automatisation", "Automatiser"),
        (r"Analyse", "Analyser"), (r"Réalisation", "Réaliser"),
        (r"Renforcement", "Renforcer"), (r"Livraison", "Livrer"),
    )
    for noun, verb in verbs:
        found = re.match(rf"^{noun}\s+(de la |de l['’]|du |des |d['’]|de )(.+)$", text, re.I)
        if found:
            article, rest = found.groups()
            articles = {"de la ": "la ", "du ": "le ", "des ": "les ", "de l'": "l'", "de l’": "l’", "d'": "", "d’": "", "de ": ""}
            determiner = articles[article.lower()]
            if article.lower() in {"de ", "d'", "d’"}:
                first = rest.split()[0].lower()
                if first in {'un', 'une', 'plusieurs', 'nombreux', 'nombreuses'} or first[0].isdigit():
                    determiner = ''
                elif first.endswith(('s', 'x')) or first in {'api'}:
                    determiner = 'des '
                elif first in {'code', 'reporting', 'support', 'logiciel'}:
                    determiner = 'du '
                else:
                    return line
            return prefix + verb + " " + determiner + rest
    text = re.sub(r"^Contribution (à|au|aux)\s", r"Contribuer \1 ", text)
    text = re.sub(r"^Participation (à|au|aux)\s", r"Participer \1 ", text)
    text = re.sub(r"^Responsible for (developing|building|managing|maintaining|designing|implementing)\b",
                  lambda m: {"developing": "Develop", "building": "Build", "managing": "Manage", "maintaining": "Maintain", "designing": "Design", "implementing": "Implement"}[m[1].lower()], text, flags=re.I)
    return prefix + text


class RuleBasedProvider(AIProvider):
    name = "rule_based"

    def analyze_cv(self, text: str, filename: str | None = None) -> dict[str, Any]:
        words = re.findall(r"\w+", text, re.UNICODE)
        checks = {
            "Readable text (at least 80 words)": len(words) >= 80,
            "Email address": bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)),
            "Phone number": bool(re.search(r"\+?\d[\d ().-]{7,}\d", text)),
            "Experience section": bool(re.search(r"(?im)^\s*(?:#+\s*)?(experience|expériences?|الخبرات)\s*:?\s*$", text)),
            "Education section": bool(re.search(r"(?im)^\s*(?:#+\s*)?(education|formation|التعليم)\s*:?\s*$", text)),
            "Skills section": bool(re.search(r"(?im)^\s*(?:#+\s*)?(skills|compétences|المهارات)\s*:?\s*$", text)),
        }
        score = round(sum(checks.values()) / len(checks) * 100) if text.strip() else None
        return {
            "overall_score": score, "ats_compatibility": score,
            "strengths": [key for key, passed in checks.items() if passed],
            "weaknesses": [f"Not detected: {key}" for key, passed in checks.items() if not passed],
            "missing_skills": [], "keyword_recommendations": [],
            "improvement_suggestions": ["Review undetected sections. Add only accurate information.",
                "Choose a target job in ATS Analysis to compare its actual skill requirements."],
            "structure_quality": "text-only estimate", "estimated": True,
            "method": "text_checks_v1", "limitations": ["Document layout was not evaluated", "No target job supplied"],
        }
    def generate_cv(self, profile: dict[str, Any]) -> dict[str, Any]:
        if profile.get("sourceCvText"):
            return {"cv_markdown": str(profile["sourceCvText"]), "method": "source_preserving"}
        name = profile.get("name") or "Candidate"
        headline = profile.get("headline") or ""
        skills = ", ".join(s.get("name", "") for s in profile.get("skills", []) if s.get("name"))
        experiences = profile.get("experiences", [])
        educations = profile.get("educations", [])

        lines = [
            f"# {name}",
            "",
            headline or "Professional profile",
            "",
            "## Summary",
            profile.get("bio") or "",
            "",
            "## Skills",
            skills or "—",
            "",
            "## Experience",
        ]
        for exp in experiences:
            period = f"{exp.get('startDate')} – {exp.get('endDate') or 'present'}"
            lines.append(f"### {exp.get('title', '')} at {exp.get('companyName', '')} ({period})")
            if exp.get("description"):
                lines.append(exp["description"])
            lines.append("")
        lines.append("## Education")
        for edu in educations:
            lines.append(f"- {edu.get('degree', '')} in {edu.get('field', '')} — {edu.get('institution', '')}")
        if not educations:
            lines.append("- ")
        lines.append("")
        extra = profile.get("professionalData") or {}
        for section, values in (extra.get("sections") or {}).items():
            if values:
                lines.extend([f"## {section.title()}", *[str(v) for v in values], ""])
        lines.append("_Generated from the candidate's profile data only; no external information was added._")

        return {"cv_markdown": "\n".join(lines)}

    def tailor_cv(self, cv_text: str, job: dict[str, Any]) -> dict[str, Any]:
        job_skills = [s.get("name", "").lower() for s in job.get("skills", []) if s.get("name")]
        verified_facts = str(job.get("candidate_verified_facts") or "").strip()
        source = cv_text
        if verified_facts and verified_facts.casefold() not in source.casefold():
            source = f"{source.rstrip()}\n{verified_facts}"
        # Never append missing job skills as though the candidate possesses them.
        verified = [skill for skill in job_skills if re.search(r"(?<!\w)" + re.escape(skill) + r"(?!\w)", source.lower())]
        rewritten = editorial_text(source, job, _rewrite_cv_line)
        # A second request should not return the same visible suggestion. The
        # alternate phrasing remains source-only: it changes presentation, not
        # facts, and never copies the user's instruction into the CV.
        if job.get("current_suggestion") and rewritten.strip() == str(job["current_suggestion"]).strip():
            rewritten = editorial_text(rewritten, {**job, "writing_instruction": "Plus professionnel"}, _rewrite_cv_line)
        if job.get("current_suggestion") and rewritten.strip() == str(job["current_suggestion"]).strip():
            # Keep the alternative materially different even when the local
            # rewrite has already reached a fixed point.
            rewritten = re.sub(r"^\s*[•●▪◦‣∙]\s*", "- ", rewritten, flags=re.M)
        if job.get("current_suggestion") and rewritten.strip() == str(job["current_suggestion"]).strip():
            # Category lists may not contain bullets, so vary only a neutral
            # delimiter as a final deterministic alternative.
            rewritten = rewritten.replace(" · ", " • ")
        # Keep roles, dates and their bullets together. Never sort arbitrary PDF paragraphs.
        paragraphs = re.split(r"(?=^## )", rewritten, flags=re.M)
        body = sorted(paragraphs[1:], key=lambda p: -sum(skill in p.lower() for skill in verified))
        return {
            "tailored_cv": "".join(paragraphs[:1] + body),
            "method": "source_preserving_rewrite",
            "suggested_keywords": [skill for skill in job_skills if skill not in verified],
        }

    def translate_cv(self, document: dict[str, Any], source_locale: str, target_locale: str, context: dict[str, Any]) -> dict[str, Any]:
        translated = _translate_document(document, source_locale, target_locale)
        return {"document": translated, "translated": True, "method": "contextual_offline_translation", "requires_review": source_locale[:2] == 'fr' and target_locale[:2] != 'fr'}

    def analyze_job(self, job: dict[str, Any]) -> dict[str, Any]:
        skills = [s.get("name", "") for s in job.get("skills", []) if s.get("name")]
        return {
            "summary": f"{job.get('title', '')} role requiring {len(skills)} key skills.",
            "key_skills": skills,
            "suggested_titles": [job.get("title", "")],
        }

    def match(self, candidate: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
        candidate_skills = {_normalize(s.get("name", "")) for s in candidate.get("skills", [])}
        job_skills = [s for s in job.get("skills", []) if s.get("name")]
        required = [_normalize(s.get("name")) for s in job_skills if s.get("required")]
        preferred = [_normalize(s.get("name")) for s in job_skills if not s.get("required")]
        matched_req = sum(1 for s in required if s in candidate_skills)
        matched_pref = sum(1 for s in preferred if s in candidate_skills)
        skill_score = (
            (matched_req + matched_pref * 0.5) / max(len(required) + len(preferred) * 0.5, 1)
        ) * 100

        exp_years = candidate.get("yearsExperience") or 0
        job_level = job.get("experienceLevel") or "MID"
        level_req = EXPERIENCE_LEVELS.get(job_level, 2)
        expected_years = level_req * 2 - 1
        experience_score = min(100, (exp_years / max(expected_years, 1)) * 100)

        cand_loc = (candidate.get("location") or "").lower()
        job_loc = (job.get("location") or "").lower()
        if job.get("remote"):
            location_score = 100
        elif cand_loc and job_loc and (cand_loc in job_loc or job_loc in cand_loc):
            location_score = 100
        else:
            location_score = 0

        cand_level = str(job.get("experienceLevel", "")).lower() in str(candidate.get("headline", "")).lower() and bool(job.get("experienceLevel"))
        seniority_score = 100 if cand_level else 0

        overall = _clamp(skill_score * 0.5 + experience_score * 0.2 + location_score * 0.15 + seniority_score * 0.15)

        return {
            "skill_match": _clamp(skill_score),
            "experience_match": _clamp(experience_score),
            "location_match": _clamp(location_score),
            "seniority_match": _clamp(seniority_score),
            "overall_match": overall,
            "reasoning": (
                f"Skill match {_clamp(skill_score)}%, experience {_clamp(experience_score)}%, "
                f"location {_clamp(location_score)}%. Score is heuristic and indicative only."
            ),
        }

    def cover_letter(self, candidate: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
        name = str(candidate.get("name") or "").strip()
        title = str(job.get("title") or "the position").strip()
        company = str(job.get("company") or "").strip()
        locale = job.get("locale", "en")
        length = job.get('length', 'standard')
        source = str(candidate.get("sourceCvText") or "").strip()
        profile_skills = [str(s.get("name", "")).strip() for s in candidate.get("skills", []) if isinstance(s, dict) and s.get("name")]
        job_skills = [str(s.get("name", "")) if isinstance(s, dict) else str(s) for s in job.get("skills", [])]
        job_text = " ".join([title, str(job.get("description") or ""), " ".join(job_skills), str(job.get("requirements") or "")])
        def mentioned(text, term):
            return bool(term.strip()) and bool(re.search(r"(?<!\w)" + re.escape(term.strip()) + r"(?!\w)", text, re.I))
        # A chosen CV is authoritative. Never borrow claims from a different CV
        # or the general profile when composing this application.
        pool = list(dict.fromkeys(job_skills + profile_skills)) if source else profile_skills
        skills = [skill for skill in pool if (not source or mentioned(source, skill)) and mentioned(job_text, skill)][:5]
        if not source and not skills:
            skills = profile_skills[:4]
        terms = set(re.findall(r"[\w+#.-]{4,}", job_text.lower()))
        excerpts = [line.strip() for line in source.splitlines() if 40 <= len(line.strip()) <= 300 and '@' not in line and 'http' not in line]
        excerpts = sorted(excerpts, key=lambda line: -len(set(re.findall(r"[\w+#.-]{4,}", line.lower())) & terms))
        supported_excerpts = list(dict.fromkeys(line for line in excerpts if set(re.findall(r"[\w+#.-]{4,}", line.lower())) & terms))
        excerpt = '' if length == 'short' else '\n'.join(supported_excerpts[:2 if length == 'detailed' else 1])
        evidence = []
        if locale == 'fr':
            salutation = 'Madame, Monsieur,'
            opening = f"Je vous adresse ma candidature au poste de {title}" + (f" chez {company}." if company else '.')
            if skills:
                evidence.append("Mon CV présente des compétences en " + ', '.join(skills) + ", également mentionnées dans votre offre.")
            if excerpt:
                evidence.append("Il décrit notamment cet élément de mon parcours : « " + excerpt + " ».")
            closing = "Je serais heureux de vous présenter mon parcours et de discuter de votre poste lors d’un entretien. Je vous remercie pour l’attention portée à ma candidature."
            signoff = f"Cordialement,\n{name}"
        elif locale == 'ar':
            salutation = 'السادة فريق التوظيف،'
            opening = f"أتقدم بترشحي لوظيفة {title}" + (f" لدى {company}." if company else '.')
            if skills:
                evidence.append('تتضمن سيرتي الذاتية مهارات مذكورة في عرضكم: ' + '، '.join(skills) + '.')
            if excerpt:
                evidence.append('وتعرض هذا الجانب من مساري: « ' + excerpt + ' ».')
            closing = 'يسعدني مناقشة مساري ومتطلبات الوظيفة خلال مقابلة. أشكركم على النظر في ترشحي.'
            signoff = f"مع خالص التحية،\n{name}"
        else:
            salutation = f"Dear Hiring Team at {company}," if company else "Dear Hiring Team,"
            opening = f"I am applying for the {title} position."
            if skills:
                evidence.append('My CV lists these skills: ' + ', '.join(skills) + '.')
            if excerpt:
                evidence.append('It describes this part of my background: “' + excerpt + '”.')
            closing = 'I would welcome the opportunity to discuss my background and your role. Thank you for considering my application.'
            signoff = f"Best regards,\n{name}"
        letter = "\n\n".join(part for part in [salutation, opening, ' '.join(evidence), closing, signoff] if part)
        return {"cover_letter": letter}

    def interview(self, job: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
        title = job.get("title") or "the role"
        skills = [s.get("name", "") for s in job.get("skills", [])][:3]
        questions = [
            f"Walk me through your most relevant experience for the {title} role.",
            *[f"Describe a project where you used {skill}." for skill in skills],
            "How do you handle disagreements with colleagues?",
            "Where do you see yourself in three years?",
        ]
        return {"questions": questions}

