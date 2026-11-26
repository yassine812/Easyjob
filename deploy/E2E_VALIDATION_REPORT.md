# EasyJob — rapport de validation E2E

> Historical report from 2026-10-23. It does not describe the current runtime. See [the 2026-10-30 validation](VALIDATION_2026-10-30.md), including the Parlor memory limit and inactive merchant configuration.

Date : 23 octobre 2026  
Environnement : stack locale Docker Compose, API `127.0.0.1:3003`, frontend `127.0.0.1:3001`.

## Résultat

La stack est en ligne : PostgreSQL, Redis, API, worker, frontend, Caddy, service IA, Parlor et Mailpit sont démarrés. L’endpoint API de santé retourne `200` avec la base de données et Redis `up`. Le frontend répond `200` sur le parcours Interview Coach.

## Parcours candidat

Le compte candidat existant a été testé sur l’authentification, session, profil, carrière, recherche sémantique, recommandations, détail d’offre, favoris, abonnement, plans, notifications, préférences, paramètres carrière, détails professionnels, analyses IA et historique.

Un compte candidat premium isolé a ensuite été créé uniquement pour le test, avec un CV traité et une souscription PREMIUM temporaire. 20 des 21 appels premium ont réussi :

- préparation d’offre, analyse de compatibilité, préparation d’entretien, tailoring et détection de doublons : `200` ;
- match IA, lettre de motivation, préparation IA, analyse CV et génération CV : `201` ;
- CV Studio, brouillons, analyses et session coach : `200` ;
- réponses coach, simulation recruteur, tour de conversation et pratique ciblée : `200/201` ;
- l’autotest renvoie `404` en production locale car il est volontairement désactivé hors mode QA (`ENABLE_INTERVIEW_AUTOTEST`). C’est une protection attendue, pas une panne utilisateur.

Le test a révélé et corrigé un cas réel : un CV qui couvre tous les critères produisait zéro question et renvoyait `400`. Le moteur fournit maintenant trois questions de secours localisées EN/FR/AR dans ce cas.

## Parcours entreprise

Avec le compte entreprise, les appels suivants ont tous répondu `200` : entreprises, profil privé, vue d’ensemble, paramètres, offres, candidats, entretiens, facturation, analytics, évaluations, recherche workspace, modèles d’e-mail, audit, détails d’offre et affectations.

## Parcours administrateur

Après resynchronisation des rôles et permissions système, les écrans API suivants répondent tous `200` : dashboard, utilisateurs, candidats, entreprises, offres, plans, abonnements, factures, sources d’emploi, santé système, compétences, audit, rôles et permissions.

## Services et déploiement

- `docker compose ... config --quiet` : PASS.
- Caddy production avec domaines injectés : configuration valide.
- Les conteneurs sont démarrés et les conteneurs PostgreSQL, Redis, IA, Parlor et Mailpit sont healthy.
- Un défaut de volume de stockage a été trouvé pendant le dépôt de candidature : le volume nommé était root-owned alors que l’API tourne avec l’utilisateur non privilégié `node`. Un service `storage-init` a été ajouté au compose production et initialise le volume avec UID/GID `1000:1000` avant l’API et le worker.
- Le dépôt de candidature a ensuite été exécuté avec succès après initialisation du volume : création de candidature, CV joint et lecture de la candidature ont répondu correctement.
- La correction TypeScript du coach passe la transpilation syntaxique. La reconstruction complète de l’image API doit être laissée aller jusqu’au bout sur la machine de déploiement : le premier build propre a été interrompu car l’installation npm Alpine était encore en cours, donc je ne marque pas ce build comme terminé.

## Limites de validation

Les 10 réponses non-200 du premier smoke test candidat étaient les garde-fous attendus d’un compte gratuit sans CV traité : fonctionnalités premium `403` et fonctions nécessitant un CV traité `400`. Le compte premium isolé a couvert ces mêmes fonctions avec succès, à l’exception de l’autotest explicitement désactivé en production.

## Image freshness note

