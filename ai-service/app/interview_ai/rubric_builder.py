from __future__ import annotations
import re
from .skill_extractor import extract_skills, normalized

def build_rubric(job: dict, candidate: dict, interview_type: str) -> dict:
    title, description = str(job.get('title') or ''), str(job.get('description') or '')
    supplied = [str(item.get('name') if isinstance(item, dict) else item) for item in job.get('skills', [])]
    # Employer-supplied skills are authoritative even when the job narrative
    # does not repeat them. They remain explicit evidence for local scoring.
    required = []
    for skill in supplied + extract_skills(f'{title}\n{description}', supplied):
        if normalized(skill) not in {normalized(item) for item in required}:
            required.append(skill)
    candidate_skills = extract_skills(str(candidate.get('text') or ''))
    candidate_index = {normalized(skill) for skill in candidate_skills}
    competencies = []
    for index, skill in enumerate(required[:12]):
        in_title = normalized(skill) in normalized(title)
        competencies.append({'key': f'competency_{index}', 'label': skill, 'importance': 1.0 if in_title else .8,
          'required': True, 'candidate_match': normalized(skill) in candidate_index,
          'expectedEvidence': ['situation', 'personal contribution', 'action', 'result'] if interview_type in {'HR', 'BEHAVIORAL', 'SITUATIONAL'} else ['technical decision', 'reasoning', 'validation']})
    return {'version': 2, 'engine': 'local_deterministic', 'role': title, 'interviewType': interview_type,
      'requiredSkills': required, 'preferredSkills': [], 'cvJobOverlap': [skill for skill in required if normalized(skill) in candidate_index], 'competencies': competencies}
