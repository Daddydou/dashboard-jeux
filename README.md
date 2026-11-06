# Mes jeux

Mes jeux sur un seul écran, pensé pour le téléphone : ce qui m'attend ce
soir sur mes jeux principaux, et un raccourci vers tous les autres.
Mono-utilisateur, protégé par un mot de passe, installable (PWA).

## L'accueil

Les jeux **à la une** ont une grande carte, peinte dans la matière de leur
terrain, avec leur statut en direct. Un appui ouvre directement le bon écran.

| Jeu | Ce que montre la carte | D'où vient l'info |
|---|---|---|
| Pick + Bracket | Tournoi et tour ouverts, mes picks posés (ex. 2/2), heure de verrou, classement | API Game Tracker (lecture seule, clé `GAMETRACKER_PICKS_KEY`) |
| Opti-Pick | Tour en cours de chaque tournoi, picks préparés dans mon plan ; ouvre l'écran Picks du bon tournoi | Tables `tn_*` de l'app tennis |
| TTFL Pick | Soirée du jour (date de New York) : pick réel du compte 01, sa projection, l'heure du match et sa saisie sur le site ; pour les autres comptes, seulement si un pick est présent ; pronos vainqueurs de la prochaine soirée posés chez Thomas (et s'ils diffèrent de ton choix) ; dernier score du compte 01 | Tables `ttfl_*` (moteur, robot, vainqueurs) |

Pastille en haut à droite : **À faire** (jaune balle), **Urgent** (rouge :
moins de 2 h, ou un échec du robot), **À jour**. La phrase du haut compte ce
qui m'attend.

Les autres jeux (Chess, MPP, Zip, Hub Laki…) sont en tuiles : un appui ouvre
le site.

## Les réglages

- **Mes jeux** : ordre (flèches), fiche d'un jeu (nom, adresse, icône,
  couleur, « à la une », note, rappel), ajout, retrait (le jeu est seulement
  désactivé en base, rien n'est effacé).
- **Rappels** : activer les notifications sur l'appareil ; un rappel par jeu,
  à heure fixe, chaque jour ou chaque semaine, avec dates de début et de fin.
- **Statuts en direct** : ce que chaque carte sait lire, et si la clé Game
  Tracker manque.

## Code

| Chemin | Rôle |
|---|---|
| `app/page.tsx` | Accueil |
| `app/reglages/page.tsx` | Réglages |
| `lib/live/` | Statut en direct de chaque jeu à la une (un fichier par source) |
| `components/CarteUne.tsx`, `Terrain.tsx`, `Tuile.tsx` | Cartes de l'accueil |
| `components/ListeJeux.tsx`, `FeuilleJeu.tsx`, `BoutonPush.tsx` | Réglages |
| `actions/` | Server Actions (toutes les écritures) et leur validation |
| `auth/`, `proxy.ts` | Mot de passe, cookie signé, gardes |
| `app/api/push/subscribe`, `app/api/cron/send-notifications` | Abonnement push et envoi des rappels |
| `lib/time.ts`, `lib/relatif.ts` | Heure de Paris et dates en français |
| `public/sw.js` | Service worker : push + mode hors connexion |

## Variables d'environnement

Modèle commenté : `.env.example`. Sur Vercel : Settings → Environment Variables.

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase, lecture |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** : écritures, et lecture des tables TTFL |
| `APP_PASSWORD`, `AUTH_SECRET` | Connexion |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notifications push |
| `CRON_SECRET` | Protège la route cron |
| `GAMETRACKER_PICKS_KEY` | **Secret**, facultatif : statut détaillé de Pick + Bracket |
| `DASHBOARD_FAKE_NOW` | Local uniquement : heure simulée pour tester les rappels |

## Rappels push

cron-job.org appelle toutes les 5 minutes `GET /api/cron/send-notifications`
avec l'en-tête `x-cron-secret`. La route envoie les rappels dont l'heure
(Paris) est passée depuis moins de 15 minutes, une seule fois par jour (ou
par semaine), à tous les appareils abonnés.

```bash
curl -H "x-cron-secret: <CRON_SECRET>" https://dashboard-jeux.vercel.app/api/cron/send-notifications
```

## Commandes

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit
```
