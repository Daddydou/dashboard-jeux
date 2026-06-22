import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

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
    // Check date range
    if (game.notif_debut && todayStr < game.notif_debut) continue
    if (game.notif_fin && todayStr > game.notif_fin) continue

    // Check time window (±7 min around notif_heure)
    const [hh, mm] = game.notif_heure.split(':').map(Number)
    const targetMinutes = hh * 60 + mm
    if (Math.abs(currentMinutes - targetMinutes) > 7) continue

    // Idempotency: skip if sent too recently
    if (game.last_notif_sent_at) {
      const msSinceLast = now.getTime() - new Date(game.last_notif_sent_at).getTime()
      const minInterval = game.notif_frequence === 'hebdo'
        ? 6 * 24 * 3_600_000   // 6 days
        : 23 * 3_600_000        // 23 hours (quotidien)
      if (msSinceLast < minInterval) continue
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
