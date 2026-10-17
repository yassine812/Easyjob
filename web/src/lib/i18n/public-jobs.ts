'use client';
import { useI18n } from '@/lib/i18n';
const copy: Record<string, [string, string, string]> = {
  aboutRole: ['About the role', 'À propos du poste', 'عن الوظيفة'], responsibilities: ['Responsibilities', 'Missions', 'المسؤوليات'], requirements: ['Requirements', 'Profil recherché', 'المتطلبات'],
  notFound: ['Job not found', 'Offre introuvable', 'الوظيفة غير موجودة'], notFoundHelp: ['This job is no longer available.', 'Cette offre n’est plus disponible.', 'هذه الوظيفة لم تعد متاحة.'], backJobs: ['Back to jobs', 'Retour aux offres', 'العودة إلى الوظائف'],
  salary: ['Salary', 'Salaire', 'الراتب'], expires: ['Closes', 'Clôture', 'تغلق في'], required: ['required', 'requis', 'مطلوب'], loginApply: ['Log in to apply', 'Connecte-toi pour postuler', 'سجل الدخول للتقديم'],
  saved: ['Saved', 'Enregistrée', 'محفوظة'], save: ['Save job', 'Enregistrer l’offre', 'حفظ الوظيفة'], about: ['Company', 'Entreprise', 'الشركة'], postedBy: ['Published on EasyJob by', 'Publié sur EasyJob par', 'نُشر على EasyJob بواسطة'],
  title: ['Find jobs', 'Trouver un emploi', 'البحث عن وظيفة'],
  description: ['Explore open positions. Applying is free.', 'Explore les offres disponibles. Postuler est gratuit.', 'تصفح الوظائف المتاحة. التقديم مجاني.'],
  keyword: ['Job title, skills, or keywords', 'Poste, compétences ou mots-clés', 'المسمى الوظيفي أو المهارات أو الكلمات المفتاحية'],
  location: ['Location', 'Lieu', 'الموقع'], search: ['Search', 'Rechercher', 'بحث'],
  employment: ['Employment type', 'Type de contrat', 'نوع العقد'], experience: ['Experience level', 'Niveau d’expérience', 'مستوى الخبرة'],
  allTypes: ['All types', 'Tous les contrats', 'جميع العقود'], allLevels: ['All levels', 'Tous les niveaux', 'جميع المستويات'],
  salaryMin: ['Minimum salary', 'Salaire minimum', 'الحد الأدنى للراتب'], sort: ['Sort by', 'Trier par', 'ترتيب حسب'],
  newest: ['Newest first', 'Plus récentes', 'الأحدث'], relevance: ['Relevance', 'Pertinence', 'الصلة'],
  salaryHigh: ['Salary: high to low', 'Salaire décroissant', 'الراتب تنازليًا'], salaryLow: ['Salary: low to high', 'Salaire croissant', 'الراتب تصاعديًا'],
  titleSort: ['Title A–Z', 'Intitulé A–Z', 'المسمى أبجديًا'], remote: ['Remote', 'Télétravail', 'عن بعد'], remoteOnly: ['Remote only', 'Télétravail uniquement', 'عن بعد فقط'],
  clear: ['Clear all filters', 'Effacer les filtres', 'مسح عوامل التصفية'], error: ['Could not load jobs. Please try again.', 'Impossible de charger les offres. Réessaie.', 'تعذر تحميل الوظائف. حاول مجددًا.'],
  empty: ['No jobs match your search', 'Aucune offre ne correspond à ta recherche', 'لا توجد وظائف تطابق بحثك'],
  emptyHelp: ['Try different keywords or fewer filters.', 'Essaie d’autres mots-clés ou enlève des filtres.', 'جرب كلمات مختلفة أو قلل عوامل التصفية.'],
  results: ['Jobs found', 'Offres trouvées', 'الوظائف المتاحة'], company: ['Company', 'Entreprise', 'الشركة'],
  preview: ['Public preview', 'Aperçu public', 'معاينة عامة'], back: ['Back to company jobs', 'Retour aux offres de l’entreprise', 'العودة إلى وظائف الشركة'],
  FULL_TIME: ['Full-time', 'Temps plein', 'دوام كامل'], PART_TIME: ['Part-time', 'Temps partiel', 'دوام جزئي'], CONTRACT: ['Contract', 'Contrat', 'عقد'], INTERNSHIP: ['Internship', 'Stage', 'تدريب'], FREELANCE: ['Freelance', 'Indépendant', 'عمل حر'],
  JUNIOR: ['Junior', 'Junior', 'مبتدئ'], MID: ['Mid-level', 'Intermédiaire', 'متوسط'], SENIOR: ['Senior', 'Confirmé', 'خبير'], LEAD: ['Lead', 'Responsable', 'قائد'], EXECUTIVE: ['Executive', 'Direction', 'إدارة'],
};
export function usePublicJobsText() { const { locale } = useI18n(); return (key: string) => copy[key]?.[locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0] ?? key; }
