# EasyJob — validation du 30 octobre 2026

## Résultats automatisés

| Périmètre | Résultat |
| --- | ---: |
| Frontend — 65 fichiers | 376 / 376 |
| Backend unitaire — 73 fichiers | 642 / 642 |
| Backend E2E HTTP/PostgreSQL/Redis — 10 suites | 97 / 97 |
| Service IA Python — 18 modules | 401 / 401 |
| Adaptateur Parlor — cycle de vie/CPU | 6 / 6 |
| Scripts services/seed et précontrôle Konnect | 8 / 8 |
| **Total des tests uniques** | **1 530 / 1 530** |

Les 376 tests frontend sont l'union vérifiée de 366 tests du lancement complet et de 10 tests du fichier de reconnaissance faciale, relancé après expiration du délai de démarrage d'un worker. Le premier processus a quitté avec un code non nul pour ce timeout d'infrastructure ; aucun test en échec n'a été masqué. Les deux rapports bruts sont conservés.

Les builds frontend de production (73 routes) et backend compilé, les vérifications TypeScript et les configurations Docker Compose sont terminés. Les E2E utilisent une base exclusivement dédiée aux tests et Redis sur un port isolé. Les contrôles API des trois comptes fictifs passent 23/23, notamment les refus d'accès admin pour les autres rôles.

## Corrections principales

- Offres d'une entreprise active créée par l'admin visibles sans l'ancien dossier de vérification ; entreprises suspendues/offres expirées toujours filtrées.
- Résiliation à échéance autorisée pour un abonnement impayé sans effacer la dette.
- CV : tests éditeur/API corrigés, état de photo existante et libération des URL de prévisualisation réparés.
- Guide contextuel utilisant l'avatar humain officiel dans les trois espaces ; logo, navigation, thèmes clair/sombre, animations discrètes et préférence de réduction du mouvement harmonisés.
- Quinze fichiers sources réellement orphelins supprimés après vérification des imports/références et nouvelle compilation.
- Réparation des dépendances Nest/Socket.IO et des images Linux IA ; OpenCV/Torch compatibles, modèles visage vérifiés et corpus O*NET officiel restauré.
- Modèle Whisper-small multilingue embarqué avec révision/empreintes fixes pour la transcription hors ligne.
- Incompatibilité PyAV 19/Whisper reproduite sur un vrai audio et corrigée en fixant les versions compatibles ; décodage réel couvert par régression.
- Modèle vocal préchargé avant l'état prêt, refus rapide pendant le démarrage et absence de chargement parallèle. Disponibilité non bloquante pendant le chargement des modèles ; six tests de démarrage ajoutés.
- Parlor : binaire conservant ses bibliothèques partagées, readiness réel, refus du WebSocket avant chargement, options CPU configurables, port local 8001.
- Jetons d'activation et réinitialisation exclus des journaux de requêtes.
- Konnect : variables Docker, vérification autoritaire du paiement, montant/devise, idempotence et précontrôle des identifiants/callback testés.

Le catalogue reste **PLATFORM_ONLY** : aucun import externe n'a été réactivé.

## Portée et limites réelles

- **Konnect n'est pas actif** : clé marchand, wallet et callback public non renseignés localement. Aucun débit réel n'a été effectué. Les tests fournisseur sont simulés ; ils ne constituent pas un checkout marchand réel.
- **Parlor réel non validé sur ce PC** : le moteur Gemma signale une mémoire système insuffisante sur la machine Windows de 6 Go sous Docker/WSL, même avec contexte réduit. Le processus a été arrêté pour éviter la saturation. Les six tests de l'adaptateur utilisent un chargeur simulé. Une page HTML accessible n'est pas une preuve d'inférence.
- Les tests Python exécutent de véritables modèles visage/embeddings et décodeur audio hors réseau, ainsi que des fixtures et mocks explicitement déclarés. Le contrôle de transcription vocale réel possède sa propre preuve dans le rapport local. La qualité de chaque réponse d'un fournisseur externe n'est pas certifiée.
- Aucune nouvelle capture écran : le contrôle ordinateur a été interrompu par Échap. Les tests de composants et contrôles HTTP ne prouvent pas une revue visuelle de chaque écran.
- Caméra/microphone physiques, appel sur deux appareils, DNS/TLS publics et installation sur le futur VPS ne sont pas certifiés par cette passe locale.

## Preuves locales

Le rapport complet généré est [`.runtime/validation-easyjob-final.html`](../.runtime/validation-easyjob-final.html), avec chaque assertion, les résultats HTTP et les limites. Le [manifeste JSON](../.runtime/validation-manifest-final.json) contient les empreintes SHA-256 des preuves.

Les preuves brutes restent dans `.runtime/` : rapports frontend agrégés et originaux, rapports Jest backend/E2E, JUnit Python/Parlor, builds, vérification de cache et transcription, diagnostics mémoire et contrôles des trois rôles. Ce répertoire local est volontairement ignoré par Git ; les liens nécessitent le poste où les tests ont été exécutés.

Ce rapport remplace l'état courant décrit dans le rapport historique du 23 octobre, sans modifier ses anciennes preuves.
