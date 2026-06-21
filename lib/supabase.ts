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
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
