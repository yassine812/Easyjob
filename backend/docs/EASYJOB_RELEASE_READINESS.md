# EasyJob — livraison et préparation du déploiement

État du 10 septembre 2026. Cette livraison applique la dernière règle métier : les candidats peuvent s’inscrire publiquement ; seul un administrateur de plateforme peut créer une entreprise. Les anciennes maquettes avec inscription entreprise libre sont remplacées par cette règle.

## Parcours livrés

Le diagnostic ATS fournit désormais, pour chaque contrôle, des extraits du CV, des mesures observées et une priorité. L’interface distingue les prochaines améliorations, les contrôles déjà validés et une comparaison unique avec l’offre sélectionnée. Les cartes vides et le doublon mots-clés/compétences manquantes sont supprimés. Des aides à la rédaction utilisent les éléments extraits et signalent les champs à compléter ; elles n’inventent aucun résultat. Les indications de périmètre (fonctionnalités, plateformes, etc.) sont distinguées des résultats mesurés, uniquement dans les rubriques expérience et projets. Une durée de formation ne compte pas comme résultat professionnel. La note reste un contrôle heuristique du texte, sans validation de la mise en page ni prédiction du résultat d’un ATS employeur. Une correction du fichier nécessite son réimport pour actualiser le diagnostic.

Validation du nouveau diagnostic : 37 tests backend distincts après réexécution ciblée, dont 14 tests du diagnostic, et 21 tests frontend réussis. Contrôle des types et lint ciblé réussis. Les tests couvrent notamment les durées de formation exclues des résultats professionnels, les phrases PDF coupées sur plusieurs lignes, les citations exactes conservant une affirmation chiffrée chacune, les preuves échappées, les anciens rapports, les états vides et d’erreur, ainsi que le changement d’offre sans afficher l’ancienne note.

Mise à jour de la présentation candidat : les expériences extraites sont affichées dans des fiches distinctes (poste, entreprise, période et missions). Le texte source reste consultable et chaque fiche peut être corrigée séparément dans le profil. Les dates non reconnues restent à compléter ; aucune expérience n’est inventée. Les titres combinés « Certifications & langues » ne sont plus intégrés aux compétences.

Les comptes de démonstration sont signalés dans l’interface. Les textes initiaux des exemples locaux ont été rendus explicites sans toucher aux CV téléversés ni aux champs personnalisés. Sur les quatre candidats de démonstration, 28 expériences et 28 formations strictement dupliquées ont été retirées après sauvegarde dans `.runtime/demo-duplicates-backup-*.json`. Le seed vérifie désormais l’existence de ces expériences et formations avant de les créer. `scripts/clarify-local-demo.cjs` permet de remplacer uniquement les anciens textes fictifs inchangés dans la base locale.

Validation de cette mise à jour : 12 tests backend et 12 tests frontend ciblés réussis, compilations NestJS/Next.js et contrôle des types réussis, lint des composants concernés sans erreur. Après redémarrage sur le port 3000, le CV existant a été contrôlé via l’API et dans le navigateur : cinq expériences distinctes avec dates et missions, et 25 compétences. Les offres et candidatures historiques de démonstration restent conservées ; le nettoyage des doublons porte ici sur les expériences et formations.

| Parcours | Comportement |
| --- | --- |
| Mot de passe oublié | Page publique accessible même avec une session existante ; une connexion tardive ne redirige plus vers le dashboard après le clic. Réponse identique pour une adresse connue ou inconnue. Lien valable une heure et utilisable une seule fois. |
| Réinitialisation | Nouveau mot de passe contrôlé ; sessions et jetons de renouvellement précédents invalidés, connexions temps réel fermées. |
| Entreprise | Création dans Administration → Entreprises : identité de l’entreprise, responsable et e-mail professionnel. Les anciens endpoints publics refusent la création. |
| Identifiants entreprise | Mot de passe aléatoire, valable 24 heures ; changement obligatoire avant accès aux fonctions privées. E-mail placé dans une outbox durable et chiffrée après création transactionnelle du compte. |
| Suivi e-mail | Statut d’envoi visible par l’admin, reprises automatiques, nouvelle tentative manuelle après échec. « Envoyé » signifie accepté par SMTP ; seule une vérification de la boîte destinataire prouve la réception. Aucun mot de passe dans la réponse API ou les journaux. |
| CV candidat | Extraction des champs reconnus, compétences et sections professionnelles après traitement du fichier. Les valeurs existantes et les modifications non enregistrées sont préservées. Le candidat relit et corrige avant de continuer. |
| Photo | Téléversement, remplacement et suppression. Validation réelle du format, redimensionnement, suppression des métadonnées, stockage privé et URL signée. |
| Face ID | Consentement distinct de la photo, caméra ouverte par une action explicite, détection locale Face API et poses centre/gauche/droite. Vérification finale côté serveur et empreinte chiffrée. Connexion par mot de passe toujours disponible. Suppression possible dans les paramètres. |

