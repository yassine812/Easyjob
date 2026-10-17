def questions(job: dict, rubric: dict, interview_type: str, locale: str) -> list[str]:
    supplied = [str(item.get('name') if isinstance(item, dict) else item).strip() for item in job.get('skills', []) if (item.get('name') if isinstance(item, dict) else item)]
    skill = (supplied or rubric.get('requiredSkills') or [job.get('title') or 'ce poste'])[0]
    if locale == 'fr':
        base = [
            f"Quelle expérience vous prépare le mieux au poste de {job.get('title') or 'ce poste'} ?",
            f"Expliquez une décision prise avec {skill} : contexte, alternatives et validation.",
            "Présentez une situation difficile, votre action personnelle et le résultat.",
            "Quelles questions poseriez-vous sur les objectifs et les critères de réussite du poste ?",
        ]
    else:
        base = [f"Which experience best prepares you for {job.get('title') or 'this role'}?", f"Explain a decision you made using {skill}: context, alternatives, and validation.", "Describe a difficult situation, your personal action, and the result.", "What would you ask about the role’s objectives and success criteria?"]
    if interview_type == 'SITUATIONAL':
        base.insert(0, "Comment géreriez-vous un incident critique avec des informations incomplètes ? Expliquez vos priorités.")
    if interview_type == 'CODING':
        base.insert(1, f"Implement a small solution using {skill}. Explain inputs, edge cases, and tests.")
    return base[:5]
