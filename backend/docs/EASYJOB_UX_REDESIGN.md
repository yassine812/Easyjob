# EasyJob — audit UX et refonte

## Décision d’architecture avant implémentation — 10 septembre 2026

Audit du code : inventaire de 172 fichiers de pages et composants, 18 usages de dialogues/sheets, 7 tables et 61 couleurs codées directement. Lecture des layouts candidat/entreprise/admin, shell, menus, recherche, tableaux de bord, recrutement, dossiers, entretiens, paramètres, facturation, évaluations et composants partagés. Inventaire détaillé local : `.runtime/ux-audit-inventory.json`. Les constats de code ne valent pas une validation visuelle exhaustive de chaque écran privé.

### 1. Navigation actuelle et décision par destination

| Entreprise : actuel | Classement | Décision |
|---|---|---|
| Tableau de bord | Principal | Conserver en premier |
| Offres | Principal | Conserver, groupe Recrutement |
| Candidatures | Principal | Conserver, intégrer accès liste/pipeline |
| Candidats | Principal | Conserver : recherche transversale différente de la vue par offre |
| Pipeline | Doublon de présentation | Retirer du menu, conserver route et vue contextuelle |
| Entretiens | Principal | Conserver |
| Équipe | Secondaire | Groupe Organisation |
| Analyses | Principal | Conserver ; détail d’offre reste dans l’offre |
| Évaluations | Secondaire | Groupe Organisation |
| Facturation | Configuration | Pied de menu |
| Paramètres | Configuration | Pied de menu |
| Profil | Doublon | Menu du compte |
| Notifications | Doublon | Cloche du header |

| Candidat : actuel | Classement | Décision |
|---|---|---|
| Tableau de bord | Principal | Conserver |
| Rechercher des offres | Principal | Conserver |
| Recommandations | Vue du module offres | Onglet des offres |
| Candidatures | Principal | Conserver |
| Offres enregistrées | Vue du module offres | Onglet des offres |
| Mes CV | Principal | Conserver |
| Créateur CV | Outil du module CV | Onglet des CV |
| Analyse ATS | Outil du module CV | Onglet des CV |
| Coach entretien | Secondaire | Groupe Préparation |
| Candidature automatique | Configuration du parcours | Onglet des candidatures ; activation métier inchangée |
| Alertes offres | Configuration du module offres | Onglet des offres |
| Notifications | Doublon header | Cloche |
| Profil | Secondaire | Groupe Préparation et menu du compte |
| Abonnement | Système | Pied de menu |

Admin actuel : Dashboard, Users, Companies, Verifications, Jobs, Subscriptions, Audit logs, Analytics. Tous correspondent à des responsabilités distinctes ; conserver les destinations, traduire les libellés et séparer supervision, gestion et système.

### 2. Problèmes constatés

- 13 liens entreprise et 14 candidat avec une importance visuelle presque identique ; les actions de compte sont dupliquées.
- Lien Paramètres entreprise du menu utilisateur basé sur la première adhésion, pas sur l’entreprise affichée.
- Tableau de bord entreprise : 12 cartes de statistiques avant les tâches ; mêmes détails que les analyses.
- Recherche entreprise sans raccourci clavier ni actions rapides ; soumission d’un formulaire obligatoire.
- 9 filtres candidats affichés en permanence ; pas de puces de filtres supprimables.
- Pipeline sans surbrillance de cible, sans élévation au déplacement, et sans sélecteur de présentation intégré.
- Navigation mobile cachée intégralement dans un tiroir ; header encombré par les préférences.
- Couleur d’action globale presque noire, mais navigation indigo codée en dur ; contrôles de 28–32 px et tailles de titres hétérogènes.
- Les polices Inter et Noto Sans Arabic sont déjà chargées ; ne pas ajouter une seconde solution de polices.
- Plusieurs effets de chargement historiques coexistent ; réduction de mouvement partielle ; dialogues non adaptés à la hauteur de petits écrans.

### 3. Structure retenue

Entreprise : Tableau de bord ; Recrutement [Offres, Candidatures, Candidats, Entretiens, Analyses] ; Organisation [Équipe, Évaluations] ; pied [Facturation, Paramètres]. Groupes visuels plats, sans sous-menus à ouvrir. Visibilité selon les permissions existantes.

