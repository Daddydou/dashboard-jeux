# Dashboard Jeux — contexte pour Claude Code

Mes jeux sur un seul écran, pensé téléphone d'abord. Next.js 16 (App Router, React 19), Tailwind 3, Supabase, PWA, web-push, Vercel (déploiement automatique à chaque push sur `main`).
Version 3 (novembre 2026), réécrite de zéro. Fonctionnement détaillé : `README.md`.

## Commandes

- `npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit`
- `node --env-file=.env.local scripts/verif-rls.mjs` : vérifie que la clé publique ne peut que lire.
- Après un changement d'UI : lancer `npm run dev` et regarder en largeur téléphone (375 px) et ordinateur. En `next start` local la connexion échoue : le cookie est `secure` en production.

## Écrans

- `/` Accueil : les jeux « à la une » (ceux qui ont un `source_type`) en grandes cartes avec leur statut en direct, puis les autres jeux en tuiles. Rafraîchi toutes les 60 s (`AutoRefresh`).
- `/reglages` : ordre des jeux, fiche d'un jeu (`FeuilleJeu`), rappels push, statut des sources, déconnexion.
- Chaque page appelle `pageProtegee()` ; une lecture de `dashboard_games` qui échoue lève (`lib/donnees.ts`) → `app/error.tsx`.

## Cartes « à la une » (`lib/live/`)

- Contrat : `Live` dans `lib/live/types.ts` (ton, contexte, titre, chiffre, lignes, échéance, lien). Textes prêts à afficher, calculés côté serveur avec un `now` passé en argument.
- Sources (`SOURCES`) : `gametracker` (Pick + Bracket), `optipick` (Opti-Pick, app tennis), `ttfl` (TTFL Pick). `chargerLive()` les lit en parallèle avec 7 s de délai ; une panne devient une note, jamais une exception.
- `gametracker.ts` : API Game Tracker en **GET uniquement**, clé `GAMETRACKER_PICKS_KEY` (secrète, jamais affichée ni journalisée), cache 60 s. Sans clé : repli sur `tn_bracket_externe_tournois`.
- `optipick.ts` : tables `tn_*` (lecture publique, clé anon). Mes picks = `tn_picks` sans `participant_id`.
- `ttfl.ts` : tables `ttfl_*` privées, **lues** avec la clé service-role côté serveur (colonnes minimales, aucune écriture). Soirée = date de New York. Compte 01 : `ttfl_picks` (pick réel) + `ttfl_projections` du dernier `ttfl_runs` de la soirée + `ttfl_envois` (saisie). Autres comptes : un envoi `confirme` = pick présent. Vainqueurs : `ttfl_vainqueurs_kt.cote` non nul = prono posé chez Thomas, comparé à `ttfl_vainqueurs_choix`.
- Matière des cartes : dur bleu (Game Tracker), gazon (Opti-Pick), parquet (TTFL), dans `components/CarteUne.tsx` et `components/Terrain.tsx`.

## Supabase partagé

- Projet `ubnkuwyqclrjckogldlc` **partagé** avec mes autres apps. Ce dashboard n'écrit que dans les objets préfixés `dashboard_` ; il lit `tn_*` et `ttfl_*` sans jamais y écrire.
- Migrations SQL idempotentes et numérotées dans `supabase/migrations/`. Me montrer le SQL avant de l'appliquer.
- Retirer un jeu = `actif = false` (rien n'est effacé).

## Sécurité

- Le navigateur n'écrit jamais dans Supabase. Toute écriture est une Server Action de `actions/jeux.ts` : `exigerSession()`, puis validation (`actions/validation.ts`), puis `supabaseAdmin()`. Une action renvoie `{ ok, erreur }`, elle ne lève pas.
- Le proxy (`proxy.ts`) ne fait que rediriger : la garde dans chaque action et chaque page est la vraie protection.
- Mot de passe unique (`APP_PASSWORD`) + cookie `dj_session` signé HMAC-SHA256 (`AUTH_SECRET`).
- `/api/cron/send-notifications` : exclue du proxy, protégée par `x-cron-secret` (`CRON_SECRET`), appelée toutes les 5 min par cron-job.org.
- Jamais de secret préfixé `NEXT_PUBLIC_`. Jamais commiter `.env*` (sauf `.env.example`).

## Heure : toujours Europe/Paris

- Tout passe par `lib/time.ts` (`maintenant()`, `partiesParis()`) et `lib/relatif.ts`. Jamais l'heure du serveur (UTC) ni celle du téléphone.

## Front

- Pages = composants serveur. Composants clients seulement pour l'interaction : `ListeJeux`, `FeuilleJeu`, `BoutonPush`, `AutoRefresh`, `EnregistrerSW`.
- Next 16 : `proxy.ts`, `cookies()` async, `searchParams` Promise, pas de `next lint`. React Compiler (ESLint) : pas de `setState` synchrone dans un `useEffect`, pas d'appel impur dans le rendu.
- Polices : Barlow et Barlow Condensed (`next/font/google`). Couleurs dans `tailwind.config.ts`.

## Je suis débutant

- Réponds-moi toujours en français.
- Explique simplement ce que tu fais et pourquoi.
- Demande avant toute suppression de fichier ou modification touchant Supabase en écriture (données, migrations, fonctions).
