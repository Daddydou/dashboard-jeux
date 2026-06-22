import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    endpoint: string
    keys?: { p256dh: string; auth: string }
  }

  if (!body.endpoint || !body.keys) {
    return Response.json({ error: 'Missing endpoint or keys' }, { status: 400 })
  }

  const { error } = await supabase
    .from('dashboard_push_subscriptions')
    .upsert(
      { endpoint: body.endpoint, keys: body.keys },
      { onConflict: 'endpoint' }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
