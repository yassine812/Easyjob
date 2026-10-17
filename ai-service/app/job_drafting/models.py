from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Locale = Literal['fr', 'en', 'ar']
Seniority = Literal['JUNIOR', 'MID', 'SENIOR', 'LEAD']

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class CompanyContext(StrictModel):
    commercialName: str = Field(default='', max_length=250)
    industry: str | None = Field(default=None, max_length=150)

class DraftRequest(StrictModel):
    roleId: str = Field(min_length=2, max_length=80)
    seniority: Seniority = 'MID'
    locale: Locale = 'fr'
    location: str = Field(default='', max_length=150)
    workMode: Literal['REMOTE', 'HYBRID', 'ONSITE'] = 'HYBRID'
    employmentType: Literal['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'] = 'FULL_TIME'
    contractType: Literal['', 'CDI', 'CDD'] = ''
    skills: list[str] = Field(default_factory=list, max_length=30)
    company: CompanyContext = Field(default_factory=CompanyContext)

    @field_validator('skills')
    @classmethod
    def validate_skills(cls, values):
        if any(not v.strip() or len(v) > 80 or '\n' in v for v in values):
            raise ValueError('Invalid skill label')
        return list(dict.fromkeys(v.strip() for v in values))

class Localized(StrictModel):
    fr: str
    en: str
    ar: str

class Role(StrictModel):
    id: str
    canonical_title: str
    localized_titles: Localized
    aliases: list[str]
    family: str
    domains: list[str]
    core_skills: list[str]
    optional_skills: list[str]
    related_roles: list[str]
    source_codes: list[str]
    default_seniority: Seniority = 'MID'
    framework: str = ''
    seniority_profiles: dict[Seniority, str]

class Family(StrictModel):
    source_code: str
    purpose: Localized
    scope: Localized
    collaboration: Localized
    activities: list[Localized] = Field(min_length=6)
    technical: bool

class Skill(StrictModel):
    name: str
    required: bool
    level: Literal['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']
    source: Literal['knowledge_base', 'employer'] = 'knowledge_base'

class Description(StrictModel):
    id: Literal['professional', 'concise', 'technical']
    text: str = Field(min_length=100, max_length=8000)

class Conditions(StrictModel):
    location: str
    workMode: str
    employmentType: str
    contractType: str
    industry: str

class GeneratedJobDraft(StrictModel):
    title: str
    description: str = Field(min_length=100, max_length=8000)
    descriptions: list[Description] = Field(min_length=3, max_length=3)
    summary: str
    responsibilities: list[str] = Field(min_length=6, max_length=10)
    skills: list[Skill] = Field(min_length=1)
    preferredSkills: list[str]
    skillLabels: dict[str, str]
    requirements: list[str]
    profileRequirements: list[str]
    workingConditions: Conditions
    recruitmentContext: dict[str, str]
    experienceLevel: Seniority
    minimumYearsExperience: int
    employmentType: str
    workMode: str
    remote: bool
    location: str
    currency: str = 'TND'
    educationRequirement: str = ''
    provenance: dict[str, str | list[str]]
