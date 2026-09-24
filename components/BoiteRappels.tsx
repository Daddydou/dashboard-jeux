'use client'

import { useEffect, useState } from 'react'
import { lireRappels, type BoiteRappels as Boite } from '@/app/actions'
import type { Rappel } from '@/lib/rappels/types'

/** Rappels marqués « vu » sur CET appareil (confort personnel, pas une donnée). */
const CLE_VUS = 'dj_rappels_vus'

function lireVus(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLE_VUS) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function ecrireVus(vus: Set<string>) {
  try {
    localStorage.setItem(CLE_VUS, JSON.stringify([...vus]))
  } catch {
    // Stockage indisponible (navigation privée…) : « vu » ne dure que la session.
  }
}

const COULEUR: Record<Rappel['urgence'], string> = {
  urgent: 'border-red-500',
  bientot: 'border-orange-400',
  info: 'border-slate-600',
}

/**
 * Boîte 📬 : rappels agrégés des apps connectées (pick TVTFL à faire, pick
 * TTFL du soir…). Chargée à l'ouverture de la page et à chaque ouverture du
 * panneau. Le compteur = rappels ni faits ni marqués « vu ».
 */
export default function BoiteRappels() {
  const [boite, setBoite] = useState<Boite | null>(null)
  const [vus, setVus] = useState<Set<string>>(new Set())
  const [ouverte, setOuverte] = useState(false)

  function charger() {
    lireRappels()
      .then(b => {
        setBoite(b)
        // On oublie les « vu » des rappels disparus (jours passés).
        const encore = new Set([...lireVus()].filter(cle => b.rappels.some(r => r.cle === cle)))
        ecrireVus(encore)
        setVus(encore)
      })
      .catch(err => console.error('Rappels :', err))
  }

  useEffect(() => { charger() }, [])

  function marquerVu(cle: string) {
    const suivant = new Set(vus).add(cle)
    ecrireVus(suivant)
    setVus(suivant)
  }

  const aTraiter = boite?.rappels.filter(r => !r.fait && !vus.has(r.cle)).length ?? 0

  return (
    <div className="relative">
      <button
        onClick={() => { if (!ouverte) charger(); setOuverte(o => !o) }}
        title="Rappels"
        aria-expanded={ouverte}
        className="relative bg-slate-800 hover:bg-slate-700 transition-colors px-3 py-2 rounded-2xl text-sm text-slate-300"
      >
        📬
        {aTraiter > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
            {aTraiter}
          </span>
        )}
      </button>

      {ouverte && (
        <div className="absolute right-0 top-12 z-40 w-80 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3">
          <h2 className="text-sm font-bold px-1 mb-2">📬 Rappels</h2>
          {boite === null ? (
            <p className="text-sm text-slate-400 px-1 py-2">Chargement…</p>
          ) : boite.rappels.length === 0 ? (
            <p className="text-sm text-slate-400 px-1 py-2">Rien à faire pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {boite.rappels.map(r => {
                const calme = r.fait || vus.has(r.cle)
                return (
                  <li
                    key={r.cle}
                    className={`border-l-4 ${calme ? 'border-green-600 opacity-60' : COULEUR[r.urgence]} bg-slate-800/60 rounded-lg px-3 py-2`}
                  >
                    <p className="text-sm font-semibold text-slate-100">{r.fait ? '✅ ' : ''}{r.titre}</p>
                    {r.detail && <p className="text-xs text-slate-400 mt-0.5">{r.detail}</p>}
                    <div className="flex gap-3 mt-1.5 text-xs">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200">
                        Ouvrir ↗
                      </a>
                      {!calme && (
                        <button onClick={() => marquerVu(r.cle)} className="text-slate-400 hover:text-slate-200">
                          Marquer vu
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {boite?.notes.map(n => (
            <p key={n} className="text-xs text-slate-500 px-1 mt-2">{n}</p>
          ))}
        </div>
      )}
    </div>
  )
}
