import hashlib
import random
import re
from pathlib import Path
from babel.lists import format_list
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from .knowledge import JobKnowledgeBase, knowledge_base, normalize
from .models import DraftRequest, GeneratedJobDraft

TEMPLATES = Path(__file__).parent / 'templates'
ENV = Environment(loader=FileSystemLoader(TEMPLATES), undefined=StrictUndefined, autoescape=False, trim_blocks=True, lstrip_blocks=True)
LEVELS = {'fr': {'JUNIOR': 'junior', 'MID': 'confirmé', 'SENIOR': 'senior', 'LEAD': 'lead'}, 'en': {'JUNIOR': 'junior', 'MID': 'mid-level', 'SENIOR': 'senior', 'LEAD': 'lead'}, 'ar': {'JUNIOR': 'مبتدئ', 'MID': 'متوسط الخبرة', 'SENIOR': 'خبير', 'LEAD': 'قائد'}}
CONCISE_LEVEL = {
    'fr': {'JUNIOR': 'Vous bénéficierez d’un accompagnement sur des missions délimitées.', 'MID': 'Vous prendrez en charge vos réalisations et contribuerez aux décisions de l’équipe.', 'SENIOR': 'Vous porterez les standards de qualité et accompagnerez les profils moins expérimentés.', 'LEAD': 'Vous coordonnerez les contributions et définirez les standards partagés de l’équipe.'},
    'en': {'JUNIOR': 'You will receive guidance on clearly scoped assignments.', 'MID': 'You will own your deliverables and contribute to team decisions.', 'SENIOR': 'You will own quality standards and mentor less experienced colleagues.', 'LEAD': 'You will coordinate contributions and establish shared team standards.'},
    'ar': {'JUNIOR': 'ستحصل على توجيه في مهام محددة النطاق.', 'MID': 'ستتولى مسؤولية مخرجاتك وتساهم في قرارات الفريق.', 'SENIOR': 'ستتولى معايير الجودة وتوجّه الزملاء الأقل خبرة.', 'LEAD': 'ستنسّق المساهمات وتضع معايير مشتركة للفريق.'},
}
SKILL_LABELS = {
    'Automated testing': ('Tests automatisés','الاختبارات الآلية'), 'REST API': ('API REST','واجهات REST'),
    'Cloud': ('Cloud','الحوسبة السحابية'), 'Monitoring': ('Supervision','المراقبة'), 'Observability': ('Observabilité','قابلية المراقبة'),
    'Incident response': ('Gestion des incidents','إدارة الحوادث'), 'Automation': ('Automatisation','الأتمتة'),
    'Test plans': ('Plans de test','خطط الاختبار'), 'Regression testing': ('Tests de régression','اختبارات التراجع'),
    'Bug tracking': ('Suivi des anomalies','متابعة العيوب'), 'API testing': ('Tests des API','اختبار واجهات البرمجة'),
    'Accessibility': ('Accessibilité','إمكانية الوصول'), 'Mobile UI': ('Interfaces mobiles','واجهات الجوال'),
    'App Store release': ('Publication sur les stores','النشر في متاجر التطبيقات'), 'Data visualization': ('Visualisation de données','تصوير البيانات'),
    'Statistics': ('Statistiques','الإحصاء'), 'Reporting': ('Rapports et tableaux de bord','التقارير ولوحات المؤشرات'),
    'Data pipelines': ('Pipelines de données','خطوط البيانات'), 'Machine learning': ('Apprentissage automatique','التعلم الآلي'),
    'Experimentation': ('Expérimentation','التجارب'), 'Product discovery': ('Découverte produit','استكشاف المنتج'),
    'Roadmapping': ('Feuille de route produit','خارطة المنتج'), 'User research': ('Recherche utilisateur','بحث المستخدم'),
    'Analytics': ('Analyse des usages','تحليل الاستخدام'), 'Wireframing': ('Maquettes fonctionnelles','المخططات الوظيفية'),
    'Prototyping': ('Prototypage','النماذج الأولية'), 'Design systems': ('Systèmes de design','أنظمة التصميم'),
    'Usability testing': ('Tests d’utilisabilité','اختبارات الاستخدام'), 'Design tokens': ('Variables de design','متغيرات التصميم'),
    'Negotiation': ('Négociation','التفاوض'), 'Customer discovery': ('Découverte des besoins clients','استكشاف احتياجات العملاء'),
    'B2B sales': ('Vente B2B','مبيعات بين الشركات'), 'English': ('Anglais','الإنجليزية'),
    'Content strategy': ('Stratégie de contenu','استراتيجية المحتوى'), 'Campaigns': ('Campagnes','الحملات'),
    'Social media': ('Réseaux sociaux','التواصل الاجتماعي'), 'Email marketing': ('Campagnes e-mail','التسويق بالبريد الإلكتروني'),
    'Sourcing': ('Recherche de candidats','البحث عن المترشحين'), 'Interviewing': ('Conduite d’entretiens','إجراء المقابلات'),
    'Candidate experience': ('Expérience candidat','تجربة المترشح'), 'Employment law': ('Droit du travail','قانون العمل'),
    'Employer branding': ('Marque employeur','علامة صاحب العمل'), 'HR analytics': ('Analyse RH','تحليل الموارد البشرية'),
    'Financial modelling': ('Modélisation financière','النمذجة المالية'), 'Budgeting': ('Budgétisation','إعداد الميزانيات'),
    'Accounting': ('Comptabilité','المحاسبة'), 'Forecasting': ('Prévisions','التوقعات'),
    'Customer service': ('Service client','خدمة العملاء'), 'Ticketing': ('Gestion des tickets','إدارة التذاكر'),
    'Troubleshooting': ('Diagnostic des problèmes','تشخيص المشكلات'), 'SaaS support': ('Support SaaS','دعم SaaS'),
}
def localized_skill(name, locale):
    match = next((v for k,v in SKILL_LABELS.items() if normalize(k) == normalize(name)), None)
    return match[0 if locale == 'fr' else 1] if match and locale != 'en' else name

