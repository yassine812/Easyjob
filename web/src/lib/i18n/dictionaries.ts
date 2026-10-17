/**
 * Translation dictionaries for EasyJob (Multilingual UI Support: EN, FR, AR).
 *
 * Arabic automatically switches the document to RTL (dir="rtl").
 * All keys must exist in all three locales to prevent fallback issues.
 */
export type Locale = 'en' | 'fr' | 'ar';

export interface Dictionary {
  dir: 'ltr' | 'rtl';
  /** Language label shown in the switcher, in its own language. */
  languageName: string;
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    loading: string;
    error: string;
    success: string;
    search: string;
    filter: string;
    logout: string;
    dashboard: string;
    profile: string;
    settings: string;
    back: string;
    next: string;
    actions: string;
    noData: string;
    support: string;
  };
  nav: {
    dashboard: string;
    jobs: string;
    candidates: string;
    companies: string;
    pricing: string;
    about: string;
    applications: string;
    interviews: string;
    analytics: string;
    billing: string;
    admin: string;
    team: string;
    pipeline: string;
    automation: string;
    assessments: string;
    settings: string;
    support: string;
    postJob: string;
  };
  company: {
    overviewTitle: string;
    overviewSubtitle: string;
    postJob: string;
    exportReport: string;
    exporting: string;
    activeJobs: string;
    totalApplications: string;
    newApplications: string;
    avgMatchScore: string;
    strongMatch: string;
    recruitmentPipeline: string;
    todaysInterviews: string;
    recentApplications: string;
    viewAll: string;
    viewCalendar: string;
    aiRecommendation: string;
    reviewMatches: string;
    aiRecommendationText: string;
    candidate: string;
    role: string;
    match: string;
    status: string;
    actions: string;
    applied: string;
    screening: string;
    shortlisted: string;
    interview: string;
    offer: string;
    hired: string;
    automation: string;
    assessments: string;
    support: string;
    enterpriseTier: string;
    recruiterPortal: string;
    jobApplicationsTitle: string;
    jobApplicationsSubtitle: string;
    searchJobsPlaceholder: string;
    viewApplications: string;
    backToApplications: string;
    applicationsForJob: string;
    candidatesAppliedCount: string;
    noApplicationsYet: string;
    noApplicationsDesc: string;
    viewJob: string;
    unreviewedNew: string;
    interviewed: string;
    avgAtsScore: string;
    moreFilters: string;
    matchScoreFilter: string;
    experienceFilter: string;
    atsScoreFilter: string;
    statusFilter: string;
    aiAssessmentSummary: string;
    viewProfile: string;
  };
  candidate: {
    dashboardTitle: string;
    dashboardSubtitle: string;
    myApplications: string;
    savedJobs: string;
    cvBuilder: string;
    atsScore: string;
    aiJobMatching: string;
    matchScore: string;
    notifications: string;
  };
  marketing: {
    heroTitlePart1: string;
    heroTitlePart2: string;
    heroSubtitle: string;
    searchPlaceholder: string;
    locationPlaceholder: string;
    searchButton: string;
    popularTags: string;
    trustedBy: string;
    featuredTitle: string;
    featuredSubtitle: string;
    viewAllJobs: string;
    applyNow: string;
    aiMatch: string;
  };
  auth: {
    email: string;
    password: string;
    login: string;
    register: string;
    forgotPassword: string;
    resetPassword: string;
    verifyEmail: string;
    welcomeBack: string;
  };
  face: {
    loginWithFace: string;
    signInWithFace: string;
    signInWithPassword: string;
    faceAuth: string;
    faceAuthDescription: string;
    enabled: string;
    disabled: string;
    enableFaceLogin: string;
    disableFaceLogin: string;
    consentTitle: string;
    consentBody: string;
    consentAgree: string;
    consentRequired: string;
    cameraPermission: string;
    cameraPermissionBody: string;
    cameraDenied: string;
    cameraDeniedBody: string;
    cameraUnavailable: string;
    positionTitle: string;
    lookAtCamera: string;
    lookCenter: string;
    turnLeftPrompt: string;
    turnRightPrompt: string;
    stepCenter: string;
    stepLeft: string;
    stepRight: string;
    capturingPose: string;
    facialSetupTitle: string;
    facialSetupSubtitle: string;
    setupCompleted: string;
    turnLeft: string;
    turnRight: string;
    holdStill: string;
    faceDetected: string;
    faceNotDetected: string;
    capturing: string;
    processing: string;
    processingBody: string;
    success: string;
    successBody: string;
    identityVerified: string;
    failed: string;
    failedBody: string;
    tryAgain: string;
    usePasswordInstead: string;
    emailForFace: string;
    continueLabel: string;
    captureLabel: string;
    authenticating: string;
    enrollTitle: string;
    enrollStepConsent: string;
    enrollStepCamera: string;
    enrollStepPosition: string;
    enrollStepProcessing: string;
    enrollComplete: string;
    privacyNotice: string;
    lastUsed: string;
    enrolledOn: string;
    securitySection: string;
    securitySectionDescription: string;
    errorNoFace: string;
    errorMultipleFaces: string;
    errorLowQuality: string;
    errorLivenessFailed: string;
    errorFaceMismatch: string;
    errorBiometricDisabled: string;
    errorChallengeExpired: string;
    errorTooManyAttempts: string;
    errorCameraError: string;
    errorAiUnavailable: string;
    errorGeneric: string;
    temporaryUnavailable: string;
  };
}

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    dir: 'ltr',
    languageName: 'English',
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      loading: 'Loading...',
      error: 'An error occurred',
      success: 'Operation completed successfully',
      search: 'Search...',
      filter: 'Filter',
      logout: 'Log out',
      dashboard: 'Dashboard',
      profile: 'Profile',
      settings: 'Settings',
      back: 'Back',
      next: 'Next',
      actions: 'Actions',
      noData: 'No data available',
      support: 'Support',
    },
    nav: {
      dashboard: 'Dashboard',
      jobs: 'Jobs',
      candidates: 'Candidates',
      companies: 'Companies',
      pricing: 'Pricing',
      about: 'About',
      applications: 'Applications',
      interviews: 'Interviews',
      analytics: 'Analytics',
      billing: 'Billing',
      admin: 'Admin',
      team: 'Team',
      pipeline: 'Pipeline',
      automation: 'Automation',
      assessments: 'Assessments',
      settings: 'Settings',
      support: 'Support',
      postJob: 'Post a Job',
    },
    company: {
      overviewTitle: 'Company Overview',
      overviewSubtitle: "Here's what's happening with your recruitment pipeline today.",
      postJob: 'Post a Job',
      exportReport: 'Export',
      exporting: 'Exporting...',
      activeJobs: 'Active Jobs',
      totalApplications: 'Total Applications',
      newApplications: 'New Applications',
      avgMatchScore: 'Avg. Match Score',
      strongMatch: 'Strong',
      recruitmentPipeline: 'Recruitment Pipeline',
      todaysInterviews: "Today's Interviews",
      recentApplications: 'Recent Applications',
      viewAll: 'View All',
      viewCalendar: 'View Calendar',
      aiRecommendation: 'AI Recommendation',
      reviewMatches: 'Review Matches',
      aiRecommendationText: '5 candidates strongly match your Backend Developer position.',
      candidate: 'Candidate',
      role: 'Role',
      match: 'Match',
      status: 'Status',
      actions: 'Actions',
      applied: 'Applied',
      screening: 'Screening',
      shortlisted: 'Shortlisted',
      interview: 'Interview',
      offer: 'Offer',
      hired: 'Hired',
      automation: 'Automation',
      assessments: 'Assessments',
      support: 'Support',
      enterpriseTier: 'Enterprise Tier',
      recruiterPortal: 'Recruiter Portal',
      jobApplicationsTitle: 'Job Applications',
      jobApplicationsSubtitle: 'Select a job posting to view and manage candidate applications.',
      searchJobsPlaceholder: 'Search jobs by title, department, or location...',
      viewApplications: 'View Applications',
      backToApplications: 'Back to Applications',
      applicationsForJob: 'Applications',
      candidatesAppliedCount: 'candidates applied for this position',
      noApplicationsYet: 'No applications yet',
      noApplicationsDesc: 'When candidates apply to this position, their applications will appear here.',
      viewJob: 'View Job',
      unreviewedNew: 'New',
      interviewed: 'Interviewed',
      avgAtsScore: 'Avg. ATS',
      moreFilters: 'More Filters',
      matchScoreFilter: 'Match Score',
      experienceFilter: 'Experience',
      atsScoreFilter: 'ATS Score',
      statusFilter: 'Status',
      aiAssessmentSummary: 'AI Assessment Summary',
      viewProfile: 'View Profile',
    },
    candidate: {
      dashboardTitle: 'Candidate Dashboard',
      dashboardSubtitle: 'Track your job applications, interviews, and AI resume match scores.',
      myApplications: 'My Applications',
      savedJobs: 'Saved Jobs',
      cvBuilder: 'CV Builder',
      atsScore: 'ATS Score',
      aiJobMatching: 'AI Job Matching',
      matchScore: 'Match Score',
      notifications: 'Notifications',
    },
    marketing: {
      heroTitlePart1: 'Find the right job.',
      heroTitlePart2: 'Build your future.',
      heroSubtitle: 'Our advanced AI matching platform connects you with opportunities that perfectly align with your skills, experience, and career goals.',
      searchPlaceholder: 'Job title, keywords...',
      locationPlaceholder: 'City, state, or remote',
      searchButton: 'Search',
      popularTags: 'Popular:',
      trustedBy: 'Trusted by 10,000+ top organizations worldwide',
      featuredTitle: 'Featured Opportunities',
      featuredSubtitle: 'Explore hand-picked roles powered by EasyJob matching.',
      viewAllJobs: 'View all jobs',
      applyNow: 'Apply Now',
      aiMatch: 'AI Match',
    },
    auth: {
      email: 'Email address',
      password: 'Password',
      login: 'Sign in',
      register: 'Sign up',
      forgotPassword: 'Forgot password?',
      resetPassword: 'Reset password',
      verifyEmail: 'Verify email',
      welcomeBack: 'Welcome back',
    },
    face: {
      loginWithFace: 'Sign in with Face',
      signInWithFace: 'Sign in with Face',
      signInWithPassword: 'Use password instead',
      faceAuth: 'Face Login',
      faceAuthDescription:
        'Optional. Sign in with your face instead of a password. Your facial data is processed for authentication — a biometric template is stored securely rather than using your photo as your password.',
      enabled: 'Enabled',
      disabled: 'Disabled',
      enableFaceLogin: 'Enable Face Login',
      disableFaceLogin: 'Disable Face Login',
      consentTitle: 'Set up Face Authentication',
      consentBody:
        'Face authentication is optional — your password always works. To enable it, a short scan of your face is processed to create a secure biometric template. The template is encrypted and stored on our servers; your face photo is never saved, and you can disable and delete this data at any time.',
      consentAgree: 'I understand and consent',
      consentRequired: 'You must consent before enabling face login.',
      cameraPermission: 'Camera permission',
      cameraPermissionBody: 'Allow camera access to scan your face. Your camera feed is processed in memory and never stored.',
      cameraDenied: 'Camera access denied',
      cameraDeniedBody: 'You can enable Face Login later from your settings. Password login is always available.',
      cameraUnavailable: 'Camera unavailable',
      positionTitle: 'Position your face',
      lookAtCamera: 'Look directly at the camera',
      lookCenter: 'Look straight at the camera.',
      turnLeftPrompt: 'Turn your head slowly to the left.',
      turnRightPrompt: 'Turn your head slowly to the right.',
      stepCenter: 'Center',
      stepLeft: 'Turn left',
      stepRight: 'Turn right',
      capturingPose: 'Pose detected — capturing…',
      facialSetupTitle: 'Facial Authentication Setup',
      facialSetupSubtitle: 'Complete your 3-pose facial scan to secure your account.',
      setupCompleted: 'Facial setup completed!',
      turnLeft: 'Turn slightly to your left',
      turnRight: 'Turn slightly to your right',
      holdStill: 'Hold still…',
      faceDetected: 'Face detected',
      faceNotDetected: 'Face not detected',
      capturing: 'Capturing…',
      processing: 'Processing your scan',
      processingBody: 'This takes a few seconds. Your facial data is processed securely and never stored as a photo.',
      success: 'Face Login enabled',
      successBody: 'You can now sign in with your face. Password login remains available.',
      identityVerified: 'Identity verified',
      failed: 'Face verification failed',
      failedBody: 'We could not verify your identity. You can retry or use your password.',
      tryAgain: 'Try again',
      usePasswordInstead: 'Use password instead',
      emailForFace: 'Enter your account email',
      continueLabel: 'Continue',
      captureLabel: 'Capture',
      authenticating: 'Authenticating…',
      enrollTitle: 'Enable Face Login',
      enrollStepConsent: 'Consent',
      enrollStepCamera: 'Camera',
      enrollStepPosition: 'Position',
      enrollStepProcessing: 'Processing',
      enrollComplete: 'Face Login enabled — you can now sign in with your face.',
      privacyNotice:
        'Your facial data is processed for authentication. A biometric template is stored securely rather than using your photo as your password. You can disable and delete it at any time from Settings → Security.',
      lastUsed: 'Last used',
      enrolledOn: 'Enabled on',
      securitySection: 'Security',
      securitySectionDescription: 'Manage Face Login, your password, and account security.',
      errorNoFace: 'No face detected. Make sure your face is visible and well lit.',
      errorMultipleFaces: 'Multiple faces detected. Make sure only you are in the frame.',
      errorLowQuality: 'Image quality is too low. Try better lighting and look straight at the camera.',
      errorLivenessFailed: 'Liveness check failed. Please try again with a live scan.',
      errorFaceMismatch: 'Face verification failed.',
      errorBiometricDisabled: 'Face Login is not enabled for this account.',
      errorChallengeExpired: 'The scan expired. Please start again.',
      errorTooManyAttempts: 'Too many attempts. Please wait a moment or use your password.',
      errorCameraError: 'Could not start the camera. Please check your permissions.',
      errorAiUnavailable: 'Face login is temporarily unavailable. Please use your password.',
      errorGeneric: 'Face verification failed. Please try again.',
      temporaryUnavailable: 'Face login is temporarily unavailable. Please use your password.',
    },
  },
  fr: {
    dir: 'ltr',
    languageName: 'Français',
    common: {
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      edit: 'Modifier',
      loading: 'Chargement...',
      error: 'Une erreur est survenue',
      success: 'Opération réussie',
      search: 'Rechercher...',
      filter: 'Filtrer',
      logout: 'Déconnexion',
      dashboard: 'Tableau de bord',
      profile: 'Profil',
      settings: 'Paramètres',
      back: 'Retour',
      next: 'Suivant',
      actions: 'Actions',
      noData: 'Aucune donnée disponible',
      support: 'Support',
    },
    nav: {
      dashboard: 'Tableau de bord',
      jobs: 'Offres d’emploi',
      candidates: 'Candidats',
      companies: 'Entreprises',
      pricing: 'Tarifs',
      about: 'À propos',
      applications: 'Candidatures',
      interviews: 'Entretiens',
      analytics: 'Analytique',
      billing: 'Facturation',
      admin: 'Administration',
      team: 'Équipe',
      pipeline: 'Pipeline de recrutement',
      automation: 'Automatisation',
      assessments: 'Évaluations',
      settings: 'Paramètres',
      support: 'Support',
      postJob: 'Publier une offre',
    },
    company: {
      overviewTitle: "Vue d'ensemble de l'entreprise",
      overviewSubtitle: "Voici ce qui se passe aujourd'hui dans votre pipeline de recrutement.",
      postJob: 'Publier une offre',
      exportReport: 'Exporter',
      exporting: 'Exportation...',
      activeJobs: 'Offres actives',
      totalApplications: 'Total des candidatures',
      newApplications: 'Nouvelles candidatures',
      avgMatchScore: 'Score de correspondance moyen',
      strongMatch: 'Élevé',
      recruitmentPipeline: 'Pipeline de recrutement',
      todaysInterviews: "Entretiens d'aujourd'hui",
      recentApplications: 'Candidatures récentes',
      viewAll: 'Tout voir',
      viewCalendar: 'Voir le calendrier',
      aiRecommendation: 'Recommandation IA',
      reviewMatches: 'Examiner les correspondances',
      aiRecommendationText: '5 candidats correspondent fortement à votre poste de Développeur Backend.',
      candidate: 'Candidat',
      role: 'Rôle',
      match: 'Correspondance',
      status: 'Statut',
      actions: 'Actions',
      applied: 'Postulé',
      screening: 'Sélection',
      shortlisted: 'Présélectionné',
      interview: 'Entretien',
      offer: 'Offre',
      hired: 'Recruté',
      automation: 'Automatisation',
      assessments: 'Évaluations',
      support: 'Support',
      enterpriseTier: 'Offre Entreprise',
      recruiterPortal: 'Portail Recruteur',
      jobApplicationsTitle: 'Candidatures par offre',
      jobApplicationsSubtitle: "Sélectionnez une offre d'emploi pour voir et gérer les candidatures.",
      searchJobsPlaceholder: 'Rechercher des offres par titre, département ou lieu...',
      viewApplications: 'Voir les candidatures',
      backToApplications: 'Retour aux candidatures',
      applicationsForJob: 'Candidatures',
      candidatesAppliedCount: 'candidats ont postulé à ce poste',
      noApplicationsYet: 'Aucune candidature pour le moment',
      noApplicationsDesc: 'Lorsque des candidats postuleront à cette offre, leurs candidatures apparaîtront ici.',
      viewJob: "Voir l'offre",
      unreviewedNew: 'Nouveaux',
      interviewed: 'En entretien',
      avgAtsScore: 'Score ATS moy.',
      moreFilters: 'Plus de filtres',
      matchScoreFilter: 'Score de correspondance',
      experienceFilter: 'Expérience',
      atsScoreFilter: 'Score ATS',
      statusFilter: 'Statut',
      aiAssessmentSummary: 'Résumé de l’évaluation IA',
      viewProfile: 'Voir le profil',
    },
    candidate: {
      dashboardTitle: 'Espace Candidat',
      dashboardSubtitle: 'Suivez vos candidatures, vos entretiens et vos scores de correspondance IA.',
      myApplications: 'Mes candidatures',
      savedJobs: 'Offres sauvegardées',
      cvBuilder: 'Générateur de CV',
      atsScore: 'Score ATS',
      aiJobMatching: 'Correspondance IA',
      matchScore: 'Score de correspondance',
      notifications: 'Notifications',
    },
    marketing: {
      heroTitlePart1: 'Trouvez le bon emploi.',
      heroTitlePart2: 'Construisez votre avenir.',
      heroSubtitle: 'Notre plateforme de correspondance IA avancée vous met en relation avec des opportunités parfaitement alignées sur vos compétences et objectifs.',
      searchPlaceholder: 'Titre du poste, mots-clés...',
      locationPlaceholder: 'Ville, région ou télétravail',
      searchButton: 'Rechercher',
      popularTags: 'Populaires :',
      trustedBy: 'Reconnu par plus de 10 000 grandes organisations dans le monde',
      featuredTitle: 'Opportunités à la une',
      featuredSubtitle: 'Découvrez des offres sélectionnées propulsées par la correspondance IA EasyJob.',
      viewAllJobs: 'Voir toutes les offres',
      applyNow: 'Postuler maintenant',
      aiMatch: 'Correspondance IA',
    },
    auth: {
      email: 'Adresse email',
      password: 'Mot de passe',
      login: 'Se connecter',
      register: 'S’inscrire',
      forgotPassword: 'Mot de passe oublié ?',
      resetPassword: 'Réinitialiser le mot de passe',
      verifyEmail: 'Vérifier l’email',
      welcomeBack: 'Bon retour',
    },
    face: {
      loginWithFace: 'Se connecter avec le visage',
      signInWithFace: 'Se connecter avec le visage',
      signInWithPassword: 'Utiliser le mot de passe',
      faceAuth: 'Connexion par visage',
      faceAuthDescription:
        'Optionnel. Connectez-vous avec votre visage au lieu d’un mot de passe. Vos données faciales sont traitées pour l’authentification — un gabarit biométrique est stocké de manière sécurisée, jamais votre photo.',
      enabled: 'Activé',
      disabled: 'Désactivé',
      enableFaceLogin: 'Activer la connexion par visage',
      disableFaceLogin: 'Désactiver la connexion par visage',
      consentTitle: 'Configurer l’authentification par visage',
      consentBody:
        'L’authentification par visage est optionnelle — votre mot de passe fonctionne toujours. Pour l’activer, un court scan de votre visage est traité pour créer un gabarit biométrique sécurisé. Le gabarit est chiffré et stocké sur nos serveurs ; votre photo n’est jamais enregistrée et vous pouvez désactiver et supprimer ces données à tout moment.',
      consentAgree: 'Je comprends et j’accepte',
      consentRequired: 'Votre consentement est requis pour activer la connexion par visage.',
      cameraPermission: 'Autorisation de la caméra',
      cameraPermissionBody: 'Autorisez l’accès à la caméra pour scanner votre visage. Le flux est traité en mémoire et jamais stocké.',
      cameraDenied: 'Accès caméra refusé',
      cameraDeniedBody: 'Vous pourrez activer la connexion par visage plus tard depuis vos paramètres. Le mot de passe reste disponible.',
      cameraUnavailable: 'Caméra indisponible',
      positionTitle: 'Placez votre visage',
      lookAtCamera: 'Regardez directement la caméra',
      lookCenter: 'Regardez droit vers la caméra.',
      turnLeftPrompt: 'Tournez doucement votre tête vers la gauche.',
      turnRightPrompt: 'Tournez doucement votre tête vers la droite.',
      stepCenter: 'Centre',
      stepLeft: 'Tourner à gauche',
      stepRight: 'Tourner à droite',
      capturingPose: 'Pose détectée — capture…',
      facialSetupTitle: 'Configuration de la reconnaissance faciale',
      facialSetupSubtitle: 'Complétez votre scan facial à 3 poses pour sécuriser votre compte.',
      setupCompleted: 'Configuration faciale terminée !',
      turnLeft: 'Tournez légèrement à gauche',
      turnRight: 'Tournez légèrement à droite',
      holdStill: 'Restez immobile…',
      faceDetected: 'Visage détecté',
      faceNotDetected: 'Visage non détecté',
      capturing: 'Capture…',
      processing: 'Traitement de votre scan',
      processingBody: 'Cela prend quelques secondes. Vos données faciales sont traitées de manière sécurisée et jamais stockées comme photo.',
      success: 'Connexion par visage activée',
      successBody: 'Vous pouvez maintenant vous connecter avec votre visage. Le mot de passe reste disponible.',
      identityVerified: 'Identité vérifiée',
      failed: 'Échec de la vérification du visage',
      failedBody: 'Nous n’avons pas pu vérifier votre identité. Réessayez ou utilisez votre mot de passe.',
      tryAgain: 'Réessayer',
      usePasswordInstead: 'Utiliser le mot de passe',
      emailForFace: 'Saisissez l’email de votre compte',
      continueLabel: 'Continuer',
      captureLabel: 'Capturer',
      authenticating: 'Authentification…',
      enrollTitle: 'Activer la connexion par visage',
      enrollStepConsent: 'Consentement',
      enrollStepCamera: 'Caméra',
      enrollStepPosition: 'Position',
      enrollStepProcessing: 'Traitement',
      enrollComplete: 'Connexion par visage activée — vous pouvez maintenant vous connecter avec votre visage.',
      privacyNotice:
        'Vos données faciales sont traitées pour l’authentification. Un gabarit biométrique est stocké de manière sécurisée, jamais votre photo. Vous pouvez le désactiver et le supprimer à tout moment depuis Paramètres → Sécurité.',
      lastUsed: 'Dernière utilisation',
      enrolledOn: 'Activé le',
      securitySection: 'Sécurité',
      securitySectionDescription: 'Gérez la connexion par visage, votre mot de passe et la sécurité du compte.',
      errorNoFace: 'Aucun visage détecté. Assurez-vous que votre visage est visible et bien éclairé.',
      errorMultipleFaces: 'Plusieurs visages détectés. Assurez-vous d’être seul dans le cadre.',
      errorLowQuality: 'Qualité d’image insuffisante. Améliorez l’éclairage et regardez droit vers la caméra.',
      errorLivenessFailed: 'Échec du test de vivacité. Réessayez avec un scan en direct.',
      errorFaceMismatch: 'Échec de la vérification du visage.',
      errorBiometricDisabled: 'La connexion par visage n’est pas activée pour ce compte.',
      errorChallengeExpired: 'Le scan a expiré. Veuillez recommencer.',
      errorTooManyAttempts: 'Trop de tentatives. Attendez un instant ou utilisez votre mot de passe.',
      errorCameraError: 'Impossible de démarrer la caméra. Vérifiez vos autorisations.',
      errorAiUnavailable: 'La connexion par visage est temporairement indisponible. Utilisez votre mot de passe.',
      errorGeneric: 'Échec de la vérification du visage. Réessayer.',
      temporaryUnavailable: 'La connexion par visage est temporairement indisponible. Utilisez votre mot de passe.',
    },
  },
  ar: {
    dir: 'rtl',
    languageName: 'العربية',
    common: {
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      loading: 'جارٍ التحميل...',
      error: 'حدث خطأ ما',
      success: 'تمت العملية بنجاح',
      search: 'بحث...',
      filter: 'تصفية',
      logout: 'تسجيل الخروج',
      dashboard: 'لوحة التحكم',
      profile: 'الملف الشخصي',
      settings: 'الإعدادات',
      back: 'رجوع',
      next: 'التالي',
      actions: 'إجراءات',
      noData: 'لا تتوفر بيانات',
      support: 'الدعم الفني',
    },
    nav: {
      dashboard: 'لوحة التحكم',
      jobs: 'الوظائف',
      candidates: 'المترشحون',
      companies: 'الشركات',
      pricing: 'الأسعار',
      about: 'عن المنصة',
      applications: 'الترشحات',
      interviews: 'المقابلات',
      analytics: 'الإحصائيات',
      billing: 'الفوترة',
      admin: 'الإدارة',
      team: 'الفريق',
      pipeline: 'مسار التوظيف',
      automation: 'الأتمتة',
      assessments: 'التقييمات',
      settings: 'الإعدادات',
      support: 'الدعم الفني',
      postJob: 'نشر عرض شغل',
    },
    company: {
      overviewTitle: 'نظرة عامة على الشركة',
      overviewSubtitle: 'إليك مستجدات مسار التوظيف الخاص بك اليوم.',
      postJob: 'نشر عرض شغل',
      exportReport: 'تصدير',
      exporting: 'جارٍ التصدير...',
      activeJobs: 'الوظائف النشطة',
      totalApplications: 'إجمالي الترشحات',
      newApplications: 'ترشحات جديدة',
      avgMatchScore: 'معدل التوافق',
      strongMatch: 'ممتاز',
      recruitmentPipeline: 'مسار التوظيف',
      todaysInterviews: 'مقابلات اليوم',
      recentApplications: 'أحدث الترشحات',
      viewAll: 'عرض الكل',
      viewCalendar: 'عرض التقويم',
      aiRecommendation: 'توصية الذكاء الاصطناعي',
      reviewMatches: 'مراجعة المترشحين',
      aiRecommendationText: '5 مترشحين يتوافقون بشدة مع خطة مطوّر خفي (Backend).',
      candidate: 'المترشح',
      role: 'الخطة الوظيفية',
      match: 'التوافق',
      status: 'الحالة',
      actions: 'إجراءات',
      applied: 'تم الترشح',
      screening: 'الفرز الأول',
      shortlisted: 'القائمة القصيرة',
      interview: 'المقابلة',
      offer: 'العرض',
      hired: 'تم التوظيف',
      automation: 'الأتمتة',
      assessments: 'التقييمات',
      support: 'الدعم الفني',
      enterpriseTier: 'اشتراك المؤسسات',
      recruiterPortal: 'بوابة الانتداب',
      jobApplicationsTitle: 'ترشحات الوظائف',
      jobApplicationsSubtitle: 'اختر عرض شغل لعرض وإدارة ترشحات المترشحين.',
      searchJobsPlaceholder: 'البحث عن الوظائف حسب العنوان، القسم، أو المكان...',
      viewApplications: 'عرض الترشحات',
      backToApplications: 'الرجوع إلى الترشحات',
      applicationsForJob: 'الترشحات',
      candidatesAppliedCount: 'مترشحاً قدّموا لهذه الوظيفة',
      noApplicationsYet: 'لا تتوفر ترشحات بعد',
      noApplicationsDesc: 'عندما يترشح المترشحون لهذه الوظيفة، ستظهر ترشحاتهم هنا.',
      viewJob: 'عرض الوظيفة',
      unreviewedNew: 'جديدة',
      interviewed: 'في المقابلة',
      avgAtsScore: 'معدل ATS',
      moreFilters: 'فلترة إضافية',
      matchScoreFilter: 'نسبة التوافق',
      experienceFilter: 'الخبرة',
      atsScoreFilter: 'مؤشر ATS',
      statusFilter: 'الحالة',
      aiAssessmentSummary: 'ملخص التقييم الذكي',
      viewProfile: 'عرض الملف الشخصي',
    },
    candidate: {
      dashboardTitle: 'لوحة قيادة المترشح',
      dashboardSubtitle: 'تابع ترشحاتك ومقابلاتك ونسب التوافق الذكي لسيرتك الذاتية.',
      myApplications: 'ترشحاتي',
      savedJobs: 'الوظائف المحفوظة',
      cvBuilder: 'منشئ السيرة الذاتية',
      atsScore: 'مؤشر ATS',
      aiJobMatching: 'التطابق الذكي',
      matchScore: 'نسبة التوافق',
      notifications: 'الإشعارات',
    },
    marketing: {
      heroTitlePart1: 'اعثر على الوظيفة المناسبة.',
      heroTitlePart2: 'ابنِ مستقبلك.',
      heroSubtitle: 'منصتنا المتقدمة للتطابق بالذكاء الاصطناعي تربطك بفرص تتوافق تماماً مع مهاراتك وخبراتك وأهدافك المهنية.',
      searchPlaceholder: 'المسمى الوظيفي، كلمات مفتاحية...',
      locationPlaceholder: 'المدينة، الولاية، أو عن بُعد',
      searchButton: 'بحث',
      popularTags: 'الأكثر بحثاً:',
      trustedBy: 'موثوق به من قِبل أكثر من 10,000 مؤسسة كبرى حول العالم',
      featuredTitle: 'فرص مميزة',
      featuredSubtitle: 'استكشف وظائف مختارة بعناية مدعومة بالتطابق الذكي من EasyJob.',
      viewAllJobs: 'عرض جميع الوظائف',
      applyNow: 'قدّم الآن',
      aiMatch: 'تطابق ذكي',
    },
    auth: {
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      login: 'تسجيل الدخول',
      register: 'إنشاء حساب',
      forgotPassword: 'نسيت كلمة المرور؟',
      resetPassword: 'إعادة ضبط كلمة المرور',
      verifyEmail: 'تأكيد البريد الإلكتروني',
      welcomeBack: 'مرحباً بعودتك',
    },
    face: {
      loginWithFace: 'تسجيل الدخول بالتعرّف على الوجه',
      signInWithFace: 'تسجيل الدخول بالتعرّف على الوجه',
      signInWithPassword: 'استخدام كلمة المرور بدلاً من ذلك',
      faceAuth: 'تسجيل الدخول بالوجه',
      faceAuthDescription:
        'اختياري. سجّل الدخول بوجهك بدلاً من كلمة المرور. تتم معالجة بيانات وجهك لأغراض المصادقة — يتم تخزين قالب بيومتري بشكل آمن بدلاً من استخدام صورتك ككلمة مرور.',
      enabled: 'مفعّل',
      disabled: 'معطّل',
      enableFaceLogin: 'تفعيل تسجيل الدخول بالوجه',
      disableFaceLogin: 'تعطيل تسجيل الدخول بالوجه',
      consentTitle: 'إعداد المصادقة بالوجه',
      consentBody:
        'المصادقة بالوجه اختيارية — كلمة المرور تعمل دائمًا. لتفعيلها، تتم معالجة مسح قصير لوجهك لإنشاء قالب بيومتري آمن. يتم تشفير القالب وتخزينه على خوادمنا؛ لا يتم حفظ صورتك أبدًا، ويمكنك تعطيل وحذف هذه البيانات في أي وقت.',
      consentAgree: 'أفهم وأوافق',
      consentRequired: 'يجب الموافقة قبل تفعيل تسجيل الدخول بالوجه.',
      cameraPermission: 'إذن الكاميرا',
      cameraPermissionBody: 'اسمح بالوصول إلى الكاميرا لمسح وجهك. تتم معالجة بث الكاميرا في الذاكرة ولا يتم تخزينه أبدًا.',
      cameraDenied: 'تم رفض الوصول إلى الكاميرا',
      cameraDeniedBody: 'يمكنك تفعيل تسجيل الدخول بالوجه لاحقًا من الإعدادات. كلمة المرور متاحة دائمًا.',
      cameraUnavailable: 'الكاميرا غير متاحة',
      positionTitle: 'ضع وجهك في الإطار',
      lookAtCamera: 'انظر مباشرة إلى الكاميرا',
      lookCenter: 'انظر مباشرة إلى الكاميرا.',
      turnLeftPrompt: 'أدر رأسك ببطء نحو اليسار.',
      turnRightPrompt: 'أدر رأسك ببطء نحو اليمين.',
      stepCenter: 'الوسط',
      stepLeft: 'الانعطاف لليسار',
      stepRight: 'الانعطاف لليمين',
      capturingPose: 'تم رصد الوضعية — جارٍ الالتقاط…',
      facialSetupTitle: 'إعداد المصادقة بالتعرّف على الوجه',
      facialSetupSubtitle: 'أكمل مسح وجهك بثلاث وضعيات لتأمين حسابك.',
      setupCompleted: 'تم إعداد المصادقة بالوجه بنجاح!',
      turnLeft: 'أدر رأسك قليلاً إلى اليسار',
      turnRight: 'أدر رأسك قليلاً إلى اليمين',
      holdStill: 'ابقَ ثابتًا…',
      faceDetected: 'تم اكتشاف الوجه',
      faceNotDetected: 'لم يتم اكتشاف الوجه',
      capturing: 'جارٍ الالتقاط…',
      processing: 'جارٍ معالجة مسحك',
      processingBody: 'يستغرق ذلك بضع ثوانٍ. تتم معالجة بيانات وجهك بأمان ولا يتم تخزينها كصورة.',
      success: 'تم تفعيل تسجيل الدخول بالوجه',
      successBody: 'يمكنك الآن تسجيل الدخول بوجهك. كلمة المرور تبقى متاحة.',
      identityVerified: 'تم التحقق من الهوية',
      failed: 'فشل التحقق من الوجه',
      failedBody: 'تعذّر التحقق من هويتك. يمكنك المحاولة مرة أخرى أو استخدام كلمة المرور.',
      tryAgain: 'حاول مرة أخرى',
      usePasswordInstead: 'استخدام كلمة المرور',
      emailForFace: 'أدخل بريدك الإلكتروني',
      continueLabel: 'متابعة',
      captureLabel: 'التقاط',
      authenticating: 'جارٍ المصادقة…',
      enrollTitle: 'تفعيل تسجيل الدخول بالوجه',
      enrollStepConsent: 'الموافقة',
      enrollStepCamera: 'الكاميرا',
      enrollStepPosition: 'الموضع',
      enrollStepProcessing: 'المعالجة',
      enrollComplete: 'تم تفعيل تسجيل الدخول بالوجه — يمكنك الآن تسجيل الدخول بوجهك.',
      privacyNotice:
        'تتم معالجة بيانات وجهك لأغراض المصادقة. يتم تخزين قالب بيومتري بشكل آمن بدلاً من استخدام صورتك ككلمة مرور. يمكنك تعطيله وحذفه في أي وقت من الإعدادات ← الأمان.',
      lastUsed: 'آخر استخدام',
      enrolledOn: 'مفعّل في',
      securitySection: 'الأمان',
      securitySectionDescription: 'إدارة تسجيل الدخول بالوجه وكلمة المرور وأمان الحساب.',
      errorNoFace: 'لم يتم اكتشاف وجه. تأكد من أن وجهك مرئي والإضاءة جيدة.',
      errorMultipleFaces: 'تم اكتشاف أكثر من وجه. تأكد من أنك وحدك في الإطار.',
      errorLowQuality: 'جودة الصورة منخفضة جدًا. حسّن الإضاءة وانظر مباشرة إلى الكاميرا.',
      errorLivenessFailed: 'فشل فحص الحيوية. حاول مرة أخرى بمسح مباشر.',
      errorFaceMismatch: 'فشل التحقق من الوجه.',
      errorBiometricDisabled: 'تسجيل الدخول بالوجه غير مفعّل لهذا الحساب.',
      errorChallengeExpired: 'انتهت صلاحية المسح. ابدأ من جديد.',
      errorTooManyAttempts: 'محاولات كثيرة جدًا. انتظر لحظة أو استخدم كلمة المرور.',
      errorCameraError: 'تعذّر تشغيل الكاميرا. تحقق من الأذونات.',
      errorAiUnavailable: 'تسجيل الدخول بالوجه غير متاح مؤقتًا. استخدم كلمة المرور.',
      errorGeneric: 'فشل التحقق من الوجه. حاول مرة أخرى.',
      temporaryUnavailable: 'تسجيل الدخول بالوجه غير متاح مؤقتًا. استخدم كلمة المرور.',
    },
  },
};
