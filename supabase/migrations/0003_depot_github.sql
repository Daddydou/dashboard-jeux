-- =====================================================================
-- Dépôt GitHub d'un jeu (panneau « Santé du portfolio »)
--
-- Colonne facultative `depot` au format « propriétaire/dépôt »
-- (ex. Daddydou/tvtfl). Vide pour les sites externes (Chess, MPG…).
-- Le serveur s'en sert pour lire, via l'API GitHub, la version de Next.js,
-- la date du dernier push et la présence de CLAUDE.md / README.md.
--
-- Lecture : couverte par le `grant select` existant (0001). Écriture :
-- service-role uniquement, comme le reste de la table.
--
-- Idempotent : rejouable sans risque.
-- =====================================================================

alter table public.dashboard_games add column if not exists depot text;

comment on column public.dashboard_games.depot is
  'Dépôt GitHub « propriétaire/dépôt » du jeu, pour le panneau Santé du portfolio. Null pour un site externe.';