def clean(text):
    return '\n\n'.join(re.sub(r'\s+', ' ', paragraph).strip() for paragraph in re.split(r'\n\s*\n', text.strip()) if paragraph.strip())

def french_a(activity):
    # Coordinate article-bearing noun groups with the same preposition.
    activity = activity.replace(' et la ', ' et à la ').replace(' et les ', ' et aux ').replace(' et le ', ' et au ').replace(' et l’', ' et à l’')
    if activity.startswith('le '): return 'au ' + activity[3:]
    if activity.startswith('les '): return 'aux ' + activity[4:]
    return 'à ' + activity

def responsibility(activity, seniority, locale, index):
    forms = {
        'fr': {
            'JUNIOR': [f'Contribuer {french_a(activity)} avec l’accompagnement de l’équipe.', f'Participer {french_a(activity)} en appliquant les pratiques de l’équipe.', f'Apprendre à maîtriser {activity} à travers des réalisations encadrées.'],
            'MID': [f'Prendre en charge {activity}.', f'Contribuer {french_a(activity)} ; documenter les décisions associées.', f'Assurer {activity} en coordination avec l’équipe.'],
            'SENIOR': [f'Piloter {activity} et expliciter les choix retenus.', f'Définir les standards de qualité pour {activity}.', f'Améliorer en continu {activity} et partager les pratiques éprouvées.'],
            'LEAD': [f'Définir les orientations pour {activity}.', f'Coordonner {activity} en arbitrant les priorités de l’équipe.', f'Établir les standards partagés pour {activity}.'],
        },
        'en': {
            'JUNIOR': [f'Contribute to {activity} with team guidance.', f'Support {activity} using established team practices.', f'Build practical experience in {activity} through guided assignments.'],
            'MID': [f'Take ownership of {activity}.', f'Contribute to {activity} and document decisions.', f'Coordinate {activity} with the team.'],
            'SENIOR': [f'Lead {activity} and explain key decisions.', f'Define quality standards for {activity}.', f'Continuously improve {activity} and share proven practices.'],
            'LEAD': [f'Set direction for {activity}.', f'Coordinate {activity} and arbitrate team priorities.', f'Establish shared standards for {activity}.'],
        },
        'ar': {
            'JUNIOR': [f'المساهمة في {activity} بتوجيه من الفريق.', f'دعم {activity} وفق ممارسات الفريق.', f'اكتساب خبرة في {activity} من خلال مهام مؤطرة.'],
            'MID': [f'تولّي مسؤولية {activity} ومتابعة جودة النتائج.', f'المساهمة في {activity} وتوثيق القرارات.', f'تنسيق {activity} مع الفريق.'],
            'SENIOR': [f'قيادة {activity} وتوضيح القرارات.', f'تحديد معايير الجودة في {activity}.', f'تحسين {activity} ومشاركة الممارسات المجربة.'],
            'LEAD': [f'تحديد التوجهات في {activity}.', f'تنسيق {activity} وترتيب الأولويات.', f'وضع معايير مشتركة في {activity}.'],
        },
    }
    return forms[locale][seniority][index % 3]

