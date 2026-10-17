"use client";
import { useI18n } from "./index";
export const billingCopy: Record<string, [string, string, string]> = {
  "positioning.TRIAL": [
    "Start with the recruitment essentials.",
    "Pour démarrer et suivre vos premières candidatures.",
    "للبدء ومتابعة طلبات التوظيف الأولى.",
  ],
  "positioning.BUSINESS": [
    "For teams hiring regularly, with AI assistance.",
    "Pour les équipes qui recrutent régulièrement, avec une assistance IA.",
    "للفرق التي توظف بانتظام مع مساعدة الذكاء الاصطناعي.",
  ],
  "positioning.PRO": [
    "More capacity for teams recruiting at scale.",
    "Plus de capacité pour les équipes qui recrutent à plus grande échelle.",
    "سعة أكبر للفرق التي توسع عمليات التوظيف.",
  ],
  "positioning.ENTERPRISE": [
    "Advanced matching and interview assistance for large teams.",
    "Matching avancé et assistance en entretien pour les grandes équipes.",
    "مطابقة متقدمة ومساعدة أثناء المقابلات للفرق الكبيرة.",
  ],
  "quota.activeJobs": [
    "{count} active jobs",
    "{count} offres actives",
    "{count} عروض نشطة",
  ],
  "quota.team.members": [
    "Up to {count} team members",
    "Jusqu’à {count} membres",
    "حتى {count} أعضاء",
  ],
  "quota.ai.analyses.monthly": [
    "{count} recruitment AI requests / month",
    "{count} demandes IA de recrutement / mois",
    "{count} طلب ذكاء اصطناعي للتوظيف شهرياً",
  ],
  "choose.TRIAL": [
    "Switch to Starter",
    "Passer à Starter",
    "الانتقال إلى Starter",
  ],
  "choose.FREE": [
    "Switch to Starter",
    "Passer à Starter",
    "الانتقال إلى Starter",
  ],
  "choose.BUSINESS": ["Choose Business", "Choisir Business", "اختيار Business"],
  "choose.PRO": ["Choose Pro", "Choisir Pro", "اختيار Pro"],
  "choose.ENTERPRISE": [
    "Choose Enterprise",
    "Choisir Enterprise",
    "اختيار Enterprise",
  ],
  applicationTracking: [
    "Application tracking",
    "Suivi des candidatures",
    "متابعة طلبات التوظيف",
  ],
  interviewManagement: [
    "Interview scheduling and calendar",
    "Gestion et calendrier des entretiens",
    "إدارة المقابلات والتقويم",
  ],
  title: [
    "Subscription & billing",
    "Abonnement et facturation",
    "الاشتراك والفوترة",
  ],
  subtitle: [
    "Manage your plan, usage and invoices.",
    "Gérez votre formule, votre utilisation et vos factures.",
    "أدر اشتراكك واستخدامك وفواتيرك.",
  ],
  history: ["Billing history", "Historique de facturation", "سجل الفوترة"],
  current: ["Current plan", "Formule actuelle", "الاشتراك الحالي"],
  testPlan: ["Development plan", "Plan de développement", "اشتراك التطوير"],
  test: ["Test environment", "Environnement de test", "بيئة اختبار"],
  noCharge: [
    "Test plan — no charge",
    "Plan de test — aucun prélèvement",
    "اشتراك تجريبي — دون اقتطاع",
  ],
  catalogue: ["Catalogue price", "Tarif catalogue", "سعر الباقة"],
  active: ["Active", "Actif", "نشط"],
  trial: ["Trial", "Essai", "تجريبي"],
  scheduled: [
    "Cancellation scheduled",
    "Résiliation programmée",
    "الإلغاء مجدول",
  ],
  renewal: ["Next renewal", "Prochain renouvellement", "التجديد القادم"],
  periodEnd: ["Access until", "Accès jusqu’au", "متاح حتى"],
  noPeriod: ["No end date", "Sans date de fin", "دون تاريخ انتهاء"],
  free: ["Free plan", "Formule gratuite", "اشتراك مجاني"],
  manage: ["Manage plan", "Gérer le plan", "إدارة الاشتراك"],
  MONTHLY: ["/ month", "/ mois", "/ شهر"],
  YEARLY: ["/ year", "/ an", "/ سنة"],
  TRIAL: ["EasyJob Starter", "EasyJob Starter", "EasyJob Starter"],
  FREE: ["EasyJob Starter", "EasyJob Starter", "EasyJob Starter"],
  BUSINESS: ["EasyJob Business", "EasyJob Business", "EasyJob Business"],
  PRO: ["EasyJob Pro", "EasyJob Pro", "EasyJob Pro"],
  ENTERPRISE: [
    "EasyJob Enterprise",
    "EasyJob Enterprise",
    "EasyJob Enterprise",
  ],
  usage: ["Your usage", "Votre utilisation", "استخدامك"],
  usageHelp: [
    "Limits applied to your workspace. Monthly usage resets on the 1st (UTC).",
    "Limites appliquées à votre espace. La consommation mensuelle repart le 1er du mois (UTC).",
    "الحدود المطبقة على مساحتك. يعاد ضبط الاستهلاك الشهري في أول الشهر بتوقيت UTC.",
  ],
  activeJobs: ["Active jobs", "Offres actives", "العروض النشطة"],
  jobsHelp: [
    "Includes drafts and jobs awaiting approval.",
    "Brouillons et offres en attente de validation inclus.",
    "تشمل المسودات والعروض بانتظار الموافقة.",
  ],
  "team.members": ["Team seats", "Places dans l’équipe", "مقاعد الفريق"],
  seatsHelp: [
    "Active members and pending invitations.",
    "Membres actifs et invitations en attente.",
    "الأعضاء النشطون والدعوات المعلقة.",
  ],
  "ai.analyses.monthly": [
    "Recruitment analyses",
    "Analyses de recrutement",
    "تحليلات التوظيف",
  ],
  analysesHelp: [
    "Recorded this calendar month (UTC).",
    "Enregistrées ce mois calendaire (UTC).",
    "المسجلة هذا الشهر بتوقيت UTC.",
  ],
  unlimited: ["Unlimited", "Illimité", "غير محدود"],
  consumed: ["used", "utilisés", "مستخدم"],
  quotaReached: ["Limit reached", "Limite atteinte", "تم بلوغ الحد"],
  noQuotas: [
    "No usage limits available.",
    "Aucune limite de consommation disponible.",
    "لا توجد حدود استخدام متاحة.",
  ],
  included: [
    "Included in your plan",
    "Inclus dans votre plan",
    "متاح ضمن اشتراكك",
  ],
  jobManagement: ["Job management", "Gestion des offres", "إدارة عروض العمل"],
  notifications: [
    "Notifications & emails",
    "Notifications et e-mails",
    "الإشعارات والبريد الإلكتروني",
  ],
  recruitmentAssistance: [
    "AI suggestions for job descriptions and skills",
    "Suggestions IA pour les offres et compétences",
    "اقتراحات ذكية للعروض والمهارات",
  ],
  advancedAnalysis: [
    "Advanced application analysis",
    "Analyse avancée des candidatures",
    "تحليل متقدم للترشحات",
  ],
  growthPotential: [
    "Growth potential",
    "Potentiel d’évolution",
    "إمكانات التطور",
  ],
  topCandidates: ["Top candidates", "Meilleurs candidats", "أفضل المترشحين"],
  interviewAssistant: [
    "Interview assistant",
    "Assistant d’entretien",
    "مساعد المقابلة",
  ],
  smartJobCreation: [
    "Smart Job Creation",
    "Création d’offres assistée",
    "إنشاء العروض بمساعدة ذكية",
  ],
  analytics: [
    "Recruitment analytics",
    "Statistiques de recrutement",
    "إحصائيات التوظيف",
  ],
  plans: ["Change plan", "Changer de formule", "تغيير الاشتراك"],
  plansHelp: [
    "Compare the plans available for your company.",
    "Comparez les formules disponibles pour votre entreprise.",
    "قارن الاشتراكات المتاحة لشركتك.",
  ],
  details: [
    "Compare features",
    "Voir le détail des fonctionnalités",
    "مقارنة المزايا",
  ],
  choose: ["Review this plan", "Examiner cette formule", "مراجعة هذه الباقة"],
  feature: ["Feature", "Fonctionnalité", "الميزة"],
  yes: ["Included", "Inclus", "متاح"],
  no: ["Not included", "Non inclus", "غير متاح"],
  unknown: ["Not specified", "Non précisé", "غير محدد"],
  payment: ["Payment", "Paiement", "الدفع"],
  paymentSoon: [
    "Online payment coming soon",
    "Paiement en ligne bientôt disponible",
    "الدفع عبر الإنترنت متاح قريباً",
  ],
  paymentOffHelp: [
    "You can compare plans. Online payment is not available yet.",
    "Vous pouvez comparer les formules. Le paiement en ligne n’est pas encore disponible.",
    "يمكنك مقارنة الباقات. الدفع عبر الإنترنت غير متاح حالياً.",
  ],
  paymentReady: [
    "Secure payment with Konnect",
    "Paiement sécurisé avec Konnect",
    "دفع آمن عبر Konnect",
  ],
  paymentHelp: [
    "Enter your payment details at checkout. No card is saved in EasyJob and no automatic charge is scheduled.",
    "Renseignez votre moyen de paiement lors du règlement. Aucune carte enregistrée dans EasyJob et aucun prélèvement automatique programmé.",
    "أدخل وسيلة الدفع عند التسديد. لا تحفظ EasyJob بطاقة ولا تبرمج اقتطاعاً تلقائياً.",
  ],
  testPayment: [
    "Sandbox payments only — no live charge.",
    "Paiements de test uniquement — aucun prélèvement réel.",
    "مدفوعات تجريبية فقط — دون اقتطاع حقيقي.",
  ],
  invoices: [
    "Invoices & payments",
    "Factures et paiements",
    "الفواتير والمدفوعات",
  ],
  invoicesHelp: [
    "Your payment history and documents issued by the provider.",
    "Vos règlements et les documents émis par le prestataire de paiement.",
    "سجل المدفوعات والمستندات الصادرة عن مزود الدفع.",
  ],
  noInvoices: [
    "No invoices yet.",
    "Aucune facture pour le moment.",
    "لا توجد فواتير بعد.",
  ],
  noTestInvoices: [
    "A development plan does not generate a paid invoice.",
    "Un plan de développement ne génère pas de facture acquittée.",
    "اشتراك التطوير لا ينشئ فاتورة مدفوعة.",
  ],
  date: ["Date", "Date", "التاريخ"],
  amount: ["Amount", "Montant", "المبلغ"],
  status: ["Status", "Statut", "الحالة"],
  invoice: ["Invoice", "Facture", "الفاتورة"],
  download: ["View invoice", "Consulter la facture", "عرض الفاتورة"],
  missingInvoice: ["Not issued", "Non émise", "لم تصدر"],
  SUCCEEDED: ["Paid", "Payé", "مدفوع"],
  PENDING: ["Pending", "En attente", "قيد الانتظار"],
  PROCESSING: ["Processing", "En cours", "جارٍ"],
  FAILED: ["Failed", "Échoué", "فشل"],
  REFUNDED: ["Refunded", "Remboursé", "مسترجع"],
  CANCELLED: ["Cancelled", "Annulé", "ملغى"],
  EXPIRED: ["Expired", "Expiré", "منتهي"],
  previous: ["Previous", "Précédent", "السابق"],
  next: ["Next", "Suivant", "التالي"],
  page: ["Page", "Page", "صفحة"],
  readOnly: [
    "Only a billing administrator can change this plan.",
    "Seul un administrateur de facturation peut modifier cette formule.",
    "مسؤول الفوترة فقط يستطيع تعديل الاشتراك.",
  ],
  cancel: ["Cancel subscription", "Résilier l’abonnement", "إلغاء الاشتراك"],
  cancelHelp: [
    "Your access stays active until {date}. You will then return to the free plan.",
    "Votre accès restera actif jusqu’au {date}. Vous passerez ensuite à la formule gratuite.",
    "يبقى وصولك نشطاً حتى {date}. ثم تنتقل إلى الاشتراك المجاني.",
  ],
  keep: ["Keep my plan", "Conserver ma formule", "الاحتفاظ باشتراكي"],
  confirmCancel: [
    "Confirm end-of-period cancellation",
    "Confirmer la résiliation en fin de période",
    "تأكيد الإلغاء عند نهاية الفترة",
  ],
  saved: [
    "Cancellation scheduled.",
    "Résiliation programmée.",
    "تمت جدولة الإلغاء.",
  ],
  error: [
    "Unable to save this change. Please retry.",
    "Impossible d’enregistrer ce changement. Réessayez.",
    "تعذر حفظ التغيير. حاول مجدداً.",
  ],
  changeHelp: [
    "Your current plan stays active until the new payment is confirmed. The new plan then applies immediately.",
    "Votre formule reste active jusqu’à la confirmation du nouveau paiement. La nouvelle formule s’applique alors immédiatement.",
    "يبقى اشتراكك الحالي نشطاً حتى تأكيد الدفع الجديد. تطبق الباقة الجديدة فوراً بعده.",
  ],
  noProration: [
    "No automatic prorated refund is calculated for this change.",
    "Aucun remboursement au prorata n’est calculé automatiquement pour ce changement.",
    "لا يحسب استرداد نسبي تلقائي لهذا التغيير.",
  ],
  lost: [
    "Features you will lose",
    "Fonctionnalités que vous perdrez",
    "المزايا التي ستفقدها",
  ],
  exceeded: [
    "Usage exceeds the new plan",
    "Utilisation supérieure au nouveau plan",
    "الاستخدام يتجاوز الباقة الجديدة",
  ],
  reduce: [
    "Reduce usage before changing plans. Your existing data is not deleted.",
    "Réduisez l’utilisation avant de changer de formule. Vos données existantes ne sont pas supprimées.",
    "قلل الاستخدام قبل تغيير الاشتراك. لا تحذف بياناتك الحالية.",
  ],
  freeLimitHelp: [
    "After the period ends, you cannot add jobs or members above the free limits. Existing data is retained.",
    "Après la fin de période, vous ne pourrez plus ajouter d’offres ou de membres au-delà des limites gratuites. Les données existantes sont conservées.",
    "بعد انتهاء الفترة لا يمكنك إضافة عروض أو أعضاء فوق الحدود المجانية. تبقى البيانات الحالية محفوظة.",
  ],
  checkout: [
    "Continue to secure payment",
    "Continuer vers le paiement sécurisé",
    "المتابعة إلى الدفع الآمن",
  ],
  processing: ["Please wait…", "Veuillez patienter…", "يرجى الانتظار…"],
  support: ["Contact support", "Contacter le support", "التواصل مع الدعم"],
  stripeHelp: [
    "Cancel the current automatic renewal before purchasing another plan.",
    "Résiliez le renouvellement automatique actuel avant d’acheter une autre formule.",
    "ألغ التجديد التلقائي الحالي قبل شراء اشتراك آخر.",
  ],
};
export function useBillingText() {
  const { locale } = useI18n();
  return (key: string, vars: Record<string, string> = {}) => {
    let value =
      billingCopy[key]?.[locale === "fr" ? 1 : locale === "ar" ? 2 : 0] ?? key;
    for (const [name, replacement] of Object.entries(vars))
      value = value.replaceAll(`{${name}}`, replacement);
    return value;
  };
}
