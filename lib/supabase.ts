import { createClient } from '@supabase/supabase-js'

export type Game = {
  id: string
  nom: string
  url: string
  description: string | null
  emoji: string | null
  couleur: string | null
  categorie: string | null
  ordre: number
  actif: boolean
  created_at: string
  dernier_ouvert: string | null
  notes: string | null
  source_type: string | null
  // Feature B
  reset_heure: string | null
  // Feature C
  notif_active: boolean
  notif_debut: string | null
  notif_fin: string | null
  notif_frequence: string | null
  notif_heure: string | null
  last_notif_sent_at: string | null
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