Candidat : Tableau de bord ; Recherche [Offres, Candidatures] ; Préparation [Mes CV, Coach entretien, Profil] ; pied [Abonnement, Paramètres]. Onglets contextuels dans Offres, Candidatures et CV pour conserver tous les outils.

Mobile : trois accès fréquents et bouton Menu en bas ; tiroir pour les autres destinations et préférences de langue/thème. Même filtrage des permissions que le desktop.

### Principes de réalisation

Priorité aux tâches réelles, sans compteurs inventés ni simulation de progression IA. Raccourci Ctrl/Cmd+K, actions contextuelles, palette indigo sobre, surfaces claires/sombres, typographie et espacements communs. Mouvement limité aux transitions courtes et à un fond CSS discret sur l’authentification ; jamais derrière les tableaux. Réduction de mouvement globale. Conservation des API, sessions, permissions et du contexte entreprise.

## Réalisation et vérifications

### 4. Améliorations UX livrées

Le tableau de bord entreprise commence par les actions correspondant aux données de la période choisie : nouvelles candidatures, offres en brouillon et candidatures au stade proposition. Les actions à zéro disparaissent. Trois indicateurs restent visibles ; la distribution du matching est repliable. Les analyses détaillées restent dans Analytique.

Candidatures ouvre désormais la liste de toutes les candidatures de l’entreprise, sans imposer la première offre. Le même écran permet de passer en pipeline. La présentation par offre reste accessible via `applications?view=jobs` ; les routes historiques et les dossiers sont conservés. Les actions du dashboard appliquent leur filtre de statut.

Ctrl/Cmd+K ouvre une recherche. En entreprise : recherche après 250 ms de saisie, résultats dans l’entreprise courante et actions rapides selon les permissions. Pour candidat/admin : accès aux destinations ; les outils candidat déplacés dans les onglets restent recherchables. Échap ferme le dialogue. Le menu du compte pointe vers les paramètres de l’entreprise affichée.

Les filtres candidats avancés sont repliés et les filtres appliqués ont des puces supprimables. La recherche d’offres côté candidat commence par mot-clé et lieu ; les critères détaillés restent sous Filtres. Le dashboard candidat présente le statut du CV avant les indicateurs, désormais plus compacts.

Un entretien peut être ouvert depuis la carte ou le dossier d’une candidature, avec sa présélection. L’action rapide globale ouvre le même formulaire ; la fermeture n’empêche pas sa réouverture. Aucune invitation n’est envoyée avant enregistrement. Les dossiers conservent tous leurs contenus, avec huit onglets principaux et un sélecteur pour les détails professionnels.

### 5. Améliorations UI

Palette indigo commune, surfaces claires et sombres, contrastes de texte renforcés, titres harmonisés et navigation active identifiable. Variables communes de couleur, typographie, rayon, ombre et durée. Inter et Noto Sans Arabic conservées. Le logo bénéficie d’un traitement CSS pour rester lisible en mode sombre.

Les boutons, champs, tables, dialogues et messages partagés utilisent le système commun. Les préférences et actions de compte quittent la zone principale du menu. Le pied de menu reste accessible ; les longues navigations défilent dans leur propre zone.

### 6. Mouvement et retour d’action

Transitions courtes de 140–180 ms, apparition discrète des vues, retour visuel des boutons, carte déplacée atténuée et élevée, cible de dépôt mise en évidence uniquement pour une transition autorisée. Le sélecteur d’étape reste disponible au clavier et sur écran tactile. Les mutations utilisent toujours les endpoints et messages de résultat existants.

Les analyses réellement en attente affichent un indicateur indéterminé et expliquent leurs entrées : CV, profil, exigences du poste. Aucun pourcentage, durée estimée ou étape d’analyse fictifs n’est ajouté.

### 7. Fond animé

Deux gradients radiaux discrets en CSS sur les surfaces d’authentification et d’inscription entreprise. Déplacement lent de 22 secondes, transparence faible, aucune interaction capturée, aucun canvas ni boucle JavaScript. Le fond animé n’est pas ajouté derrière les tableaux de recrutement.

### 8. Mobile

Trois destinations fréquentes et Menu dans une barre inférieure avec prise en compte de la zone sûre. Tiroir contenant les autres destinations, langue et thème. Sélecteur d’entreprise compact. Dialogues en panneau inférieur, hauteur limitée et défilement interne ; correction du décalage lié aux translations CSS. Cibles des boutons/champs de 44 px minimum sur les petits écrans ; texte de champ à 16 px.