Les invitations privées des collaborateurs d’une entreprise restent disponibles selon les permissions internes. Elles ne constituent pas une inscription publique RH.

## Conception globale existante

- Candidat : offres et filtres, favoris, candidatures et suivi, CV et rapports ATS, édition/export, recommandations, alertes, candidatures automatiques avec consentement, préparation aux entretiens et assistant carrière, abonnements.
- Entreprise : offres, candidatures par poste et pipeline, fiches candidat, notes, entretiens, évaluations et correction humaine, collaborateurs et permissions, communications, statistiques et facturation.
- Plateforme : utilisateurs, entreprises, vérifications, offres, abonnements, statistiques et audit.
- Infrastructure : Next.js, API NestJS, PostgreSQL/Prisma, Redis/BullMQ, worker distinct, FastAPI, stockage privé, SMTP et notifications temps réel.

Les détails fonctionnels se trouvent dans `EASYJOB_PRODUCT_CONCEPTION.md`, `CANDIDATE_CAREER_CONCEPTION.md`, `EASYJOB_COMPANY_CONCEPTION.md` et `EASYJOB_UX_REDESIGN.md` du même dossier.

## Préparation d’une installation

1. Utiliser Node 24, PostgreSQL et Redis. Copier `.env.production.example` vers `.env.production`, renseigner le domaine et les secrets réels. Aucun secret du poste de développement ne doit être réutilisé en production.
2. Exécuter `npm ci`, `npm run prisma:generate`, puis `npm run release:check -- --env .env.production`. Ce contrôle ne contacte pas les prestataires et ne prouve pas leur disponibilité.
3. Sur le serveur cible, construire et démarrer avec `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`. Le fichier compose applique les migrations ; le domaine doit pointer vers ce serveur et les ports 80/443 doivent être disponibles.
4. Initialiser uniquement les rôles et offres système : `docker compose -f docker-compose.prod.yml --env-file .env.production exec api node dist/prisma/prisma/seed-system.js`. Le seed de démonstration ne doit pas être exécuté en production.
5. Inscrire et vérifier l’e-mail du propriétaire. Depuis le serveur : `docker compose -f docker-compose.prod.yml --env-file .env.production exec api node scripts/bootstrap-admin.cjs owner@yourdomain.com`. Cette commande exige un compte actif avec e-mail vérifié ; elle ne remplace aucun mot de passe et invalide les sessions précédentes. Reconnexion nécessaire.
6. Vérifier HTTPS, connexion/déconnexion, récupération d’un mot de passe et réception effective d’un e-mail entreprise, CV/photo, accès inter-entreprises, webhook de paiement et persistance après redémarrage.
7. Sauvegarder PostgreSQL, le stockage et les clés de chiffrement. Tester une restauration sur une instance séparée avant ouverture au public.

L’API et le worker partagent la configuration SMTP, les liens du frontend et les paramètres de paiement. SMTP sur 587 utilise STARTTLS (`SMTP_SECURE=false`) ; 465 utilise TLS implicite (`true`).

## Migration de cette livraison

`20260910000100_admin_provisioning_and_photo` ajoute les champs de mot de passe temporaire, la version de session, la photo du candidat et l’outbox d’accès entreprise. Migration appliquée à la base locale après une sauvegarde PostgreSQL au format custom, conservée dans `.runtime/easyjob-before-release-20260910.dump`.

La clé biométrique et le secret JWT de renouvellement protègent respectivement les empreintes et les e-mails temporaires en attente. Leur rotation nécessite une procédure dédiée ; ne pas les supprimer ou remplacer sans traiter les données chiffrées associées.

