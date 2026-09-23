import { sessionValide } from '@/auth/garde'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  // Le proxy filtre déjà /api, mais la garde applicative reste la
  // ligne de défense qui compte (cf. auth/garde.ts).
  if (!(await sessionValide())) {
    return Response.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const body = await req.json() as {
    endpoint: string
    keys?: { p256dh: string; auth: string }
  }

  if (!body.endpoint || !body.keys) {
    return Response.json({ error: 'Missing endpoint or keys' }, { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from('dashboard_push_subscriptions')
    .upsert(
      { endpoint: body.endpoint, keys: body.keys },
      { onConflict: 'endpoint' }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
