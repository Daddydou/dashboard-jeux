'use client'

import { useState } from 'react'
import { lireSantePortfolio, type SanteJeu } from '@/app/actions'

/** Version majeure de Next sous laquelle un projet est signalé « à migrer ». */
const NEXT_MAJEURE_ACTUELLE = 16

function majeure(version: string): number | null {
  const m = /(\d+)/.exec(version)
  return m ? Number(m[1]) : null
}

const joursRelatifs = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

function depuis(iso: string): string {
  const jours = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  return joursRelatifs.format(jours, 'day')
}

function Oui({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-400" aria-label="présent">✓</span>
    : <span className="text-red-400" aria-label="absent">✗</span>
}

/**
 * Santé du portfolio : pour chaque jeu relié à un dépôt GitHub, version de
 * Next.js, dernier push, présence de CLAUDE.md et README. Lu à l'ouverture
 * (Server Action, cache GitHub d'1 h côté serveur).
 */
export default function PanneauSante() {
  const [ouvert, setOuvert] = useState(false)
  const [lignes, setLignes] = useState<SanteJeu[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  function ouvrir() {
    setOuvert(true)
    setLignes(null)
    setErreur(null)
    lireSantePortfolio()
      .then(setLignes)
      .catch(err => {
        console.error('Santé du portfolio :', err)
        setErreur('Lecture impossible (session expirée ?).')
      })
  }

  return (
    <>
      <button
        onClick={ouvrir}
        title="Santé du portfolio"
        className="bg-slate-800 hover:bg-slate-700 transition-colors px-3 py-2 rounded-2xl text-sm text-slate-300"
      >
        🩺
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setOuvert(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-sante"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="titre-sante" className="text-lg font-bold">🩺 Santé du portfolio</h2>
              <button
                onClick={() => setOuvert(false)}
                className="px-3 py-1 rounded-xl text-slate-400 hover:text-slate-100 transition-colors"
              >
                Fermer
              </button>
            </div>

            {erreur ? (
              <p className="text-sm text-red-300">{erreur}</p>
            ) : lignes === null ? (
              <p className="text-sm text-slate-400">Lecture des dépôts GitHub…</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-4 font-semibold">Jeu</th>
                      <th className="py-2 pr-4 font-semibold">Next.js</th>
                      <th className="py-2 pr-4 font-semibold">Dernier push</th>
                      <th className="py-2 pr-4 font-semibold text-center">CLAUDE.md</th>
                      <th className="py-2 font-semibold text-center">README</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {lignes.map(({ gameId, nom, sante }) => (
                      <tr key={gameId}>
                        <td className="py-2 pr-4">
                          <div className="font-medium text-slate-100">{nom}</div>
                          {sante && <div className="text-xs text-slate-500">{sante.depot}</div>}
                        </td>
                        {!sante ? (
                          <td colSpan={4} className="py-2 text-slate-600">— pas de dépôt (site externe)</td>
                        ) : sante.erreur ? (
                          <td colSpan={4} className="py-2 text-orange-300">{sante.erreur}</td>
                        ) : (
                          <>
                            <td className="py-2 pr-4 tabular-nums">
                              {sante.next === null ? (
                                <span className="text-slate-600">—</span>
                              ) : (majeure(sante.next) ?? 0) < NEXT_MAJEURE_ACTUELLE ? (
                                <span className="text-orange-300">{sante.next} · à migrer</span>
                              ) : (
                                <span className="text-slate-300">{sante.next}</span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-slate-300">
                              {sante.derniereMaj ? depuis(sante.derniereMaj) : '—'}
                            </td>
                            <td className="py-2 pr-4 text-center"><Oui ok={sante.claudeMd} /></td>
                            <td className="py-2 text-center"><Oui ok={sante.readme} /></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-xs text-slate-500">
                  Relier un jeu à son dépôt : ✏️ sur la carte, champ « Dépôt GitHub ». Données GitHub mises en cache 1 h.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
