# Identité des fonctionnalités EasyJob

`EasyJobFeatureMark` et `EasyJobFeatureLabel` réutilisent le symbole de `web/public/easyjob-logo.png`, avec les tailles sm (16 px), md (20 px) et lg (28 px). Le symbole est décoratif quand il accompagne un libellé. Les boutons conservent leur nom accessible.

## Explications des questions

Le backend ajoute un objet `reason` aux questions des endpoints dossier et salle d’entretien. Les nouveaux dossiers persistent les métadonnées dans le champ JSON `evidence` existant. Les anciens dossiers sont adaptés à la lecture à partir de leur statut de preuve, sans analyser leur texte de diagnostic ni modifier les notes du recruteur.

Le composant `QuestionReason` utilise des modèles FR/EN/AR pour MISSING_EVIDENCE, WEAK_EVIDENCE, STRONG_EVIDENCE, TRANSFERABLE et SENIORITY. Un modèle neutre est utilisé si les métadonnées manquent. TRANSFERABLE exige une compétence source et un extrait réel ; SENIORITY exige un niveau reconnu. Ces modèles ne créent pas de nouveaux résultats d’analyse. Les extraits sont affichés uniquement lorsqu’ils sont fournis par le backend.

Les diagnostics `weak CV evidence`, `unknown requirement`, les compteurs de mentions, les enums source/importance et les raisons brutes ne sont plus rendus dans la salle ni le dossier d’entretien. UNKNOWN ne produit aucun badge. Les questions ajoutées par un recruteur ne sont pas attribuées à EasyJob.

## Audit des icônes

Les fonctionnalités CV, ATS, matching, AutoApply, analyse recruteur, potentiel, création d’offres, entretiens et les sections de présentation réutilisent la marque commune. Les icônes fonctionnelles (recherche, calendrier, téléchargement, réglages, messages), les étoiles de favoris et Crown restent distinctes. Le sparkle décoratif de la page 404 reste hors des fonctionnalités EasyJob.

Fichiers migrés pour l’icône :

- `web/src/app/(marketing)/about/page.tsx`

- `web/src/components/candidate/application-preparation.tsx`
- `web/src/components/candidate/application-progress.tsx`
- `web/src/components/candidate/application-tracking.tsx`
- `web/src/components/candidate/apply-dialog.tsx`
- `web/src/components/candidate/ats-report.tsx`
- `web/src/components/candidate/career-pages.tsx`
- `web/src/components/candidate/career-shared.tsx`
- `web/src/components/candidate/cv-designer-document.tsx`
- `web/src/components/candidate/cv-designer.tsx`
- `web/src/components/candidate/cv-improvement-review.tsx`
- `web/src/components/candidate/cv-library.tsx`
- `web/src/components/candidate/cv-workspace.tsx`
- `web/src/components/candidate/job-match-insights.tsx`
- `web/src/components/candidate/recruitment-evidence.tsx`
- `web/src/components/company/easyjob-feature.tsx`
- `web/src/components/company/easyjob-meeting.tsx`
- `web/src/components/company/growth-potential-dialog.tsx`
- `web/src/components/company/job-creation-assistant.tsx`
- `web/src/components/company/meeting-assistant.tsx`
- `web/src/components/company/recruitment-assistant.tsx`
- `web/src/components/company/recruitment-workspace.tsx`
- `web/src/components/company/workspace-overview.tsx`
- `web/src/components/landing/career-landing.tsx`
- `web/src/components/landing/hero-visual-animation.tsx`
- `web/src/components/shared/analysis-processing.tsx`
- `web/src/components/candidate/cv-studio/studio-ai.tsx`
- `web/src/components/candidate/cv-studio/studio-canvas.tsx`
- `web/src/components/candidate/cv-studio/studio-editor.tsx`
- `web/src/components/candidate/cv-studio/studio-fields.tsx`
- `web/src/components/candidate/cv-studio/studio-route.tsx`
- `web/src/app/(candidate)/layout.tsx`
- `web/src/app/(company)/company/[companyId]/candidates/[candidateId]/page.tsx`

Autres fichiers :

- `web/src/config/site.ts` : présentation neutre de la plateforme.

- `web/src/components/ui/easyjob-feature-mark.tsx` : identité partagée.
- `web/src/components/company/question-reason.tsx` : disclosure, sources et preuves.
- `web/src/lib/interview-reason.ts` : contrat et modèles localisés.
- `web/src/components/company/interview-workspace.tsx` : dossiers et raisons.
- `web/src/components/company/meeting-types.ts`, `meeting-copy.ts` : contrat de salle et libellé.
- `web/src/components/layout/app-shell.tsx` : accepte la marque comme icône de navigation.
- `web/src/lib/i18n/career.ts`, `dictionaries.ts` : libellés EasyJob.
- `web/src/components/candidate/cv-management-actions.tsx` : libellé d’amélioration.
- `src/interviews/question-reason.ts` : adaptation des dossiers enregistrés.
- `src/interviews/interview-brief.service.ts` : métadonnées de génération, réponse structurée et priorités PDF lisibles.
- `src/interviews/meeting.service.ts` : réponse structurée de la salle, avec les permissions existantes.

## Vérification

- `web/src/components/company/question-reason.test.tsx` : cinq modèles, trois langues, absence de claims sans données, extraits réels et marque officielle.
- `web/src/components/company/easyjob-meeting.test.tsx` : régression salle, notes et diagnostic masqué.
- `web/src/components/ui/easyjob-feature-audit.test.ts` : audit des espaces candidat/recruteur/admin et préservation des icônes fonctionnelles.
- `test/unit/question-reason.spec.ts` : anciens dossiers, sources, preuves et questions manuelles.
- Rendu du composant vérifié en thème sombre et à 390 px, sans débordement horizontal. Une route temporaire avec des données de démonstration a été utilisée pour cette vérification.
