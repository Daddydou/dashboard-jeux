import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { jourDeCycle, maintenant, minutesDepuis } from '@/lib/time'
import webpush from 'web-push'

/**
 * Le cron passe toutes les 5 min : une fenêtre de 15 min après l'heure
 * choisie laisse de la marge si cron-job.org est en retard ou saute un appel.
 */
const FENETRE_MINUTES = 15

const HEURE_MS = 3_600_000
/**
 * Deux rappels quotidiens consécutifs sont espacés d'environ 24 h (23 h ou
 * 25 h aux changements d'heure, ± la fenêtre), deux envois dans la même
 * fenêtre de moins de 15 min : 12 h les sépare sans ambiguïté.
 */
const ECART_MIN_QUOTIDIEN_MS = 12 * HEURE_MS
/**
 * Hebdo : 6 j 12 h bloque le 6e jour (≤ 145 h) et laisse passer le 7e
 * (≥ 166 h) — le rappel revient donc chaque semaine, le même jour que le
 * premier envoi.
 */
const ECART_MIN_HEBDO_MS = 156 * HEURE_MS

type GameRow = {
  id: string
  nom: string
  url: string
  notif_heure: string
  notif_frequence: string | null
  notif_debut: string | null
  notif_fin: string | null
  last_notif_sent_at: string | null
}

type SubRow = {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function GET(req: Request) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vapidSubject = process.env.VAPID_SUBJECT
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return Response.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  // Service-role : la clé publique n'a plus le droit d'écrire, ni de lire les
  // abonnements push. Protégé par CRON_SECRET ci-dessus.
  const supabase = supabaseAdmin()

  // notif_heure / notif_debut / notif_fin sont saisis en heure de Paris, alors
  // que le serveur Vercel tourne en UTC : tout passe par lib/time.ts.
  const now = maintenant()

  const { data: games } = await supabase
    .from('dashboard_games')
    .select('id, nom, url, notif_heure, notif_frequence, notif_debut, notif_fin, last_notif_sent_at')
    .eq('notif_active', true)
    .not('notif_heure', 'is', null)

  if (!games || games.length === 0) return Response.json({ sent: 0 })

  const { data: subscriptions } = await supabase
    .from('dashboard_push_subscriptions')
    .select('id, endpoint, keys')

  if (!subscriptions || subscriptions.length === 0) return Response.json({ sent: 0 })

  let sent = 0

  for (const game of games as GameRow[]) {
    // Jamais en avance : on n'envoie qu'APRÈS l'heure choisie, dans la
    // fenêtre qui suit (un appel du cron en retard envoie quand même).
    if (minutesDepuis(now, game.notif_heure) >= FENETRE_MINUTES) continue

    // Période : on juge le jour du rappel, pas celui de l'appel (un rappel de
    // 23:58 envoyé à 00:03 appartient à la veille).
    const jourDuRappel = jourDeCycle(now, game.notif_heure)
    if (game.notif_debut && jourDuRappel < game.notif_debut) continue
    if (game.notif_fin && jourDuRappel > game.notif_fin) continue

    // Anti-doublon : un seul envoi par fenêtre, puis on attend le jour
    // (quotidien) ou la semaine (hebdo) suivant(e).
    if (game.last_notif_sent_at) {
      const depuisDernier = now.getTime() - new Date(game.last_notif_sent_at).getTime()
      const minimum = game.notif_frequence === 'hebdo' ? ECART_MIN_HEBDO_MS : ECART_MIN_QUOTIDIEN_MS
      if (depuisDernier < minimum) continue
    }

    const payload = JSON.stringify({
      title: `⏰ ${game.nom}`,
      body: "C'est l'heure !",
      url: game.url,
    })

    for (const sub of subscriptions as SubRow[]) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
        sent++
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err) {
          const code = (err as { statusCode: number }).statusCode
          if (code === 410 || code === 404) {
            await supabase.from('dashboard_push_subscriptions').delete().eq('id', sub.id)
          }
        }
      }
    }

    await supabase
      .from('dashboard_games')
      .update({ last_notif_sent_at: now.toISOString() })
      .eq('id', game.id)
  }

  return Response.json({ sent })
}