def working_conditions(request):
    i = ['fr','en','ar'].index(request.locale)
    modes = {'ONSITE': ['Sur site','On site','في الموقع'], 'HYBRID': ['Hybride','Hybrid','هجين'], 'REMOTE': ['Télétravail','Remote','عن بعد']}
    contracts = {'FULL_TIME': ['Temps plein','Full time','دوام كامل'], 'PART_TIME': ['Temps partiel','Part time','دوام جزئي'], 'CONTRACT': ['Contrat','Contract','عقد'], 'INTERNSHIP': ['Stage','Internship','تدريب'], 'FREELANCE': ['Indépendant','Freelance','عمل حر']}
    industries = {'technology':['Technologie','Technology','التكنولوجيا'], 'software_product':['Logiciel et produit','Software and product','البرمجيات والمنتج'], 'software':['Logiciel','Software','البرمجيات'], 'fintech':['FinTech','FinTech','التقنيات المالية'], 'finance':['Finance','Finance','المالية']}
    industry = industries.get((request.company.industry or '').lower().replace(' ','_'), ['','',''])[i]
    return dict(location=request.location, workMode=modes[request.workMode][i], employmentType=contracts[request.employmentType][i], contractType=request.contractType, industry=industry)

class DraftQualityError(ValueError):
    pass

def validate_quality(draft: GeneratedJobDraft, request: DraftRequest, role):
    def unique(items): return len(items) == len({normalize(item) for item in items})
    if not unique(draft.responsibilities) or not unique([skill.name for skill in draft.skills] + draft.preferredSkills):
        raise DraftQualityError('Duplicate generated content')
    if any(len(line.split()) < 5 for line in draft.responsibilities):
        raise DraftQualityError('Responsibility too short')
    if len(set(item.text for item in draft.descriptions)) != 3:
        raise DraftQualityError('Variants must differ')
    allowed = {normalize(name) for name in role.core_skills + role.optional_skills + request.skills}
    if any(normalize(skill.name) not in allowed for skill in draft.skills) or any(normalize(name) not in allowed for name in draft.preferredSkills):
        raise DraftQualityError('Incompatible suggested skill')
    for item in draft.descriptions:
        text = item.text.replace(request.company.commercialName, '') if request.company.commercialName else item.text
        if '{{' in text or '{%' in text or ' · ' in text or re.search(r'\b(?:JUNIOR|MID|SENIOR|LEAD|ONSITE|HYBRID|FULL_TIME|undefined)\b', text):
            raise DraftQualityError('Template or metadata leaked into narrative')
        if request.locale == 'fr' and re.search(r'\b(?:Technology|Advanced|Full-time|Mid-level)\b|profil Développeur', text):
            raise DraftQualityError('Unlocalized narrative')
        if re.search(r'équipe internationale|forte croissance|leader du marché|environnement dynamique', text, re.I):
            raise DraftQualityError('Unsupported company claim')
        if item.id != 'concise' and not 2 <= len(item.text.split('\n\n')) <= 3:
            raise DraftQualityError('Narrative must contain two or three paragraphs')
        if item.text.casefold().count(draft.title.casefold()) > 1:
            raise DraftQualityError('Repeated title')