Vérification réelle à 390 × 844 : menu, formulaire d’entretien, dashboard en arabe et mode sombre. Le dashboard contrôlé ne déborde pas horizontalement. Le tiroir s’ouvre du côté droit en arabe ; le bouton de fermeture utilise le bord logique opposé au titre.

### 9. Accessibilité

Lien « Aller au contenu », repères de navigation nommés, page active avec `aria-current`, sélecteurs de vue avec `aria-pressed`, libellés pour les actions iconiques, focus visible et fermeture au clavier. Dialogues Radix avec titre/description et gestion du focus. Chargement annoncé, erreurs avec rôle alert, décorations non interactives. EN/FR/AR pour les nouveaux textes ; police et sens RTL pris en charge.

La règle `prefers-reduced-motion: reduce` désactive animations et transitions, y compris les fonds et indicateurs. Vérification du code de cette règle ; pas de simulation du réglage système ni d’audit complet avec lecteur d’écran. Ces contrôles ne constituent pas une certification WCAG.

### 10. Performance

Aucune bibliothèque d’animation supplémentaire. Mouvement CSS, recherche entreprise temporisée, requête de recherche active seulement lorsque le dialogue est ouvert et que la saisie contient au moins deux caractères. Détails et filtres repliés pour alléger la lecture, avec pagination et cache React Query existants conservés. Réutilisation des polices et icônes déjà installées.

La compilation de production et les contrôles HTTP sont les vérifications techniques de livraison. Aucun gain chiffré ni score Lighthouse n’est revendiqué : il n’y a pas de mesure avant/après comparable, ni de test de charge multi-utilisateur.

### 11. Fichiers et composants modifiés

Chemins relatifs à `C:/Users/Yassine/job startup` :

| Groupe | Fichiers |
|---|---|
| Architecture | `web/src/components/layout/app-shell.tsx`, `navigation-search.tsx`, `company-switcher.tsx`, `user-menu.tsx`, `notification-bell.tsx`, `logo.tsx` |
| Navigation par rôle | `web/src/app/(company)/company/[companyId]/layout.tsx`, `web/src/app/(candidate)/layout.tsx`, `web/src/app/(admin)/layout.tsx` |
| Recrutement | `web/src/components/company/recruiter-home.tsx`, `workspace-overview.tsx`, `company-search.tsx`, `workspace-candidates.tsx`, `recruitment-workspace.tsx`, `workspace-interviews.tsx`, `application-dossier.tsx`, `recruitment-assistant.tsx` |
| Parcours candidat | `web/src/components/candidate/career-pages.tsx`, `career-shared.tsx`, `analysis-card.tsx` |
| Design partagé | `web/src/app/globals.css`, `web/src/components/ui/dialog.tsx`, `sheet.tsx`, `web/src/components/shared/index.tsx`, `analysis-processing.tsx` |
| Authentification | `web/src/app/(auth)/layout.tsx`, `web/src/components/company/company-registration.tsx` : présentation uniquement |
| Traductions | `web/src/lib/i18n/ux.ts`, `company.ts`, `recruitment.ts` |
| Vérifications | `recruitment-ux.test.tsx`, `application-navigation.test.tsx`, `navigation.test.tsx`, adaptation du contexte i18n de `guards.test.tsx`, filtre replié dans `career.test.tsx` |
| Exécution locale | `web/package.json`, configuration locale `.env` et `web/.env.local` : interface 3000, API 3002 ; `web/src/config/env.ts` et `env.test.ts` pour conserver le même nom d’hôte entre interface, API et WebSocket sur les alias locaux. Aucun secret reproduit dans ce rapport. |

Aucun endpoint métier, schéma de base, migration, calcul de matching ou règle de permission n’a été réécrit pour cette refonte.

### 12. Vérifications réalisées

