-- =====================================================================
-- Historique des ouvertures (stats d'usage par jeu)
--
-- `dashboard_games.dernier_ouvert` ne garde que la DERNIÈRE ouverture :
-- impossible d'en tirer un nombre ou une fréquence. Cette table garde une
-- ligne par ouverture (écrite par la Server Action marquerOuvert).
--
-- Même régime que les autres tables : lecture publique (clé anon),
-- écriture réservée à la service-role.
--
-- Idempotent : rejouable sans risque.
-- =====================================================================

create table if not exists public.dashboard_ouvertures (
  id         bigint generated always as identity primary key,
  game_id    uuid not null references public.dashboard_games(id) on delete cascade,
  opened_at  timestamptz not null default now()
);

create index if not exists dashboard_ouvertures_game_opened_idx
  on public.dashboard_ouvertures (game_id, opened_at desc);

alter table public.dashboard_ouvertures enable row level security;

drop policy if exists dashboard_ouvertures_lecture on public.dashboard_ouvertures;
create policy dashboard_ouvertures_lecture on public.dashboard_ouvertures
  for select to anon, authenticated using (true);

revoke all on table public.dashboard_ouvertures from anon, authenticated;
grant select on table public.dashboard_ouvertures to anon, authenticated;

-- Point de départ : la dernière ouverture connue de chaque jeu (réelle),
-- seulement pour un jeu qui n'a encore aucune ligne.
insert into public.dashboard_ouvertures (game_id, opened_at)
select g.id, g.dernier_ouvert
from public.dashboard_games g
where g.dernier_ouvert is not null
  and not exists (select 1 from public.dashboard_ouvertures o where o.game_id = g.id);

-- Vérification — attendu : une policy SELECT, et SELECT seul pour anon.
select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'dashboard_ouvertures';
