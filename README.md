# 🎲 Dashboard jeux

Lanceur personnel de mes applis-jeux (fantasy, pronostics, échecs, tennis…).
Une page, une carte par jeu, rangées par catégorie :

- **lien direct** vers le jeu, avec la date de dernière ouverture ;
- **coche « Fait »** qui se réinitialise toute seule chaque jour à une heure
  choisie par jeu ;
- **notes / mémo** par jeu (room code, identifiant, phase…) ;
- **statut dynamique** pour certains jeux (classement et picks à faire sur
  CDM26 Picks / CDM26 Fantasy) ;
- **rappels par notification push**, à heure fixe, quotidiens ou hebdo ;
- réorganisation des cartes par **glisser-déposer**.

Outil mono-utilisateur, protégé par un mot de passe unique. Installable sur
téléphone (PWA).

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**, TypeScript, Tailwind CSS
- **Supabase** (Postgres) pour les données
- **PWA** : `public/manifest.json` + service worker `public/sw.js` (réception des push)
- **web-push** (clés VAPID) pour envoyer les notifications
- Déploiement sur **Vercel** ; déclenchement des notifications par **cron-job.org**

## Organisation du code

| Chemin | Rôle |
|---|---|
| `app/page.tsx` | Page principale : assemble hooks et composants (ni requête ni écriture) |
| `hooks/useJeux.ts` | Jeux et coches « Fait » : lecture Supabase, écritures optimistes, rechargement si refus |
| `hooks/useStatuts.ts` | Statuts dynamiques (CDM26), chargés une fois par jeu |
| `hooks/useModaleJeu.ts`, `useModaleNotif.ts` | État et enregistrement des deux modales |
| `hooks/useGlisserDeposer.ts` | Réorganisation des cartes par glisser-déposer |
| `components/` | `Entete`, `GameCard`, `GameForm`, `NotifModal`, `StatusBadge`, `PushButton` |
| `lib/categories.ts` | Regroupement et tri des jeux par catégorie |
| `app/actions.ts` | Server Actions : toutes les écritures Supabase |
| `app/login/` | Page et actions de connexion / déconnexion |
| `auth/` | Cookie de session signé (`session.ts`) et garde serveur (`garde.ts`) |
| `proxy.ts` | Redirige vers `/login` sans session (ex-`middleware.ts`) |
| `app/api/push/subscribe` | Enregistre l'abonnement push d'un appareil |
| `app/api/cron/send-notifications` | Envoie les notifications dues (voir plus bas) |
| `lib/status/` | Statuts dynamiques CDM26 |
| `lib/constants.ts` | Constantes partagées (pseudo CDM26) |
| `lib/time.ts` | Heure de Paris : `maintenant()` (simulable) et `partiesParis()`, pour le cron comme pour la page |
| `supabase/migrations/` | Politiques RLS (lecture seule pour la clé publique) |

### Sécurité, en bref

- Le navigateur **lit** Supabase avec la clé publique (anon), mais **n'écrit
  jamais** : la RLS le lui interdit.
- Toutes les écritures passent par des Server Actions qui vérifient la session
  (`sessionValide()`) puis utilisent la clé service-role côté serveur.
- `node --env-file=.env.local scripts/verif-rls.mjs` vérifie que la clé
  publique ne peut que lire (script non destructif).

## Fonctionnement

### Une carte = un jeu

- **Clic sur la carte** : ouvre le jeu dans un nouvel onglet et enregistre
  la date d'ouverture (« il y a 2 h »).
- **Coche « Fait »** : je coche quand j'ai joué. Si le jeu a une *heure de
  reset* (ex. 06:00), la coche se décoche toute seule chaque jour à cette
  heure-là, **heure de Paris**. Sans heure de reset, elle reste cochée.
- **Notes** : un mémo libre par jeu (room code, identifiant…), dépliable.
- **Glisser-déposer** : réordonne les cartes à l'intérieur d'une catégorie.
- Les catégories sont triées par ordre alphabétique ; un jeu sans catégorie
  va dans « Autres », toujours en dernier.

Chaque action met l'écran à jour tout de suite, puis l'enregistre côté
serveur. Si le serveur refuse (session expirée…), une alerte prévient et
les données sont rechargées depuis la base.

### Badges de statut

Certains jeux affichent un badge calculé en direct depuis l'app du jeu. On
le choisit dans « Statut dynamique » en éditant la carte :

