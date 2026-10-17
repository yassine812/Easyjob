# EasyJob — bilan de livraison du 23 septembre 2026

## Résultat et limite principale

Le code d’agrégation, le cycle de vie des offres, la recherche paginée, les candidatures natives et les contrôles Premium ont été modifiés dans le projet existant. Les deux migrations ont été appliquées localement. L’API et les workers ont redémarré.

**Les 11 intégrations ne sont pas actives en production.** Aucun accès partenaire autorisé n’a été fourni. Les adaptateurs acceptent le contrat de flux licencié `easyjob-v1`, qui est un format EasyJob pour une passerelle autorisée, pas une API prétendument fournie par chaque site. Les correspondances avec les schémas natifs des fournisseurs restent à réaliser à réception de leurs contrats. Ne pas annoncer « 11 sources opérationnelles ».

## Sources

| Source | État réel | Prochaine dépendance |
|---|---|---|
| APEC | Non active ; partenariat requis | Accès au flux XML partenaire et schéma |
| Glassdoor | Non active ; API de catalogue non vérifiée | Contrat de redistribution et documentation |
| Welcome to the Jungle | Non active ; partenariat requis | Accès activé pour l’organisation et périmètre autorisé |
| TanitJobs | Non active ; accès recruteur soumis à abonnement | Autorisation de catalogue ; l’API recruteur ne prouve pas un accès global |
| Indeed | Non active ; partenariat requis | Contrat de catalogue ; Job Sync n’est pas une recherche publique globale |
| LinkedIn | Non active ; partenariat requis | Produit partenaire et périmètre de lecture autorisé |
| Fabskill | Non active ; identifiants et schéma requis | Documentation des offres, autorisation et identifiants |
| JobReview | Non active ; identité/API non vérifiées | Fournisseur et contrat à confirmer |
| Emploitunisie | Non active ; API non vérifiée | Flux ou API autorisés |
| Optioncarriere / Careerjet | Non active ; identifiants requis | Clé publisher pour recherche utilisateur ; droits distincts pour cache et synchronisation |
| Keejob | Non active ; API non vérifiée | Flux ou API autorisés |

Careerjet dispose aussi d’une méthode de recherche publisher basée sur l’API documentée, avec IP et user-agent du véritable utilisateur. Elle n’est pas branchée sur un crawl quotidien anonyme. Aucun fournisseur n’a été testé avec des identifiants réels. Aucune indisponibilité temporaire de ces 11 fournisseurs n’est affirmée faute de tentative autorisée.

Les anciennes sources ANETI sont désactivées sans autorisation explicite ; Jooble attend sa configuration. Les preuves officielles et limites sont regroupées dans [la matrice des capacités](JOB_SOURCE_CAPABILITIES.md) et ses 11 fiches. Les variables sans secret sont dans [l’exemple de configuration](../.env.job-sources.example).

## Données réellement disponibles

Audit en lecture seule du 23 septembre 2026, 13:57:56 UTC :

| Mesure | Résultat |
|---|---:|
| Offres externes autorisées visibles | 0 |
| Offres natives éligibles à la découverte | 0 |
| Offres visibles par nouvelle source | 0 pour chacune des 11 |
| Nouvelles offres importées pendant cette intervention | 0 |
| Doublons fusionnés pendant une synchronisation réelle | 0 |
| Offres expirées retirées pendant une synchronisation réelle | 0 |
| Anciennes offres agrégées conservées avec statut OPEN | 3 082 |
| Anciennes offres agrégées conservées avec statut CLOSED | 53 |

Les statuts historiques OPEN ne prouvent ni l’activité actuelle ni les droits de redistribution. Ces données et les anciennes offres fictives/copiées sous des employeurs de test sont conservées pour l’historique, mais exclues du catalogue candidat. Aucun chiffre historique n’est présenté comme le résultat d’une nouvelle synchronisation validée. Les références par source peuvent dépasser les offres canoniques à cause des doublons.

[Audit JSON détaillé](job-catalogue-audit.json), reproductible après compilation par `node scripts/audit-job-catalogue.cjs`.

## Fonctionnalités réalisées

