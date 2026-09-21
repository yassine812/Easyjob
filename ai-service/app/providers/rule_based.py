"""Deterministic heuristic provider.

Used in development and automated tests so the whole AI pipeline is exercisable
without external credentials. Scores are computed from structured data — no
hallucinated facts: generated CVs contain only the provided profile fields.
"""
import re
from typing import Any

from app.providers.base import AIProvider

SENIORITY_LEVELS = {"JUNIOR": 1, "MID": 2, "SENIOR": 3, "LEAD": 4, "EXECUTIVE": 5}
EXPERIENCE_LEVELS = {"JUNIOR": 1, "MID": 2, "SENIOR": 3, "LEAD": 4, "EXECUTIVE": 5}


def _normalize(skill: str) -> str:
    return skill.strip().lower()


def _clamp(value: float) -> int:
    return max(0, min(100, int(round(value))))


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
        title = job.get("title", "the position")
        # Never append missing job skills as though the candidate possesses them.
        verified = [skill for skill in job_skills if re.search(r"(?<!\w)" + re.escape(skill) + r"(?!\w)", cv_text.lower())]
        paragraphs = re.split(r"\n\s*\n", cv_text)
        body = sorted(paragraphs[1:], key=lambda p: -sum(skill in p.lower() for skill in verified))
        return {
            "tailored_cv": "\n\n".join(paragraphs[:1] + body),
            "method": "source_preserving",
            "suggested_keywords": [skill for skill in job_skills if skill not in verified],
        }

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
        name = candidate.get("name") or "the candidate"
        title = job.get("title") or "the role"
        company = job.get("company") or "your company"
        skills = [s.get("name", "") for s in candidate.get("skills", [])][:4]
        skill_line = ", ".join(skills) if skills else "relevant experience"
        letter = (
            f"Dear Hiring Team at {company},\n\n"
            f"My name is {name} and I am applying for the {title} position. "
            f"My background includes {skill_line}, which I believe maps well to your requirements.\n\n"
            f"I would welcome the opportunity to discuss how I can contribute to {company}.\n\n"
            f"Best regards,\n{name}"
        )
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

