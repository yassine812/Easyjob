"""Private practice coaching. Frames are processed in memory, never persisted.

No emotion, personality, confidence, demographic or hiring-success inference.
"""
import re
from typing import Any
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from app.auth import require_api_key
from app.interview_ai.question_templates import questions as local_questions
from app.interview_ai.rubric_builder import build_rubric
from app.interview_ai.runtime import analyze_safely, cache_result, get_cached

router = APIRouter(dependencies=[Depends(require_api_key)])

TECHNICAL_SKILLS = ('python', 'django', 'django rest framework', 'drf', 'react', 'react native', 'javascript', 'typescript', 'java', 'c#', '.net', 'php', 'laravel', 'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'graphql', 'rest', 'api', 'kubernetes', 'aws', 'azure', 'gcp', 'docker', 'linux', 'git')

def _job_analysis(job: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    title = str(job.get('title') or 'This role')
    description = str(job.get('description') or '')
    context = f'{title}\n{description}'.lower()
    supplied = [str(item.get('name') if isinstance(item, dict) else item) for item in job.get('skills', []) if (item.get('name') if isinstance(item, dict) else item)]
    skills = list(dict.fromkeys(supplied + [skill for skill in TECHNICAL_SKILLS if re.search(rf'(?<!\w){re.escape(skill)}(?!\w)', context, re.I)]))
    if re.search(r'\b(director|director|head|vp)\b', context, re.I): seniority = 'Director'
    elif re.search(r'\b(lead|manager|responsable|chef d.?équipe)\b', context, re.I): seniority = 'Lead'
    elif re.search(r'\b(senior|expert|confirmé|expérimenté)\b', context, re.I): seniority = 'Senior'
    elif re.search(r'\b(junior|entry|stage|intern|alternance)\b', context, re.I): seniority = 'Intern' if re.search(r'\b(stage|intern|alternance)\b', context, re.I) else 'Junior'
    else: seniority = str(job.get('experienceLevel') or 'Mid').title()
    responsibilities = [line.strip(' -•') for line in re.split(r'\r?\n|(?<=[.!?])\s+', description) if len(line.strip()) >= 18 and re.search(r'\b(develop|build|design|maintain|manage|implement|collabor|dévelop|concev|maintenir|gérer|assur|particip)\w*', line, re.I)][:6]
    technical = [skill for skill in skills if skill.lower() not in {'git', 'docker', 'linux'}]
    tools = [skill for skill in skills if skill.lower() in {'git', 'docker', 'linux'}]
    candidate_text = str(candidate.get('text') or '').lower()
    gaps = [skill for skill in skills if skill.lower() not in candidate_text][:8]
    recommended = []
    if technical or re.search(r'developer|engineer|développeur|ingénieur|software|data|devops', title, re.I): recommended.append('TECHNICAL')
    if re.search(r'developer|engineer|développeur|ingénieur|software|program', title, re.I): recommended.append('CODING')
    if seniority in ('Senior', 'Lead', 'Director') and re.search(r'architecture|scalab|distributed|system design|conception', context, re.I): recommended.append('SYSTEM_DESIGN')
    if responsibilities: recommended.extend(['BEHAVIORAL', 'SITUATIONAL'])
    if re.search(r'manager|lead|director|responsable|chef d.?équipe', title, re.I): recommended.append('MANAGERIAL')
    recommended.append('HR')
    recommended = list(dict.fromkeys(recommended))
    return {'role': title, 'normalizedRole': re.sub(r'\b(sr\.?|jr\.?|senior|junior)\b', '', title, flags=re.I).strip(), 'company': str((job.get('company') or {}).get('commercialName') if isinstance(job.get('company'), dict) else job.get('company') or ''), 'seniority': seniority, 'technicalSkills': technical, 'tools': tools, 'responsibilities': responsibilities, 'softSkills': [], 'requirements': [{'skill': skill, 'category': 'CORE_TECHNICAL', 'importance': 'REQUIRED', 'evidence': next((line for line in responsibilities if skill.lower() in line.lower()), f'{skill} appears in the role context.')} for skill in technical], 'recommendedTypes': recommended, 'optionalTypes': [kind for kind in ('SYSTEM_DESIGN', 'CASE_STUDY', 'MANAGERIAL') if kind not in recommended], 'difficulty': 'BEGINNER' if seniority in ('Intern', 'Junior') and len(technical) < 5 else 'ADVANCED' if seniority in ('Senior', 'Lead') else 'INTERMEDIATE', 'preparationPlan': list(dict.fromkeys(['Present your relevant experience', *[f'Prepare a real example using {skill}' for skill in technical[:5]], *[f'Prepare for: {item}' for item in responsibilities[:3]], 'Prepare a Situation → Action → Result example'])), 'candidateEvidence': [skill for skill in technical if skill.lower() in candidate_text], 'gaps': gaps}

class CoachInput(BaseModel):
    action: str
    locale: str = "en"
    interviewType: str = "HR"
    job: dict[str, Any] = Field(default_factory=dict)
    candidate: dict[str, Any] = Field(default_factory=dict)
    question: str = ""
    answer: str = Field(default="", max_length=10000)
    rubric: dict[str, Any] = Field(default_factory=dict)
    history: list[dict[str, Any]] = Field(default_factory=list)
    idempotencyKey: str | None = Field(default=None, max_length=128)
    speakingSeconds: int | None = Field(default=None, ge=1, le=3600)
    pauses: int | None = Field(default=None, ge=0, le=100)

COPY = {
    "en": {
        "situational": "How would you handle a critical production issue with incomplete information? Explain your priorities.",
        "intro": "Which experience best prepares you for this role?",
        "technical": "Explain a technical decision you made using {skill}. What alternatives did you consider?",
        "hr": "Why does this role interest you, and what would you like to learn?",
        "behavioral": "Describe a disagreement at work or in a project. What did you do and what happened?",
        "result": "Tell me about a difficult project. Explain your own actions and the outcome.",
        "closing": "What questions would you ask the team about this role?",
        "specific": "You included concrete quantities or dates. Verify that each one is accurate.",
        "answered": "You provided an answer that can now be refined.",
        "short": "Develop your example: explain the context, your action and the actual result.",
        "long": "Try a shorter answer with one main example.",
        "structure": "Separate the situation, your responsibility, your action and the result. Use only real events.",
        "rewrite": "In [real context], my responsibility was [your actual task]. I [action you actually took]. The result was [verified outcome].",
        "clarity": "Check that a listener unfamiliar with the project can understand your role.",
        "relevance": "Review your answer against the question; this checklist does not independently verify relevance.",
    },
    "fr": {
        "situational": "Comment géreriez-vous un incident critique avec des informations incomplètes ? Expliquez vos priorités.",
        "intro": "Quelle expérience vous prépare le mieux à ce poste ?",
        "technical": "Expliquez une décision technique prise avec {skill}. Quelles alternatives avez-vous envisagées ?",
        "hr": "Pourquoi ce poste vous intéresse-t-il et que souhaitez-vous apprendre ?",
        "behavioral": "Décrivez un désaccord au travail ou dans un projet. Qu'avez-vous fait et quel a été le résultat ?",
        "result": "Présentez un projet difficile, vos actions personnelles et le résultat.",
        "closing": "Quelles questions poseriez-vous à l'équipe sur ce poste ?",
        "specific": "Vous avez cité des quantités ou des dates. Vérifiez leur exactitude.",
        "answered": "Vous avez formulé une réponse que vous pouvez maintenant préciser.",
        "short": "Développez votre exemple : contexte, action personnelle et résultat réel.",
        "long": "Raccourcissez la réponse autour d'un exemple principal.",
        "structure": "Distinguez situation, responsabilité, action et résultat. Utilisez uniquement des faits réels.",
        "rewrite": "Dans [contexte réel], ma responsabilité était [tâche réelle]. J'ai [action effectuée]. Le résultat a été [résultat vérifié].",
        "clarity": "Vérifiez qu'une personne extérieure au projet comprend votre rôle.",
        "relevance": "Comparez votre réponse à la question ; cette grille ne vérifie pas automatiquement la pertinence.",
    },
    "ar": {
        "situational": "كيف تتعامل مع عطل حرج بمعلومات غير مكتملة؟ اشرح أولوياتك.",
        "intro": "ما الخبرة التي تهيئك أكثر لهذا المنصب؟",
        "technical": "اشرح قراراً تقنياً اتخذته باستخدام {skill}. ما البدائل التي درستها؟",
        "hr": "لماذا يهمك هذا المنصب وما الذي ترغب في تعلمه؟",
        "behavioral": "صف خلافاً في العمل أو في مشروع. ماذا فعلت وما النتيجة؟",
        "result": "تحدث عن مشروع صعب واشرح دورك والإجراءات التي اتخذتها والنتيجة.",
        "closing": "ما الأسئلة التي ستطرحها على الفريق حول هذا المنصب؟",
        "specific": "ذكرت أرقاماً أو تواريخ. تأكد من دقتها.",
        "answered": "قدمت إجابة يمكنك الآن تحسينها.",
        "short": "طوّر المثال: السياق والإجراء الشخصي والنتيجة الفعلية.",
        "long": "اختصر الإجابة وركز على مثال رئيسي واحد.",
        "structure": "افصل بين الموقف والمسؤولية والإجراء والنتيجة واستخدم وقائع حقيقية فقط.",
        "rewrite": "في [سياق حقيقي] كانت مسؤوليتي [مهمة فعلية]. قمت بـ[إجراء اتخذته]. وكانت النتيجة [نتيجة مؤكدة].",
        "clarity": "تأكد أن المستمع الذي لا يعرف المشروع يستطيع فهم دورك.",
        "relevance": "قارن إجابتك بالسؤال؛ هذه القائمة لا تتحقق تلقائياً من مدى الصلة.",
    },
}

@router.post('/career/coach')
async def coach(data: CoachInput, provider: Any | None = None):
    if data.action == 'job_analysis':
        return _job_analysis(data.job, data.candidate)
    if data.action not in ('questions', 'feedback'):
        raise HTTPException(400, 'Unknown coaching action')
    # Compatibility hook for the legacy provider adapter. The HTTP route never
    # supplies it, so the normal application path remains local-first.
    if provider is not None and data.action == 'feedback':
        from app.providers.openai import _build_prompt, _chat
        parsed = await _chat(_build_prompt(
            'You are an interview coach. Return JSON with good, improve, keywords, betterAnswer, clarity, relevance, answerAnalysis and followUpQuestion.',
            f'QUESTION: {data.question}\nANSWER: {data.answer}\nRUBRIC: {data.rubric}\nHISTORY: {data.history}',
        ))
        if parsed:
            return parsed
    # Interview evaluation is deliberately local-first. The route never asks a
    # hosted provider to score, decide a follow-up, or orchestrate a turn.
    rubric = data.rubric or build_rubric(data.job, data.candidate, data.interviewType)
    if data.action == 'questions':
        return {'questions': local_questions(data.job, rubric, data.interviewType, data.locale),
                'method': 'local_deterministic',
                'rubric': rubric,
                'research': {'status': 'disabled', 'sources': [], 'blocks': []}}
    cached = get_cached(data.idempotencyKey)
    if cached is not None:
        return cached
    local = await analyze_safely(data.answer, data.question, rubric, data.speakingSeconds, data.pauses)
    score = lambda key: round(float(local[key]) * 100)
    positive = []
    if local['matched_skills']:
        positive.append(f"Compétences reliées : {', '.join(local['matched_skills'][:3])}.")
    if local['result_present']:
        positive.append('Un résultat ou une validation observable est présent.')
    if not positive:
        positive.append('Réponse enregistrée ; les critères ci-dessous indiquent quoi préciser.')
    response = {'good': positive, 'improve': local['missing_points'] or ['La réponse couvre les critères locaux attendus.'],
            'betterAnswer': COPY.get(data.locale, COPY['en'])['rewrite'] if data.locale in COPY else COPY['en']['rewrite'],
            'keywords': local['matched_skills'], 'clarity': f"Clarté locale : {score('communication_clarity')}/100.",
            'relevance': f"Pertinence locale : {score('job_relevance')}/100.",
            'answerAnalysis': {'overall_relevance': local['job_relevance'], 'specificity': local['specificity'],
              'evidence_quality': local['evidence_quality'], 'communication_clarity': local['communication_clarity'],
              'role_alignment': local['personal_contribution'], 'strengths': positive,
              'missing_points': local['missing_points'], 'detected_claims': [],
              'follow_up_needed': local['follow_up_needed'], 'follow_up_reason': local['follow_up_reason'],
              **local}, 'followUpQuestion': local['follow_up_question'], 'wordsPerMinute': local['words_per_minute'],
            'reportedPauses': local['reported_pauses'], 'analysis_engine': local['analysis_engine'],
            'method': 'local_deterministic'}
    cache_result(data.idempotencyKey, response)
    return response

@router.post('/career/vision')
async def vision(frame: UploadFile = File(...)):
    if frame.content_type not in ('image/jpeg', 'image/png'):
        raise HTTPException(400, 'JPEG or PNG required')
    data = await frame.read(1024 * 1024 + 1)
    if len(data) > 1024 * 1024:
        raise HTTPException(413, 'Frame exceeds 1 MB')
    try:
        import cv2
        import numpy as np
        from app.face.detector import decode_image, detect_faces
        image = decode_image(data)
        height, width = image.shape[:2]
        if height * width > 4_000_000:
            raise HTTPException(400, 'Frame resolution too large')
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))
        contrast = float(np.std(gray))
        faces = detect_faces(image)
        observations = []
        if brightness < 55:
            observations.append('underexposed')
        elif brightness > 215:
            observations.append('overexposed')
        else:
            observations.append('lighting_ok')
        observations.append('background_high_contrast' if contrast > 78 else 'background_neutral')
        if len(faces) != 1:
            observations.append('single_face_not_detected')
        else:
            x, y, w, h = faces[0]
            observations.append('centered' if abs((x + w / 2) / width - .5) < .18 else 'adjust_framing')
            observations.append('distance_ok' if .18 <= w / width <= .65 else 'adjust_distance')
        return {'supported': ['framing', 'camera_distance'], 'observations': observations,
                'environment': {'brightness': round(brightness, 1), 'contrast': round(contrast, 1), 'stored': False},
                'unsupported': ['emotions', 'nervousness', 'confidence', 'eye_contact', 'posture', 'gestures'],
                'stored': False, 'method': 'opencv_framing'}
    except HTTPException:
        raise
    except ImportError:
        raise HTTPException(503, 'Camera coaching is not supported on this server')
    except ValueError:
        raise HTTPException(400, 'Invalid frame')
