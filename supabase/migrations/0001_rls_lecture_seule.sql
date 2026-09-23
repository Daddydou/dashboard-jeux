-- =====================================================================
-- RLS — LECTURE PUBLIQUE, ÉCRITURES RÉSERVÉES À LA SERVICE ROLE
--
-- Depuis l'ajout du mot de passe (middleware + Server Actions), toutes les
-- écritures passent par le serveur avec SUPABASE_SERVICE_ROLE_KEY, qui
-- contourne la RLS. La clé publique (anon), inlinée dans le bundle
-- navigateur, ne sert plus qu'à LIRE dashboard_games et dashboard_done.
--
-- dashboard_push_subscriptions : AUCUN accès public, même en lecture (les
-- endpoints push sont propres à l'appareil). Seul le serveur y touche
-- (/api/push/subscribe après session, /api/cron après CRON_SECRET).
--
-- À exécuter APRÈS le déploiement du code qui utilise la service role,
-- sinon les écritures de l'ancienne version échouent.
--
-- Idempotent : rejouable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RLS active, toutes les policies existantes supprimées (leurs noms
--    ne sont pas connus : on les énumère), puis lecture seule publique.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['dashboard_games','dashboard_done','dashboard_push_subscriptions']
  loop
    execute format('alter table public.%I enable row level security', t);

    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;

  foreach t in array array['dashboard_games','dashboard_done']
  loop
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_lecture', t);
  end loop;
  -- dashboard_push_subscriptions : RLS active sans aucune policy = rien.
end $$;

-- ---------------------------------------------------------------------
-- 2. Privilèges table (ceinture + bretelles : même sans policy
--    d'écriture, on retire le droit SQL sous-jacent). `service_role`
--    n'est pas touché.
-- ---------------------------------------------------------------------
revoke all on table
  public.dashboard_games, public.dashboard_done, public.dashboard_push_subscriptions
  from anon, authenticated;

grant select on table
  public.dashboard_games, public.dashboard_done
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Vérification — à relire après exécution.
-- ---------------------------------------------------------------------

-- Attendu : une seule policy SELECT par table lue, aucune sur
-- dashboard_push_subscriptions.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename like 'dashboard\_%'
order by tablename;

-- Attendu : uniquement SELECT pour anon / authenticated.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as droits
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'dashboard\_%'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- Les RPC appelées avec la clé publique (statuts CDM26) : si l'une est
-- SECURITY DEFINER (prosecdef = true), elle contourne la RLS — vérifier
-- qu'elle ne fait que lire.
select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_dashboard_fantasy_status', 'get_dashboard_picks_full');