## Limites avant ouverture publique

La configuration locale est destinée au développement. Un déploiement public n’a pas été effectué et n’est pas déclaré validé.

- Domaine, HTTPS, vrais secrets, facturation live et webhooks restent à configurer sur l’hébergement choisi.
- La connectivité réelle du fournisseur d’IA et les quotas doivent être vérifiés. Le mode déterministe de test ne prouve pas le fonctionnement du service génératif.
- Face ID nécessite des essais sur caméras réelles, une calibration des seuils et une validation des conditions de consentement/conservation. Le contrôle de mouvement n’est pas une certification anti-usurpation ni une preuve d’identité légale.
- Un CV scanné sans couche texte peut nécessiter une saisie manuelle : pas d’OCR ajouté. Les informations absentes ou ambiguës ne sont pas inventées.
- Les intégrations Google/Outlook/Meet, une signature électronique externe et les essais de charge à grande échelle ne sont pas validés dans cette livraison. Les fonctions décrites comme futures dans les documents de conception ne deviennent pas disponibles par cette livraison.

## Vérifications de la livraison

- Frontend : 114 tests réussis, dont la récupération pendant une connexion en cours, l’isolation des sessions et la caméra guidée. Compilation Next.js 16.3.4 réussie.
- Backend : 151 tests unitaires réussis, plus le nouveau cas de contrôle de la troisième pose (10 tests du client facial réussis). Compilation NestJS réussie.
- Service IA : 39 tests réussis avec un fournisseur de test isolé. Ces tests n’utilisent pas les clés réelles du poste.
- Intégration : 97 tests validés sur PostgreSQL/Redis isolés, après correction des anciennes fixtures et réexécution des suites concernées. Couverture : création entreprise, e-mail capturé en test, mot de passe temporaire, réinitialisation concurrente, préremplissage CV, photo, biométrie, sécurité, facturation, rôles, recrutement et chaîne de traitement IA.
- Exécution locale : frontend `http://localhost:3000`, API `http://127.0.0.1:3002`, service IA `http://127.0.0.1:8000`. Santé PostgreSQL/Redis OK. Parcours « Mot de passe oublié » et écran d’accès entreprise contrôlés dans le navigateur.
- Derniers contrôles : 32 tests ciblés du frontend réussis après les ajustements React, types backend vérifiés, erreurs de lint corrigées dans les fichiers concernés. Des avertissements de lint restent dans des composants historiques.
- Configuration Docker Compose validée. Image API `easyjob-api:release-check` construite avec Node 24, Prisma et les scripts de seed système. Démarrage du runtime sans réseau vérifié sous un utilisateur non privilégié (UID 1000), avec chargement de Prisma et traitement JPEG par Sharp. Audit des dépendances de production : aucune vulnérabilité connue signalée au moment du contrôle.

Le navigateur intégré a parfois conservé le contenu d’anciennes pages sur l’origine du port 3000, malgré des réponses HTTP correctes. La navigation connexion → récupération a également été validée sur une origine de test vierge. Si une ancienne page persiste dans le navigateur habituel, vérifier dans une fenêtre privée avant de conclure à une régression du serveur. Aucun effacement global des données du navigateur n’a été effectué.

### Services externes — contrôle réel

Gmail SMTP répond **535 / EAUTH** avec le mot de passe d’application précédemment fourni, malgré un hôte, un compte, un port et un mode TLS corrects. Aucun nouvel e-mail réel n’est déclaré reçu. Le remplacement de ce mot de passe est demandé au propriétaire.

Le service génératif répond **503** à EasyJob car l’appel OpenAI sous-jacent reçoit **429**. Son accès/limite doit être rétabli avant validation des fonctions génératives réelles.

Le compte du propriétaire existe mais son e-mail n’est pas encore confirmé. Le contrôle automatique des autorisations a refusé sa promotion préalable en administrateur, car cette attribution de droits élevés avant vérification n’était pas explicitement autorisée. Aucun rôle n’a été modifié. Le propriétaire a ensuite choisi d’attendre la vérification de l’e-mail. Après rétablissement de SMTP et confirmation de l’adresse, utiliser la commande normale `admin:grant -- owner@yourdomain.com` ; une reconnexion sera nécessaire après attribution du rôle.