The running AI container responds `200` on `/health`, but its current image predates the newer `/health/ready` route (it returns `404`). This confirms the local containers were not rebuilt from the latest source. Before VPS release, let the clean API and AI image builds complete and then recreate the stack; the source compose and preflight changes are ready, but the interrupted build must not be treated as a successful release build.

## Preuves visuelles navigateur (2026-10-23)

Les captures suivantes ont été prises dans une session navigateur réelle sur le build local de validation (`http://localhost:3011`), avec les données chargées par l’API EasyJob :

- **Candidat — tableau de bord** : session authentifiée, indicateurs de candidatures/entretiens, activité récente et parcours de candidature visibles.
- **Candidat — recherche d’emploi** : session authentifiée, offre publiée visible, score de correspondance IA à 100 %, explication d’analyse, localisation/rémunération et actions enregistrer/postuler.
- **Entreprise — tableau de recrutement** : session authentifiée, indicateurs d’offres/candidatures/entretiens, candidatures à traiter et actions de recrutement visibles.
- **Platform Admin — vue d’ensemble** : session authentifiée, 4 entreprises actives, 25 utilisateurs actifs, 1 offre active, indicateurs de santé et navigation d’administration visibles.

Ces captures prouvent que les trois espaces s’ouvrent réellement, que l’authentification fonctionne et que les données principales se chargent dans le navigateur. Elles ne prouvent pas à elles seules chaque mutation de chaque page ; la matrice d’API et les checks listés plus haut restent la référence de couverture fonctionnelle.

## Limites constatées avant déploiement

- L’image web de production actuellement lancée est ancienne et son bundle pointe vers `https://easyjob.localhost/api/v1`. Les captures locales ont donc utilisé un build dev frais et un proxy localhost de validation.
- Le certificat Caddy local auto-signé n’a pas pu être accepté par l’automatisation navigateur ; les captures de production HTTPS n’ont pas été utilisées comme preuve.
- Il faut reconstruire l’image web avec la bonne valeur `NEXT_PUBLIC_API_URL`, puis reconstruire l’image AI pour exposer `/health/ready`, avant de déclarer l’artefact de déploiement final.
- Le log dev signale encore `GET /images/coach/easyjob-human-transparent.png 404` ; cet asset doit être inclus/corrigé avant publication.


### Fichiers des captures

- [Candidat — tableau de bord](<C:\Users\Yassine\job startup\deploy\e2e-captures\candidate-dashboard.png>)
- [Candidat — recherche d’emploi](<C:\Users\Yassine\job startup\deploy\e2e-captures\candidate-jobs.png>)
- [Entreprise — tableau de recrutement](<C:\Users\Yassine\job startup\deploy\e2e-captures\company-dashboard.png>)
- [Platform Admin — vue d’ensemble](<C:\Users\Yassine\job startup\deploy\e2e-captures\admin-overview.png>)


## Correctifs et vérification finale (2026-10-23)

- Les trois assets coach référencés par le frontend ont été ajoutés dans `public/images/coach/`: `easyjob-human-transparent.png`, `easyjob-human-poses.png` et `easyjob-builder.png`.
- `lucide-react` a été remis sur la version stable `0.468.0`, compatible avec React Server Components et avec ses déclarations TypeScript.
- `npx tsc --noEmit --pretty false` : PASS.
- `npm run build` : PASS ; compilation Turbopack, TypeScript, collecte de données et génération des 73 routes terminées.
- Vérification HTTP du build de production : frontend `200`, API `/api/v1/health` `200`, les trois URLs coach `200`.


## Docker AI rebuild attempt (2026-10-23)

- Corrected the AI Docker build packaging by setting `PYTHONPATH=/app` for the model-cache step.
- Reduced the Hugging Face cache download to the model files needed by EasyJob and enabled 16 parallel downloads.
- The AI image build completed its model preload and produced image `startup-starter-prod-ai:latest` (sha `42b2c10a5cdd`, approximately 3.65 GB). The local Docker daemon was still unpacking this very large image when the runtime smoke command was stopped; the image should be recreated and health-tested on the VPS after transfer.
- The source-level web build and HTTP asset checks are complete; the currently running production web container was not replaced by this local build.

