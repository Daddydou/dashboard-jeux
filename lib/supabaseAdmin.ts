import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase service-role : contourne la RLS, donc SERVEUR UNIQUEMENT
 * (`server-only` fait échouer le build s'il est importé côté client).
 * La clé ne doit jamais être préfixée NEXT_PUBLIC_.
 *
 * Toute écriture passe par ce client, après `exigerSession()` pour les
 * Server Actions, ou CRON_SECRET pour la route cron.
 */
let client: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (ou l’URL) non définie : écritures impossibles.')
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}