| Statut dynamique | Affiche | Source (fonction Supabase) |
|---|---|---|
| CDM26 Picks | classement et points, puis ✅ À jour / ⚠️ Picks à faire / ✅ Aucun match | `get_dashboard_picks_full` |
| CDM26 Fantasy | classement et points | `get_dashboard_fantasy_status` |

Les tables des apps CDM26 ne sont pas lisibles avec la clé publique. Le
dashboard appelle donc des **fonctions `SECURITY DEFINER` en lecture
seule**, qui ne renvoient que ces quelques chiffres pour mon pseudo
(`lib/constants.ts`). En cas de problème, le badge affiche « — » sans
bloquer le reste de la page.

Ajouter un badge : voir la section « Badges de statut » de `CLAUDE.md`.

### Ce qui vit en dehors de ce dépôt

- **Supabase** (projet partagé avec mes autres apps) : les tables
  `dashboard_*`, et les deux fonctions `get_dashboard_*` ci-dessus, créées
  directement dans Supabase (leur SQL n'est dans aucun dépôt).
- **cron-job.org** : l'appel toutes les 5 minutes qui déclenche les
  notifications (voir plus bas). Sans lui, aucune notification ne part.
- **Vercel** : l'hébergement et les variables d'environnement de production.

## Variables d'environnement

À mettre dans `.env.local` en local, et dans les réglages du projet sur Vercel.
Modèle commenté : `.env.example`.

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase (lecture seule) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur Supabase, **secrète**, pour les écritures |
| `APP_PASSWORD` | Mot de passe d'accès à l'app (obligatoire) |
| `AUTH_SECRET` | Clé de signature du cookie de session (recommandée) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé VAPID publique (abonnement push) |
| `VAPID_PRIVATE_KEY` | Clé VAPID privée (envoi des push), **secrète** |
| `VAPID_SUBJECT` | Contact VAPID, ex. `mailto:…` |
| `CRON_SECRET` | Secret attendu dans l'en-tête `x-cron-secret` de la route cron |
| `DASHBOARD_FAKE_NOW` | Facultatif, local uniquement : date simulée pour tester les notifications (ignorée en production) |

> ⚠ Dans `.env.local`, Next remplace `$quelquechose` par une variable (vide).
> Une valeur qui commence par `$` (ex. un mot de passe) est donc lue vide en
> local. Choisir des valeurs sans `$`. Sur Vercel, pas ce problème.

Clés VAPID : `npx web-push generate-vapid-keys`.

## Commandes

Node.js ≥ 20.9 requis.

```bash
npm install
npm run dev      # serveur de développement sur http://localhost:3000
npm run build    # build de production
npm run start    # lance le build de production
npm run lint     # ESLint (next lint n'existe plus en Next 16)
npx tsc --noEmit # vérification des types
```

## Notifications push

1. **Abonnement** : sur un appareil, le bouton « 🔔 Notifs » de l'en-tête
   demande l'autorisation, puis envoie l'abonnement à `/api/push/subscribe`,
   qui le stocke dans `dashboard_push_subscriptions`.
2. **Réglage par jeu** : le bouton 🔔 d'une carte règle l'heure d'envoi, la
   fréquence (quotidien / hebdo) et une période de début / fin facultative.
3. **Envoi** : cron-job.org appelle toutes les 5 minutes
   `GET /api/cron/send-notifications` avec l'en-tête
   `x-cron-secret: <CRON_SECRET>`. Sans le bon secret, la route répond 401.
   Elle est exclue du proxy (pas besoin de session). À chaque appel, la route :
   - calcule l'heure **à Paris** via `lib/time.ts` (le serveur Vercel tourne
     en UTC) ;
   - garde les jeux dont les notifications sont actives, dans leur période,
     et dont l'heure d'envoi est passée depuis **moins de 15 minutes** :
     jamais d'envoi en avance, et un appel du cron en retard envoie quand
     même (un rappel de 23:58 part bien à 00:03) ;
   - saute un jeu déjà notifié depuis moins de 12 h (quotidien) ou 6 j 12 h
     (hebdo) : deux appels rapprochés n'envoient donc pas deux fois, et un
     rappel hebdo revient tous les 7 jours, le même jour que le premier
     envoi ;
   - envoie la notification à tous les appareils abonnés, et supprime ceux
     qui n'existent plus (réponse 404 / 410) ;
   - répond `{"sent": <nombre de notifications envoyées>}`.
4. **Réception** : `public/sw.js` affiche la notification ; un clic ouvre le
   jeu (ou remet son onglet au premier plan).

Tester à la main (en local ou en production) :

```bash
curl -H "x-cron-secret: <CRON_SECRET>" https://<domaine>/api/cron/send-notifications
```
