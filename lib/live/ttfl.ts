import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { echeanceCourte, horloge, nombreFr, presse } from '@/lib/relatif'
import type { Ligne, ResultatLive, Ton } from './types'

/**
 * TTFL : la soirée NBA en cours, vue depuis mes comptes.
 *
 * - Compte 01 : son pick réel (ttfl_picks), sa projection, l'heure du match
 *   et la saisie du robot sur le site (ttfl_envois).
 * - Les autres comptes : seulement « un pick est-il bien présent ? ».
 * - Vainqueurs (jeu de Thomas) : sur la prochaine soirée, combien de matchs
 *   ont un prono enregistré chez Thomas (ttfl_vainqueurs_kt, relu par le PC),
 *   et s'il diffère du choix fait dans l'app TTFL.
 *
 * Les tables ttfl_* sont privées (RLS « propriétaire ») : on les LIT avec la
 * clé service-role, côté serveur uniquement. Aucune écriture ici.
 */

const COMPTE_PRINCIPAL = '01'
const MODE = 'regular'

type Pick = { compte: string; player: string; score: number | null; pick_date: string }
type Envoi = { compte: string; statut: string }
type Match = { event_id: string; game_date: string; abbr_dom: string; abbr_ext: string; commence_time: string }
type Projection = { player: string; team: string; opponent: string; projection: number | null }

const formatNY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
const formatSoiree = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' })
const formatSoireeCourte = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' })

/** La soirée NBA porte la date de New York (comme dans l'app TTFL). */
function soireeDe(now: Date): string {
  return formatNY.format(now)
}

