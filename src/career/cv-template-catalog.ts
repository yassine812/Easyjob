export type CvMarket = 'CA' | 'FR' | 'US' | 'UK' | 'INTL';
export type CvTemplateCategory = 'ATS' | 'Tech' | 'Corporate' | 'Junior' | 'Senior' | 'Professional';
export type CvTemplateLayout = 'clean' | 'accent-top' | 'section-rail' | 'centered' | 'executive' | 'modern';

export type CvTemplateDefinition = {
  id: string;
  name: string;
  market: CvMarket;
  category: CvTemplateCategory;
  atsFriendly: boolean;
  supportedLocales: string[];
  layout: CvTemplateLayout;
  density: 'compact' | 'balanced';
  sectionDefaults: string[];
  recommendedSections: string[];
  discouragedFields: string[];
};

/** Product metadata is the single source of truth for gallery, preview and export. */
export const cvTemplateCatalog: CvTemplateDefinition[] = [
  { id: 'canadian-fr', name: 'CV Canadien', market: 'CA', category: 'ATS', atsFriendly: true, supportedLocales: ['fr-CA'], layout: 'clean', density: 'compact', sectionDefaults: ['summary', 'experience', 'skills', 'education'], recommendedSections: ['certifications', 'projects', 'languages'], discouragedFields: ['photo', 'dateOfBirth', 'maritalStatus'] },
  { id: 'canadian-en', name: 'Canadian Resume', market: 'CA', category: 'ATS', atsFriendly: true, supportedLocales: ['en-CA'], layout: 'clean', density: 'compact', sectionDefaults: ['summary', 'experience', 'skills', 'education'], recommendedSections: ['certifications', 'projects', 'languages'], discouragedFields: ['photo', 'dateOfBirth', 'maritalStatus'] },
  { id: 'french-cv', name: 'CV Français', market: 'FR', category: 'Professional', atsFriendly: true, supportedLocales: ['fr-FR'], layout: 'accent-top', density: 'balanced', sectionDefaults: ['summary', 'experience', 'education', 'skills'], recommendedSections: ['languages', 'projects'], discouragedFields: ['maritalStatus'] },
  { id: 'us-resume', name: 'Resume US', market: 'US', category: 'ATS', atsFriendly: true, supportedLocales: ['en-US'], layout: 'clean', density: 'compact', sectionDefaults: ['summary', 'experience', 'skills', 'education'], recommendedSections: ['certifications', 'projects'], discouragedFields: ['photo', 'dateOfBirth', 'maritalStatus'] },
  { id: 'uk-cv', name: 'CV Royaume-Uni', market: 'UK', category: 'Professional', atsFriendly: true, supportedLocales: ['en-GB'], layout: 'centered', density: 'balanced', sectionDefaults: ['summary', 'experience', 'skills', 'education'], recommendedSections: ['certifications', 'languages'], discouragedFields: ['photo', 'dateOfBirth', 'maritalStatus'] },
  { id: 'international', name: 'CV International', market: 'INTL', category: 'Professional', atsFriendly: true, supportedLocales: ['fr-FR', 'fr-CA', 'en-CA', 'en-US', 'en-GB'], layout: 'modern', density: 'balanced', sectionDefaults: ['summary', 'experience', 'skills', 'education'], recommendedSections: ['projects', 'languages'], discouragedFields: ['dateOfBirth', 'maritalStatus'] },
  { id: 'tech-ats', name: 'Tech ATS', market: 'INTL', category: 'Tech', atsFriendly: true, supportedLocales: ['fr-FR', 'fr-CA', 'en-CA', 'en-US', 'en-GB'], layout: 'section-rail', density: 'compact', sectionDefaults: ['summary', 'technical', 'experience', 'projects', 'education'], recommendedSections: ['certifications', 'links'], discouragedFields: ['photo', 'dateOfBirth'] },
  { id: 'corporate', name: 'Corporate', market: 'INTL', category: 'Corporate', atsFriendly: true, supportedLocales: ['fr-FR', 'fr-CA', 'en-CA', 'en-US', 'en-GB'], layout: 'executive', density: 'balanced', sectionDefaults: ['summary', 'experience', 'achievements', 'education', 'skills'], recommendedSections: ['certifications', 'languages'], discouragedFields: ['photo', 'dateOfBirth'] },
  { id: 'minimal-ats', name: 'Minimal ATS', market: 'INTL', category: 'Junior', atsFriendly: true, supportedLocales: ['fr-FR', 'fr-CA', 'en-CA', 'en-US', 'en-GB'], layout: 'clean', density: 'compact', sectionDefaults: ['summary', 'experience', 'skills', 'education'], recommendedSections: ['projects'], discouragedFields: ['photo', 'dateOfBirth', 'maritalStatus', 'decorativeGraphics'] },
  { id: 'modern-professional', name: 'Modern Professional', market: 'INTL', category: 'Senior', atsFriendly: true, supportedLocales: ['fr-FR', 'fr-CA', 'en-CA', 'en-US', 'en-GB'], layout: 'modern', density: 'balanced', sectionDefaults: ['summary', 'experience', 'achievements', 'skills', 'education'], recommendedSections: ['certifications', 'projects'], discouragedFields: ['dateOfBirth', 'maritalStatus'] },
];

const legacyLayouts: Record<string, CvTemplateLayout> = { modern: 'accent-top', precision: 'section-rail', classic: 'centered', signature: 'modern', executive: 'executive', technology: 'section-rail', academic: 'centered', creative: 'modern' };
export const cvTemplateIds = [...cvTemplateCatalog.map(template => template.id), ...Object.keys(legacyLayouts)];
export function templateDefinition(id: string): CvTemplateDefinition {
  return cvTemplateCatalog.find(template => template.id === id) ?? { ...cvTemplateCatalog[5], id, layout: legacyLayouts[id] ?? 'accent-top' };
}