- Suite frontend : 106 tests réussis, 15 fichiers. Après les derniers ajustements : 17 tests ciblés réussis (4 fichiers), puis 14 tests réussis (2 fichiers) sur les adresses locales et le client HTTP/renouvellement de session. Ces sous-ensembles se recoupent avec la suite et ne doivent pas être additionnés.
- TypeScript et compilation de production : résultats finaux consignés au bas de ce rapport.
- Tests de navigation : reconnaissance exacte des chemins et entreprise courante ; maintien des vues liées ; toutes les candidatures sans sélection forcée d’une offre ; filtre transmis depuis le dashboard.
- Interactions : raccourci Ctrl+K, actions filtrées par permission, recherche au sein de l’entreprise, suppression d’un filtre, compteurs issus des données, absence de progression IA inventée.
- Contrôle visuel en navigateur avec base et comptes fictifs isolés : dashboard entreprise FR clair, EN sombre, AR RTL sombre mobile ; menu mobile ; formulaire d’entretien et présélection du candidat ; pipeline filtré ; dashboard candidat, onglets CV et recherche d’offres ; accès ATS par Ctrl+K.
- Aucun entretien créé et aucun message de recrutement envoyé pendant la vérification visuelle. Les serveurs de QA sont distincts des données habituelles.

### 13. Points UX restant à traiter

- Les pages héritées contiennent encore des textes anglais et styles locaux. Les nouveaux composants et menus sont traduits ; l’ensemble des contenus métier n’a pas fait l’objet d’une relecture linguistique exhaustive.
- Les tableaux historiques n’ont pas tous de personnalisation des colonnes ou d’actions en masse. Cette refonte ne prétend pas ajouter ces fonctions partout.
- Le pipeline conserve la pagination : les compteurs de colonnes portent sur la page affichée, comme indiqué dans l’interface. Pas de chargement de toutes les candidatures ni de réorganisation optimiste avec rollback.
- La navigation admin bénéficie du système partagé ; tous ses écrans privés n’ont pas été revérifiés visuellement avec chaque rôle.
- Les filtres candidat de recherche d’offres sont repliables et réinitialisables ; les puces de filtres supprimables ont été ajoutées au vivier entreprise, pas encore à tous les formulaires.
- Les sélecteurs natifs de fichiers et de dates suivent la langue du navigateur/système, indépendamment de la langue de l’application.
- Restent un audit complet au lecteur d’écran, un test réel du réglage système de réduction de mouvement, les mesures Lighthouse/Web Vitals et les essais sur appareils physiques.
- La disponibilité du fournisseur IA externe, précédemment limitée par son quota, reste une dépendance séparée de la refonte visuelle.


## Exécution locale demandée

Le site utilise le port **3000** et l’API le port **3002**. Les commandes `npm run dev` et `npm run start` du dossier `web` utilisent désormais 3000. Le service IA reste sur 8000. Les liens frontend de la configuration locale pointent vers 3000.

Les accès `http://localhost:3000` et `http://127.0.0.1:3000` sont pris en charge, avec API et WebSocket conservant le même nom d’hôte afin que les cookies restent sur le même site. La normalisation s’applique uniquement aux adresses HTTP de boucle locale ; les domaines externes et HTTPS restent inchangés.

Le navigateur intégré a affiché un ancien contenu local en cache à `localhost:3000`, alors que les requêtes HTTP directes retournaient bien EasyJob. Le contenu ancien a aussi été observé à l’adresse numérique dans ce navigateur. La vérification visuelle finale sur le port 3000 reste donc limitée par ce cache. Le serveur sert bien le formulaire EasyJob sur les deux adresses (HTTP 200). Les données de l’ancienne application n’ont pas été effacées ; l’accès aux réglages internes est bloqué par la politique du navigateur.

## Résultats finaux de livraison — 10 septembre 2026

Compilation Next.js de production réussie, vérification TypeScript réussie et 48 pages statiques générées. Le serveur de production est lancé sur 127.0.0.1:3000. API sur 3002, worker démarré et service IA local sur 8000.

Les quatre contrôles HTTP (connexion sur localhost et 127.0.0.1, santé API et santé IA) répondent 200. Les résultats mesurés sont dans `.runtime/ux-final-health.json`. Il s’agit de contrôles locaux de disponibilité, pas de mesures Web Vitals.

Journaux de validation : `.runtime/ux-web-tests-final.log` (106 tests), `.runtime/ux-final-interaction-tests.log` (17 tests ciblés finaux), `.runtime/ux-local-port-tests.log` (14 tests client/adresses), `.runtime/ux-web-build.log` (compilation). Les derniers sous-ensembles ont tous réussi.
