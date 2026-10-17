# Offres locales de test

À la demande de l’utilisateur, 12 offres fictives de **EasyJob Test Lab** sont disponibles dans l’environnement local. Chaque titre porte « TEST », chaque description précise qu’il n’y a aucune embauche réelle. Les salaires de scénario sont de 1 800 à 2 800 TND par mois.

Activation : `EASYJOB_LOCAL_TEST_JOBS=true` dans `.env`, puis redémarrage de l’API et des workers. Ce réglage est ignoré en production. Il permet uniquement les offres marquées `OFFRE DE TEST` de l’entreprise `easyjob-test-lab` ; les anciennes annonces externes restent exclues.

Initialisation idempotente : `npm run demo:offers`. Cette commande exige le mode local activé et le compte administrateur de démonstration déjà présent.

Le parcours conserve le CV choisi, les questions obligatoires, le consentement et le suivi réel dans la base locale. Aucun e-mail de nouvelle candidature n’est envoyé au recruteur pour ces offres. Les scores sont calculés à partir du profil et du CV ; les limites Free/Premium restent appliquées. Le nombre d’offres visible dépend donc du profil et du plan.

Désactivation : remettre `EASYJOB_LOCAL_TEST_JOBS=false` et redémarrer. Les offres et candidatures de test restent stockées pour l’historique, sans apparaître dans la recherche.