function decaler(date: string, jours: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

const jourLisible = (date: string, court = false) =>
  (court ? formatSoireeCourte : formatSoiree).format(new Date(`${date}T12:00:00Z`))

/** Le plus pressé de deux tons. */
function pire(a: Ton, b: Ton): Ton {
  const rang: Record<Ton, number> = { urgent: 0, afaire: 1, ok: 2, calme: 3 }
  return rang[a] <= rang[b] ? a : b
}

export async function chargerTtfl(now: Date, lien: string): Promise<ResultatLive> {
  const db = supabaseAdmin()
  const soiree = soireeDe(now)

  const [picksRes, envoisRes, matchsRes, comptesRes, hierRes, runRes] = await Promise.all([
    db.from('ttfl_picks').select('compte, player, score, pick_date').eq('mode', MODE).eq('pick_date', soiree),
    db.from('ttfl_envois').select('compte, statut').eq('mode', MODE).eq('pick_date', soiree),
    db
      .from('ttfl_vainqueurs_matchs')
      .select('event_id, game_date, abbr_dom, abbr_ext, commence_time')
      .gte('game_date', soiree)
      .lte('game_date', decaler(soiree, 3))
      .order('commence_time', { ascending: true }),
    // Les comptes qui jouent : ceux qui ont eu un pick ces deux dernières semaines.
    db.from('ttfl_picks').select('compte').eq('mode', MODE).gte('pick_date', decaler(soiree, -14)).lte('pick_date', soiree),
    db
      .from('ttfl_picks')
      .select('compte, player, score, pick_date')
      .eq('mode', MODE)
      .eq('compte', COMPTE_PRINCIPAL)
      .lt('pick_date', soiree)
      .not('score', 'is', null)
      .order('pick_date', { ascending: false })
      .limit(1)
      .maybeSingle<Pick>(),
    db
      .from('ttfl_runs')
      .select('id')
      .eq('mode', MODE)
      .eq('game_date', soiree)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: number }>(),
  ])
  if (picksRes.error || envoisRes.error || matchsRes.error) {
    return { live: null, note: 'TTFL : lecture des comptes impossible.' }
  }

  const picks = picksRes.data as Pick[]
  const envois = envoisRes.data as Envoi[]
  const matchs = matchsRes.data as Match[]
  const comptes = [...new Set([...(comptesRes.data ?? []).map(c => c.compte as string), ...picks.map(p => p.compte)])].sort()

  const matchsSoiree = matchs.filter(m => m.game_date === soiree)
  const premierMatch = matchsSoiree[0] ? new Date(matchsSoiree[0].commence_time) : null

  const lignes: Ligne[] = []
  let ton: Ton = 'ok'
  let echeance: Date | null = null

  // ── Compte 01 ─────────────────────────────────────────────────────────
  const pick01 = picks.find(p => p.compte === COMPTE_PRINCIPAL) ?? null
  const envoi01 = envois.find(e => e.compte === COMPTE_PRINCIPAL) ?? null
  let projection: number | null = null

  if (pick01) {
    let proj: Projection | null = null
    if (runRes.data) {
      const { data } = await db
        .from('ttfl_projections')
        .select('player, team, opponent, projection')
        .eq('run_id', runRes.data.id)
        .eq('player', pick01.player)
        .limit(1)
        .maybeSingle<Projection>()
      proj = data
    }
    projection = proj?.projection ?? null

    const match = proj ? matchsSoiree.find(m => m.abbr_dom === proj.opponent || m.abbr_ext === proj.opponent) : undefined
    const debut = match ? new Date(match.commence_time) : null
    const saisie =
      envoi01?.statut === 'confirme' ? 'saisi ✓' : envoi01?.statut === 'echec' ? 'échec de saisie' : 'pas encore saisi'
    const tonSaisie: Ton = envoi01?.statut === 'confirme' ? 'ok' : presse(debut, now) || envoi01?.statut === 'echec' ? 'urgent' : 'afaire'

    if (match && proj && debut) {
      const equipe = match.abbr_dom === proj.opponent ? match.abbr_ext : match.abbr_dom
      lignes.push({ texte: `${equipe} – ${proj.opponent} · ${echeanceCourte(debut, now)} · ${saisie}`, ton: tonSaisie })
    } else {
      lignes.push({ texte: `Compte 01 : ${saisie}`, ton: tonSaisie })
    }
    ton = pire(ton, tonSaisie)
    if (tonSaisie !== 'ok' && debut) echeance = debut
  } else if (matchsSoiree.length > 0) {
    ton = presse(premierMatch, now) ? 'urgent' : 'afaire'
    echeance = premierMatch
  }

  // ── Les autres comptes : un pick est-il présent ? ─────────────────────
  const autres = comptes.filter(c => c !== COMPTE_PRINCIPAL)
  if (autres.length > 0 && matchsSoiree.length > 0) {
    const presents = new Set(envois.filter(e => e.statut === 'confirme').map(e => e.compte))
    const manquants = autres.filter(c => !presents.has(c))
    if (manquants.length === 0) {
      lignes.push({ texte: `Autres comptes : ${autres.length}/${autres.length} avec un pick ✓`, ton: 'ok' })
    } else {
      const tonAutres: Ton = presse(premierMatch, now) ? 'urgent' : 'afaire'
      const liste = manquants.length <= 4 ? ` · manque ${manquants.join(', ')}` : ''
      lignes.push({ texte: `Autres comptes : ${autres.length - manquants.length}/${autres.length}${liste}`, ton: tonAutres })
      ton = pire(ton, tonAutres)
      if (!echeance && premierMatch) echeance = premierMatch
    }
  }

  // ── Vainqueurs : la prochaine soirée qui a encore des matchs à venir ──
  const aVenir = matchs.filter(m => new Date(m.commence_time).getTime() > now.getTime())
  const journee = aVenir[0]?.game_date ?? null
  if (journee) {
    const deLaJournee = matchs.filter(m => m.game_date === journee)
    const ids = deLaJournee.map(m => m.event_id)
    const [ktRes, choixRes] = await Promise.all([
      db.from('ttfl_vainqueurs_kt').select('event_id, cote').in('event_id', ids),
      db.from('ttfl_vainqueurs_choix').select('event_id, choix').in('event_id', ids),
    ])
    const kt = new Map((ktRes.data ?? []).map(k => [k.event_id as string, k.cote as string | null]))
    const choix = new Map((choixRes.data ?? []).map(c => [c.event_id as string, c.choix as string | null]))

    const poses = deLaJournee.filter(m => kt.get(m.event_id))
    const differents = poses.filter(m => choix.get(m.event_id) && choix.get(m.event_id) !== kt.get(m.event_id)).length
    const manquants = deLaJournee.filter(m => !kt.get(m.event_id) && new Date(m.commence_time).getTime() > now.getTime())

    const tonV: Ton =
      manquants.length === 0 && differents === 0
        ? 'ok'
        : presse(manquants[0] ? new Date(manquants[0].commence_time) : null, now)
          ? 'urgent'
          : 'afaire'
    const ecart = differents > 0 ? ` · ${differents} différent${differents > 1 ? 's' : ''} de ton choix` : ''
    lignes.push({
      texte: `Vainqueurs du ${jourLisible(journee, true)} : ${poses.length}/${deLaJournee.length} posés chez Thomas${ecart}`,
      ton: tonV,
    })
    ton = pire(ton, tonV)
  }

  // ── Dernier score connu du compte 01 ──────────────────────────────────
  const hier = hierRes.data
  if (hier && hier.score !== null) lignes.push({ texte: `Dernier score : ${hier.player} · ${hier.score} pts` })

  if (matchsSoiree.length === 0 && !pick01) {
    return {
      live: {
        ton: journee ? ton : 'calme',
        contexte: `Soirée du ${jourLisible(soiree)}`,
        titre: 'Pas de match NBA ce soir',
        lignes,
        echeance: null,
        lien,
      },
    }
  }

  const restant = echeance && ton !== 'ok' ? horloge(echeance, now) : null
  return {
    live: {
      ton,
      contexte: `Soirée du ${jourLisible(soiree)} · compte 01`,
      titre: pick01 ? pick01.player : 'Compte 01 : pas de pick',
      chiffre: projection !== null ? { valeur: nombreFr(projection), legende: 'projection' } : undefined,
      lignes,
      echeance: restant ? `dans ${restant}` : null,
      lien,
    },
  }
}
