import 'server-only'
import { redirect } from 'next/navigation'
import { sessionValide } from './garde'

/**
 * Garde d'une PAGE : renvoie vers /login sans session valide. Le proxy le
 * fait déjà ; la vérification reste dans chaque page parce que le proxy
 * n'est pas la vraie protection (voir auth/garde.ts).
 */
export async function pageProtegee(): Promise<void> {
  if (!(await sessionValide())) redirect('/login')
}
