# Dashboard Jeux — contexte pour Claude Code

Lanceur de mes applis-jeux, mono-utilisateur. Next.js 16 (App Router, React 19), Supabase, PWA, web-push, déployé sur Vercel.
Le fonctionnement complet (notifications, variables d'environnement) est dans `README.md`.

## Commandes

- `npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit`
- `node --env-file=.env.local scripts/verif-rls.mjs` : vérifie que la clé publique ne peut que lire (non destructif).
- Pas de tests automatiques : après un changement d'UI, vérifier dans le navigateur (build de production en local).

## Supabase partagé

- Le projet Supabase `ubnkuwyqclrjckogldlc` est **partagé** avec mes autres apps (tvtfl, ttfl, ligue1, cdm26, tennis…).
- Les objets de ce projet sont préfixés `dashboard_` (tables `dashboard_games`, `dashboard_done`, `dashboard_push_subscriptions`) et `get_dashboard_` (fonctions). Ne jamais modifier, supprimer ou altérer un objet sans ce préfixe.
- Migrations SQL idempotentes, numérotées, dans `supabase/migrations/` (`create or replace`, `if not exists`, rejouables).

## Sécurité : lecture publique, écriture serveur

- Le navigateur **lit** avec la clé publique (anon) ; la RLS n'autorise que `select` sur `dashboard_games` et `dashboard_done`, rien sur `dashboard_push_subscriptions` (migration `0001_rls_lecture_seule.sql`).
- **Jamais d'écriture Supabase depuis le navigateur.** Toute écriture est une Server Action de `app/actions.ts` (ou une route `/api`) qui appelle `exigerSession()` / `sessionValide()` (`auth/garde.ts`) **puis** valide ses arguments, avant d'écrire avec `supabaseAdmin()` (clé service-role, `server-only`).
- Le proxy (`proxy.ts`) ne suffit pas : une Server Action est un POST vers la page qui l'héberge. La garde dans chaque action est la vraie protection.
- Connexion par mot de passe unique (`APP_PASSWORD`) et cookie `dj_session` signé HMAC-SHA256 (`AUTH_SECRET`), même schéma que Tennis App (`auth/session.ts`, Web Crypto).
- `/api/cron/send-notifications` est exclue du proxy et protégée par l'en-tête `x-cron-secret` (`CRON_SECRET`) ; cron-job.org l'appelle toutes les 5 min.
- Jamais de clé secrète préfixée `NEXT_PUBLIC_`. Ne jamais commiter `.env*` (sauf `.env.example`, sans valeurs).

## RPC `SECURITY DEFINER` (lecture seule)

Quand un badge a besoin de données d'une autre app dont les tables ne sont pas lisibles par `anon`, on **n'ouvre pas les tables** : on appelle une fonction Postgres `SECURITY DEFINER` dédiée, qui ne renvoie que le strict nécessaire.

- Existantes : `get_dashboard_picks_full(p_username)` (CDM26 Picks) et `get_dashboard_fantasy_status(p_display_name)` (CDM26 Fantasy). Elles renvoient du JSON (`{rank, total_points, next_match, match_date, picks_done}` / `{rank, points}`), ou `{error}` si le pseudo est introuvable.
- Leur SQL est copié tel quel depuis Supabase dans `supabase/migrations/0002_rpc_statuts_cdm26.sql` (elles avaient été créées à la main dans l'éditeur SQL ; elles lisent les tables des apps CDM26 : `cdm_*`, `fantasy_standings`). Ne pas les modifier ni les supprimer sans me demander. Une troisième, `get_dashboard_picks_status`, existe encore dans Supabase mais n'est plus utilisée.
- Elles datent d'avant ce modèle : `search_path = 'public'` et volatilité par défaut (pas `stable`). À aligner si on les retouche un jour.
- Pour en créer une nouvelle (toujours dans une migration de ce dépôt) :
  - nom `get_dashboard_<quoi>`, `language sql` ou `plpgsql`, **`stable`**, aucun `insert`/`update`/`delete` ;
  - `security definer set search_path = ''`, donc noms qualifiés (`public.ma_table`) ;
  - renvoie uniquement les champs affichés, jamais une ligne complète ni l'historique ;
  - `revoke all on function … from public;` puis `grant execute on function … to anon, authenticated;` ;
  - c'est le modèle repris par `mes-agents` (`get_ttfl_pick_du_jour`).

## Badges de statut

Un jeu affiche un badge si son `source_type` est renseigné (liste déroulante « Statut dynamique » de `components/GameForm.tsx`).

- Chaîne : `source_type` → `loadStatus()` dans `hooks/useStatuts.ts` → une fonction `lib/status/<source>.ts` qui appelle la RPC → un `GameStatus` (`lib/status/types.ts`) → `components/StatusBadge.tsx`.
- `GameStatus` : `loading` (point clignotant), `ok` (vert), `warn` (orange, action à faire), `error` (affiche « — »).
- Une fonction de statut **ne lève jamais** : toute erreur (réseau, RPC, `{error}`) devient `{ state: 'error' }`. Un badge cassé ne doit jamais casser la page.
- Chargé une seule fois par jeu ; `oublierStatut(id)` force le rechargement (fait automatiquement quand le `source_type` change).
- Mon pseudo dans les apps CDM26 est dans `lib/constants.ts` (`MON_PSEUDO`), nulle part ailleurs.
- Ajouter un badge : une option dans `GameForm`, une fonction dans `lib/status/`, une ligne dans `loadStatus`, et si besoin une RPC (voir ci-dessus).

## Heure : toujours Europe/Paris

- Tout passe par `lib/time.ts` : `maintenant()` (simulable avec `DASHBOARD_FAKE_NOW`, ignorée en production) et `partiesParis()`. Jamais `new Date().getHours()`, ni l'heure du serveur (UTC sur Vercel), ni celle du téléphone.
- Le cron n'envoie qu'**après** l'heure choisie (fenêtre de 15 min). Anti-doublon : 12 h (quotidien), 6 j 12 h (hebdo).
- La coche « Fait » est valable jusqu'au prochain `reset_heure` (`jourDeCycle`).

## Organisation du front

- `app/page.tsx` ne fait qu'assembler : l'état et la logique vivent dans `hooks/` (`useJeux`, `useStatuts`, `useModaleJeu`, `useModaleNotif`, `useGlisserDeposer`), l'affichage dans `components/`.
- Écritures optimistes : `useJeux` met l'écran à jour tout de suite ; si le serveur refuse, `surEchecEcriture` prévient et recharge depuis la base.
- Next 16 : pas de `next lint` (supprimé), `cookies()`/`headers()` sont async, `searchParams` est une Promise, `proxy.ts` remplace `middleware.ts`. Le React Compiler (ESLint) interdit un `setState` synchrone dans un `useEffect`.

## Je suis débutant

- Réponds-moi toujours en français.
- Explique simplement ce que tu fais et pourquoi.
- Demande avant toute suppression de fichier ou modification touchant Supabase en écriture (données, migrations, fonctions).