def generate(request: DraftRequest, kb: JobKnowledgeBase | None = None) -> GeneratedJobDraft:
    kb = kb or knowledge_base()
    role = kb.get(request.roleId); family = kb.families[role.family]; locale = request.locale
    seniority = request.seniority
    seed = hashlib.sha256(f'{role.id}|{seniority}|{request.company.commercialName}|v2'.encode()).hexdigest()
    rng = random.Random(seed)
    base_title = getattr(role.localized_titles, locale)
    if role.id == 'senior_devops_engineer':
        base_title = {'fr':'Ingénieur DevOps','en':'DevOps Engineer','ar':'مهندس DevOps'}[locale]
    if locale == 'fr':
        narrative_title = f'{base_title[0].lower() + base_title[1:]} {LEVELS[locale][seniority]}'
    elif locale == 'en':
        narrative_title = f'{LEVELS[locale][seniority]} {base_title}'
    else:
        narrative_title = f'{base_title} {LEVELS[locale][seniority]}'
    # Known vocabulary may be localized; employer-provided proprietary names remain verbatim.
    names = list(dict.fromkeys(role.core_skills + request.skills))
    names = list({normalize(localized_skill(name, locale)): name for name in reversed(names)}.values())[::-1]
    optional = [name for name in role.optional_skills if normalize(localized_skill(name, locale)) not in {normalize(localized_skill(item, locale)) for item in names}]
    selected = request.skills or role.core_skills
    def suffix(tool): return {'fr':f' avec {tool}', 'en':f' with {tool}', 'ar':f' باستخدام {tool}'}[locale] if tool else ''
    context = dict(company=clean(request.company.commercialName), narrative_title=narrative_title,
        indefinite_title=('an ' if narrative_title[0].lower() in 'aeiou' else 'a ') + narrative_title,
        seniority=seniority, technical=role.seniority_profiles[seniority] == 'technical',
        family_template=f'{locale}/families/{role.family}.j2', intro_choice=rng.randrange(2), collaboration_choice=rng.randrange(2),
        concise_level=CONCISE_LEVEL[locale][seniority],
        framework_suffix=suffix(role.framework), database_suffix=suffix('PostgreSQL' if 'PostgreSQL' in selected else ''),
        infrastructure_suffix=suffix('Terraform' if 'Terraform' in selected else ''),
        skill_list=format_list([localized_skill(name, locale) for name in selected[:6]], locale=locale))
    # Only checked-in editorial fragments are templates; employer text is always data.
    activities = [ENV.from_string(getattr(activity, locale)).render(**context) for activity in family.activities]
    context['task_focus'] = format_list(activities[:3], locale=locale)
    descriptions = [dict(id=style, text=clean(ENV.get_template(f'{locale}/{style}.j2').render(**context))) for style in ['professional','concise','technical']]
    offset = rng.randrange(3)
    responsibilities = [responsibility(activity, seniority, locale, index + offset) for index,activity in enumerate(activities)]
    source = kb.source_records(role)
    years = {'JUNIOR':0,'MID':2,'SENIOR':5,'LEAD':7}[seniority]
    draft = GeneratedJobDraft.model_validate(dict(
        title=narrative_title[0].upper()+narrative_title[1:], description=descriptions[0]['text'], descriptions=descriptions,
        summary=descriptions[0]['text'].split('\n\n')[0], responsibilities=responsibilities,
        skills=[dict(name=name, required=True, level='BEGINNER' if seniority=='JUNIOR' else 'ADVANCED' if seniority in ['SENIOR','LEAD'] else 'INTERMEDIATE', source='knowledge_base' if name in role.core_skills else 'employer') for name in names],
        preferredSkills=optional, skillLabels={name:localized_skill(name,locale) for name in names+optional}, requirements=[], profileRequirements=[CONCISE_LEVEL[locale][seniority]],
        workingConditions=working_conditions(request), recruitmentContext={'companyName': request.company.commercialName},
        experienceLevel=seniority, minimumYearsExperience=years, employmentType=request.employmentType, workMode=request.workMode, remote=request.workMode=='REMOTE', location=request.location,
        provenance={'engine':'easyjob-deterministic-v2','dataset':'O*NET 31.0 + EasyJob editorial adaptations','sourceCodes':role.source_codes,'sourceTaskIds':[str(item['task_id']) for item in source['task_statements']], 'knowledgeAreas':sorted({item['element_name'] for item in source['knowledge'] if item['scale_id']=='IM' and item['data_value']>=3}), 'seed':seed[:16]}))
    validate_quality(draft,request,role)
    return draft
