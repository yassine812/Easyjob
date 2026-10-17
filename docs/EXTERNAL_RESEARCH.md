# Recherche publique EasyJob

La recherche publique est une couche optionnelle derrière `ExternalResearchService`. Elle est désactivée par défaut : activez `EXTERNAL_RESEARCH_ENABLED=true` et `AGENT_REACH_ENABLED=true` uniquement dans un environnement où le binaire Agent Reach est installé et contrôlé.

Le fournisseur accepte uniquement le contexte d’entreprise, de poste, de technologie et d’entretien. Il ne reçoit aucun identifiant candidat, profil social ou donnée protégée. Les sorties sont normalisées avant d’atteindre l’API : `company_name`, `website`, `summary`, `products`, `technologies`, `public_repositories` et `sources`.

Les sources de la première version sont limitées au web public, aux métadonnées GitHub publiques et aux flux RSS publics. Les URL sont validées contre les schémas http/https, les identifiants intégrés et les hôtes privés afin de réduire les risques SSRF. Les cookies, sessions connectées, tokens et identifiants API restent désactivés.

Les demandes sont asynchrones dans la file BullMQ `external-research`. Le worker dédié peut être lancé avec `npm run start:external-research-worker`; Docker Compose fournit également le service `external-research-worker`. L’interface expose uniquement des libellés orientés utilisateur : « Contexte public », « Recherche publique » et « Contexte indisponible ».

Le cache Prisma utilise des clés déterministes et des TTL configurables : entreprise 7 jours, technologie 14 jours, GitHub 3 jours et RSS 3 heures par défaut. Un timeout de 15 secondes, deux nouvelles tentatives maximum et un coupe-circuit mémoire assurent le repli vers EasyJob quand Agent Reach est désactivé ou indisponible.

Pour contrôler l’installation :

```bash
npm run external-research:doctor
```

La version amont est épinglée dans `THIRD_PARTY_NOTICES.md`.

## Préparation du déploiement

La recherche publique reste désactivée tant que l’environnement n’est pas prêt. Le cœur d’EasyJob démarre et reste utilisable dans les deux modes :

```env
EXTERNAL_RESEARCH_ENABLED=false
AGENT_REACH_ENABLED=false
REA_ENABLED=false
```

Pour l’activer dans un environnement contrôlé :

```env
EXTERNAL_RESEARCH_ENABLED=true
AGENT_REACH_ENABLED=true
AGENT_REACH_COMMAND=/opt/easyjob/bin/agent-reach
REA_ENABLED=true
REA_COMMAND=/opt/easyjob/bin/rea
REA_BROWSER_EXECUTABLE=/usr/bin/chromium
```

Quand REA est activé, Agent Reach conserve la collecte du contexte public (site,
GitHub et RSS), puis le même worker demande à REA une observation contrôlée de
l’URL publique déjà validée. Le résultat REA est ajouté comme source
`rea-browser` et reste soumis aux mêmes limites de cache, de délai et de
coupe-circuit. REA doit rester installé dans le worker protégé ; il ne doit pas
être exposé comme un endpoint public et aucune donnée d’identification n’est
transmise au navigateur automatisé.

Checklist de mise en service :

- [ ] Agent Reach 1.5.0 installé dans un chemin maîtrisé et sa version vérifiée
- [ ] Chemin du binaire configuré avec `AGENT_REACH_COMMAND`
- [ ] Si l’enrichissement est souhaité, REA installé dans un chemin maîtrisé et `REA_COMMAND` configuré
- [ ] Si l’enrichissement est souhaité, `REA_BROWSER_EXECUTABLE` pointe vers Chrome/Chromium et `REA_ENABLED=true`
- [ ] Redis disponible pour l’API et le worker
- [ ] `EXTERNAL_RESEARCH_ENABLED=true` et `AGENT_REACH_ENABLED=true`
- [ ] Worker lancé avec `npm run start:external-research-worker`
- [ ] `npm run external-research:doctor` réussit
- [ ] Test fournisseur réel exécuté sur une entreprise publique
- [ ] Tests SSRF et normalisation passés

L’endpoint `GET /api/v1/health` expose l’état `external_research`. Il indique `disabled` lorsque les flags sont désactivés, `healthy` lorsque Redis, le heartbeat du worker et le binaire sont disponibles, et `degraded` lorsqu’un de ces éléments manque. Dans ce dernier cas l’application principale continue de démarrer et les suggestions internes EasyJob restent disponibles.

Les métriques opérationnelles à surveiller sont le nombre de demandes en attente, terminées et échouées, la durée moyenne et le taux de lecture du cache. Les journaux ne doivent jamais contenir de contenu sensible, de cookies, de tokens ou de données candidat.