- Modèle normalisé enrichi, identité d’entreprise, logo fourni par la source, provenance, données brutes et snapshot normalisé. Salaires et devise conservés sans montants inventés.
- Déduplication par identifiant source, empreinte puis similarité prudente avec contrôles d’entreprise, lieu, référence et dates.
- Synchronisation BullMQ toutes les 24 heures pour les sources configurées ; pagination, délais, reprises avec backoff, isolation des erreurs et historique des compteurs.
- Fermetures explicites et échéances prises en compte ; disparition traitée seulement après un snapshot complet réussi et un délai de grâce de 72 heures par défaut. Une panne ne ferme pas les offres.
- Recherche et matching avant pagination ; tous les plans voient toutes les offres et le score réel (0–100 %). Le curseur de matching sert uniquement à filtrer volontairement la liste, quel que soit le plan.
- Supervision dans `/admin/job-sources` et `/admin/integrations`, avec état effectif, erreurs et compteurs.
- Cartes et détails enrichis, attribution réelle, logos avec repli, navigation vers les détails, sources de filtre limitées aux connecteurs utilisables.

## Candidatures et Premium

La candidature native EasyJob prend le CV original sélectionné, le profil revu, la lettre et les réponses aux questions. Champs texte, texte long, booléen, nombre, date, sélection simple/multiple et fichier sont validés côté serveur. Le fichier doit appartenir au candidat ; le consentement est obligatoire. Un champ fichier sélectionne actuellement un CV déjà stocké, pas un document arbitraire téléversé.

La navigation externe reste gratuite. Elle est enregistrée comme `EXTERNAL_SITE_OPENED`, avec `submitted: false`, jamais comme une candidature envoyée. Les 11 connecteurs sont `EXTERNAL_ONLY`. Aucun envoi par API fournisseur ni par e-mail employeur n’a été implémenté sans contrat vérifié.

La préparation Premium dispose d’un espace de sélection de CV, de preuves issues du profil et d’une checklist. L’entitlement `ai.cover_letter` est vérifié côté serveur. Cela ne constitue pas une soumission.

L’Auto-Apply exige `career.auto_apply` (PREMIUM dans la configuration actuelle), un PDF possédé et choisi, des préférences et des limites journalières/hebdomadaires. La revue est activée par défaut. L’envoi sans revue exige un consentement distinct. Les questions imposent une revue ; seuls les emplois natifs pris en charge peuvent être envoyés automatiquement. La notification de succès suit la transaction confirmée. Aucune conversion du CV en fichier Markdown.

**Candidatures réelles envoyées pendant la validation : 0.** Les transactions et refus sont vérifiés par tests isolés, sans contacter un employeur.

## Validation

| Vérification ciblée | Résultat |
|---|---|
| Backend : 10 suites | 182 tests réussis, 0 échec |
| Interface : 2 suites | 11 tests réussis, 0 échec |
| Total ciblé | 193 réussis, 0 échec |
| Vérification TypeScript backend | Réussie |
| Vérification TypeScript frontend | Réussie |
| Migrations Prisma et génération du client | Réussies |
| Démarrage API et contrôle de santé | Réussis |
| Worker CV | Prêt |
| Worker BullMQ | Relancé |
| Navigateur `/candidate/jobs` | État vide correct affiché après chargement |

Les tests couvrent les contrats de flux, les erreurs et snapshots incomplets, le cycle de vie, les règles de matching/pagination, les entitlements, le CV exact et le consentement. Ils ne remplacent pas les tests d’acceptation avec les véritables fournisseurs. Jest a signalé des ressources encore ouvertes à la fin d’un passage backend, puis le processus s’est terminé avec le code 0.

## Reste à faire avant validation de production

1. Obtenir les contrats/identifiants et implémenter les mappings natifs documentés. Valider chaque source avec ses données réelles, ses quotas et ses droits.
2. Implémenter les candidatures API/e-mail uniquement pour les fournisseurs qui les autorisent, puis tester leurs confirmations réelles.
3. Ajouter le téléversement de pièces justificatives générales et un concepteur de questions côté recruteur si nécessaires ; le schéma est actuellement configurable par l’API autorisée.
4. Tester la charge et indexer/materialiser le matching : le catalogue filtré est actuellement parcouru avant pagination, ce qui n’est pas encore validé pour un volume important.
5. Compléter les essais visuels mobile/desktop et le parcours réel avec offres autorisées. L’état vide a été observé dans le navigateur ; le contrôle interactif du tiroir a rencontré un délai d’attente de l’outil. Ne pas considérer cela comme une validation responsive complète.

Le catalogue vide observé est donc un blocage de données autorisées, pas la preuve que les intégrations fournisseurs sont terminées. L’objectif final « chercher puis candidater à des offres réelles des 11 sources » reste partiellement bloqué par les accès et les mappings fournisseurs.
