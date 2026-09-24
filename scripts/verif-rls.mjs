// Vérifie ce que la clé PUBLIQUE (anon) peut faire sur Supabase.
// Non destructif : les écritures ciblent un UUID inexistant.
//   node --env-file=.env.local scripts/verif-rls.mjs
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const FANTOME = '00000000-0000-0000-0000-000000000000'

function verdict(nom, { error }, attenduRefus) {
  const refuse = !!error
  const ok = refuse === attenduRefus
  console.log(`${ok ? '✅' : '❌'} ${nom.padEnd(40)} ${refuse ? `refusé (${error.code})` : 'autorisé'}`)
  return ok
}

const r = [
  verdict('lecture dashboard_games', await db.from('dashboard_games').select('id').limit(1), false),
  verdict('lecture dashboard_done', await db.from('dashboard_done').select('game_id').limit(1), false),
  verdict('lecture dashboard_ouvertures', await db.from('dashboard_ouvertures').select('id').limit(1), false),
  verdict('lecture dashboard_push_subscriptions', await db.from('dashboard_push_subscriptions').select('id').limit(1), true),
  verdict('update dashboard_games', await db.from('dashboard_games').update({ notes: 'x' }).eq('id', FANTOME), true),
  verdict('delete dashboard_games', await db.from('dashboard_games').delete().eq('id', FANTOME), true),
  verdict('delete dashboard_done', await db.from('dashboard_done').delete().eq('game_id', FANTOME), true),
  verdict('insert dashboard_ouvertures', await db.from('dashboard_ouvertures').insert({ game_id: FANTOME }), true),
  verdict('delete dashboard_ouvertures', await db.from('dashboard_ouvertures').delete().eq('game_id', FANTOME), true),
  verdict('delete dashboard_push_subscriptions', await db.from('dashboard_push_subscriptions').delete().eq('id', FANTOME), true),
]
process.exit(r.every(Boolean) ? 0 : 1)
