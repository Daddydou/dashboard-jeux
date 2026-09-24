-- =====================================================================
-- RPC DES BADGES DE STATUT CDM26 — SECURITY DEFINER, LECTURE SEULE
--
-- Copie fidèle des fonctions telles qu'elles existent dans Supabase au
-- 24/09/2026 (relevées avec pg_get_functiondef). Elles avaient été créées
-- directement dans l'éditeur SQL : ce fichier permet de les recréer à
-- l'identique. Le rejouer ne change rien (create or replace, même corps).
--
-- Pourquoi SECURITY DEFINER : les tables des apps CDM26 (cdm_*,
-- fantasy_standings) ne sont pas lisibles avec la clé publique. Plutôt que
-- de les ouvrir, ces fonctions tournent avec les droits de leur
-- propriétaire et ne renvoient que quelques chiffres pour un pseudo donné
-- (classement, points, prochain match, picks faits ou non). Aucune écriture.
--
-- Appelées par le navigateur avec la clé publique :
--   get_dashboard_picks_full      → lib/status/cdm26Picks.ts
--   get_dashboard_fantasy_status  → lib/status/cdm26Fantasy.ts
--   get_dashboard_picks_status    → PLUS UTILISÉE (remplacée par
--                                   get_dashboard_picks_full, commit 4bfc7bc)
--
-- Droits : non modifiés ici. À la création, Postgres donne EXECUTE à
-- PUBLIC, ce qui suffit à la clé publique (anon).
-- =====================================================================

-- ---------------------------------------------------------------------
-- CDM26 Fantasy : rang et points dans la ligue du participant.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_fantasy_status(p_display_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_participant_id uuid;
  v_league_id      uuid;
  v_total_points   numeric;
  v_rank           bigint;
BEGIN
  SELECT
    fs.participant_id,
    fs.league_id,
    fs.total_points
  INTO v_participant_id, v_league_id, v_total_points
  FROM fantasy_standings fs
  WHERE fs.display_name = p_display_name
  ORDER BY fs.total_points DESC
  LIMIT 1;

  IF v_participant_id IS NULL THEN
    RETURN json_build_object('error', 'participant_not_found');
  END IF;

  SELECT COUNT(*) + 1 INTO v_rank
  FROM fantasy_standings other
  WHERE other.league_id    = v_league_id
    AND other.total_points > v_total_points;

  RETURN json_build_object(
    'rank',   v_rank,
    'points', round(v_total_points, 1)
  );
END;
$function$;

-- ---------------------------------------------------------------------
-- CDM26 Picks : rang, points, prochain match et picks faits ou non.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_picks_full(p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id       uuid;
  v_total_points  numeric;
  v_rank          bigint;
  v_match_id      uuid;
  v_kickoff_at    timestamptz;
  v_name_a        text;
  v_name_b        text;
  v_picks_done    boolean;
BEGIN
  SELECT id, total_points
    INTO v_user_id, v_total_points
    FROM cdm_users
   WHERE username = p_username;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  SELECT COUNT(*) + 1
    INTO v_rank
    FROM cdm_users
   WHERE total_points > COALESCE(v_total_points, 0);

  SELECT m.id, m.kickoff_at, na.name, nb.name
    INTO v_match_id, v_kickoff_at, v_name_a, v_name_b
    FROM cdm_matches m
    JOIN cdm_nations na ON na.id = m.nation_a_id
    JOIN cdm_nations nb ON nb.id = m.nation_b_id
   WHERE m.status = 'a_venir'
     AND m.kickoff_at > now()
   ORDER BY m.kickoff_at ASC
   LIMIT 1;

  IF v_match_id IS NULL THEN
    RETURN jsonb_build_object(
      'next_match',   NULL,
      'match_date',   NULL,
      'picks_done',   NULL,
      'rank',         v_rank,
      'total_points', COALESCE(v_total_points, 0)
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM cdm_picks
     WHERE match_id = v_match_id
       AND user_id  = v_user_id
  ) INTO v_picks_done;

  RETURN jsonb_build_object(
    'next_match',   v_name_a || ' vs ' || v_name_b,
    'match_date',   v_kickoff_at,
    'picks_done',   v_picks_done,
    'rank',         v_rank,
    'total_points', COALESCE(v_total_points, 0)
  );
END;
$function$;

-- ---------------------------------------------------------------------
-- ⚠ PLUS UTILISÉE par le dashboard (ni par aucun de mes dépôts).
-- Conservée ici parce qu'elle existe encore dans Supabase.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_picks_status(p_username text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id    uuid;
  v_match_id   uuid;
  v_nation_a   text;
  v_nation_b   text;
  v_kickoff    timestamptz;
  v_picks_done boolean;
BEGIN
  SELECT id INTO v_user_id
  FROM cdm_users
  WHERE username = p_username
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'user_not_found');
  END IF;

  SELECT
    m.id,
    na.name,
    nb.name,
    m.kickoff_at
  INTO v_match_id, v_nation_a, v_nation_b, v_kickoff
  FROM cdm_matches m
  JOIN cdm_nations na ON na.id = m.nation_a_id
  JOIN cdm_nations nb ON nb.id = m.nation_b_id
  WHERE m.status = 'a_venir'
    AND m.kickoff_at > now()
  ORDER BY m.kickoff_at ASC
  LIMIT 1;

  IF v_match_id IS NULL THEN
    RETURN json_build_object(
      'next_match', null,
      'match_date', null,
      'picks_done', null
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM cdm_picks
    WHERE user_id  = v_user_id
      AND match_id = v_match_id
  ) INTO v_picks_done;

  RETURN json_build_object(
    'next_match', v_nation_a || ' vs ' || v_nation_b,
    'match_date', v_kickoff,
    'picks_done', v_picks_done
  );
END;
$function$;

-- ---------------------------------------------------------------------
-- Vérification — attendu : security_definer = true pour les trois.
-- ---------------------------------------------------------------------
select p.proname, p.prosecdef as security_definer, p.provolatile as volatilite
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'get\_dashboard\_%'
order by p.proname;
