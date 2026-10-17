'use client';
import { useI18n } from '@/lib/i18n';
import { useHiringText } from '@/lib/i18n/hiring';
const copy: Record<string, [string, string, string]> = {
  connecting: ['Connecting…', 'Connexion en cours…', 'جار الاتصال…'], reconnecting: ['Reconnecting…', 'Reconnexion en cours…', 'جار إعادة الاتصال…'], disconnected: ['Disconnected', 'Déconnecté', 'انقطع الاتصال'],
  connectionError: ['The connection ended. Leave and join again to retry.', 'La connexion est interrompue. Quittez puis rejoignez la salle pour réessayer.', 'انقطع الاتصال. غادر ثم انضم مجددًا للمحاولة.'],
  screenShare: ['Share screen', 'Partager l’écran', 'مشاركة الشاشة'], participants: ['Participants', 'Participants', 'المشاركون'], devices: ['Devices', 'Appareils', 'الأجهزة'],
  defaultDevice: ['System default', 'Appareil par défaut', 'الجهاز الافتراضي'], device: ['Device', 'Appareil', 'جهاز'], you: ['You', 'Vous', 'أنت'], enableAudio: ['Enable sound', 'Activer le son', 'تفعيل الصوت'],
  IN_PROGRESS: ['In progress', 'En cours', 'جارٍ'],

  potentialHIGH: ['High', 'Élevé', 'مرتفع'], potentialMEDIUM: ['Moderate', 'Modéré', 'متوسط'], potentialLOW: ['Low', 'Faible', 'منخفض'],
  upcomingMeeting: ['Upcoming interview', 'Entretien à venir', 'مقابلة قادمة'],
  readyMeeting: ['Ready when you are', 'Tout est prêt pour votre entretien', 'جاهز عندما تكون مستعدًا'],
  opensAt: ['The room opens at {time}.', 'La salle ouvre à {time}.', 'تفتح القاعة في {time}.'],
  availableIn: ['Available in {minutes} min', 'Disponible dans {minutes} min', 'متاح خلال {minutes} دقيقة'],
  roomExpired: ['The access window has ended.', 'La période d’accès à la salle est terminée.', 'انتهت فترة الدخول إلى القاعة.'],
  requestDevicePermission: ['Allow camera and microphone', 'Autoriser la caméra et le micro', 'السماح بالكاميرا والميكروفون'],
  devicePermissionHelp: ['Allow access to your camera and microphone before joining.', 'Autorisez l’accès à votre caméra et à votre micro avant de rejoindre.', 'اسمح بالوصول إلى الكاميرا والميكروفون قبل الانضمام.'],
  deviceAuthorized: ['Camera and microphone access is authorized.', 'L’accès à la caméra et au micro est autorisé.', 'تم السماح بالكاميرا والميكروفون.'],
  camera: ['Camera', 'Caméra', 'الكاميرا'], microphone: ['Microphone', 'Micro', 'الميكروفون'], speakers: ['Speakers', 'Haut-parleurs', 'مكبرات الصوت'],
  devicePermissionError: ['Permission was denied. Allow access in your browser and try again.', 'Autorisation refusée. Autorisez l’accès dans votre navigateur puis réessayez.', 'تم رفض الإذن. اسمح بالوصول من المتصفح ثم حاول مجدداً.'], permissionGranted: ['Permission granted', 'Autorisation accordée', 'تم السماح'], permissionRequired: ['Permission required', 'Autorisation requise', 'الإذن مطلوب'],
  briefTab: ['Brief', 'Dossier', 'الملف'], questionsTab: ['Questions', 'Questions', 'الأسئلة'], notesTab: ['Notes', 'Notes', 'الملاحظات'],
  included: ['Included in your plan', 'Inclus dans votre plan', 'مشمول في خطتك'], privacy: ['Privacy', 'Confidentialité', 'الخصوصية'],
  synthesis: ['At a glance', 'Synthèse', 'نظرة عامة'], match: ['Compatibility', 'Compatibilité', 'التوافق'], potential: ['Potential', 'Potentiel', 'الإمكانات'], classification: ['Classification', 'Classification', 'التصنيف'],
  strengths: ['Strengths', 'Points forts', 'نقاط القوة'], verify: ['To explore', 'À vérifier', 'للتحقق'], noEvidence: ['No documented evidence yet', 'Aucun élément documenté pour le moment', 'لا توجد أدلة موثقة بعد'],
  publicQuestion: ['Suggested public-context question', 'Question suggérée par le contexte public', 'سؤال مقترح من السياق العمومي'], publicQuestionWhy: ['Why EasyJob suggests it', 'Pourquoi EasyJob la suggère', 'علاش EasyJob يقترحها'],
  coverLetter: ['Cover letter', 'Lettre de motivation', 'رسالة الدافع'], viewDossier: ['View application', 'Voir le dossier', 'عرض الملف'], viewAnalysis: ['View full analysis', 'Voir l’analyse complète', 'عرض التحليل الكامل'], viewCv: ['View CV', 'Voir le CV', 'عرض السيرة الذاتية'],
  HIGH: ['Essential', 'Essentielles', 'أساسية'], MEDIUM: ['Explore further', 'À approfondir', 'للتعمق'], OPTIONAL: ['Optional', 'Optionnelles', 'اختيارية'],
  source: ['Source', 'Source', 'المصدر'], JOB_CV_EVIDENCE: ['Job / CV', 'Offre / CV', 'الوظيفة / السيرة'], INTERVIEW_TYPE: ['Interview type', 'Type d’entretien', 'نوع المقابلة'], RECRUITER: ['Recruiter', 'Recruteur', 'الموظف'],
  why: ['Why EasyJob suggests it', 'Pourquoi EasyJob la suggère', 'لماذا يقترحها EasyJob'], notesHint: ['Your observations, evidence and follow-up points…', 'Vos observations, éléments concrets et points à approfondir…', 'ملاحظاتك والأدلة والنقاط للمتابعة…'],
  saving: ['Saving', 'Enregistrement', 'جارٍ الحفظ'], saved: ['Saved', 'Enregistré', 'تم الحفظ'], unsaved: ['Unsaved changes', 'Modifications non enregistrées', 'تغييرات غير محفوظة'], saveFailed: ['Save failed. Your draft is kept here.', 'Échec de l’enregistrement. Votre brouillon est conservé ici.', 'فشل الحفظ. مسودتك محفوظة هنا.'],
  completedMeeting: ['Interview completed', 'Entretien terminé', 'اكتملت المقابلة'], reportHelp: ['Review the discussion and add your assessment. The hiring decision remains yours.', 'Retrouvez les points abordés et ajoutez votre évaluation. La décision de recrutement vous appartient.', 'راجع النقاش وأضف تقييمك. قرار التوظيف يبقى لك.'],
  viewTranscript: ['View transcription', 'Voir la transcription', 'عرض التفريغ'], hideTranscript: ['Hide transcription', 'Masquer la transcription', 'إخفاء التفريغ'],
  discussed: ['Questions covered', 'Questions abordées', 'الأسئلة التي نوقشت'], notDiscussed: ['Not covered', 'Non abordées', 'لم تُناقش'], noNotes: ['No notes yet', 'Aucune note pour le moment', 'لا توجد ملاحظات بعد'],
  consentRequired: ['Please review assistant privacy before joining.', 'Consultez la confidentialité de l’assistant avant de rejoindre.', 'راجع خصوصية المساعد قبل الانضمام.'],
  live: ['In progress', 'En cours', 'قيد التقدم'], showAssistant: ['Open assistant', 'Ouvrir l’assistant', 'فتح المساعد'], closeAssistant: ['Close assistant', 'Fermer l’assistant', 'إغلاق المساعد'],
  cancelInterview: ['Cancel interview', 'Annuler l’entretien', 'إلغاء المقابلة'], cancelConfirm: ['Cancel this interview?', 'Annuler cet entretien ?', 'إلغاء هذه المقابلة؟'], cancelHelp: ['The room will no longer be accessible.', 'La salle ne sera plus accessible.', 'لن يكون الدخول إلى القاعة متاحًا.'],
};
export function useMeetingText() {
  const { locale } = useI18n(); const fallback = useHiringText();
  return (key: string) => copy[key]?.[locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0] ?? fallback(key);
}
