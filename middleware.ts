import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, verifierJeton } from '@/auth/session';

/**
 * Porte d'entrée : tout est privé sauf /login (équivalent du `proxy.ts` de
 * Next 16 ; en Next 14 il s'appelle `middleware.ts` et tourne en Edge).
 *
 * ⚠ Le middleware ne remplace pas les contrôles applicatifs : les Server
 * Actions sont des POST vers la route qui les héberge, pas des routes
 * distinctes. Les écritures re-vérifient donc la session de leur côté
 * (`auth/garde.ts`).
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/login') return NextResponse.next();

  if (await verifierJeton(request.cookies.get(COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }

  // Appels machine (fetch, curl) et Server Actions : une redirection HTML
  // serait illisible pour l'appelant. On répond 401.
  const estServerAction = request.headers.get('next-action') !== null;
  if (pathname.startsWith('/api/') || estServerAction) {
    return Response.json(
      { ok: false, error: 'Non authentifié.' },
      { status: 401 },
    );
  }

  const login = new URL('/login', request.url);
  // Retour à la page demandée après connexion. Chemin interne uniquement :
  // `//evil.com` est une URL protocol-relative, donc une redirection ouverte.
  const cible = `${pathname}${search}`;
  if (cible.startsWith('/') && !cible.startsWith('//')) {
    login.searchParams.set('next', cible);
  }
  return NextResponse.redirect(login);
}

export const config = {
  // Tout, sauf :
  // - les assets statiques et ceux de la PWA (le service worker, le manifeste
  //   et les icônes doivent se charger sans cookie) ;
  // - /api/cron, appelé par le planificateur et protégé par CRON_SECRET.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-.*\\.png|api/cron/).*)',
  ],
};
