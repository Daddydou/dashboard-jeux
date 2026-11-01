import 'server-only'
import { supabase, type Game } from '@/lib/supabase'

/**
 * Lecture des jeux, côté serveur, avec la clé publique (la RLS n'autorise
 * que `select`). Une lecture qui échoue LÈVE : la page d'erreur (avec
 * « Réessayer ») vaut mieux qu'un écran vide qui laisse croire que tous les
 * jeux ont disparu.
 */
export async function lireJeux(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('dashboard_games')
    .select('*')
    .eq('actif', true)
    .order('ordre', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Lecture des jeux impossible : ${error.message}`)
  return data as Game[]
}
