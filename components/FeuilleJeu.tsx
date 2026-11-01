'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { retirerJeu, sauvegarderJeu } from '@/actions/jeux'
import type { ChampsJeu } from '@/actions/types'
import type { Game } from '@/lib/supabase'

type Props = {
  /** null : ajout d'un nouveau jeu. */
  jeu: Game | null
  sources: { id: string; libelle: string }[]
  onFermer: () => void
}

const COULEURS = ['#2559A6', '#3A7638', '#9C5627', '#7C4DDB', '#D9468F', '#E0A526', '#3B9AA8', '#5B6B82']

const champ = 'h-12 w-full rounded-xl border border-white/10 bg-nuit px-3.5 text-base text-craie placeholder:text-brume/60'
const etiquette = 'mb-1.5 block text-sm font-semibold'

const heureCourte = (h: string | null | undefined) => (h ? h.slice(0, 5) : '')

/**
 * Fiche d'un jeu : feuille qui monte du bas sur téléphone, boîte centrée sur
 * ordinateur. Elle est créée à l'ouverture et détruite à la fermeture : le
 * formulaire repart toujours des valeurs du jeu.
 */
export default function FeuilleJeu({ jeu, sources, onFermer }: Props) {
  const dialogue = useRef<HTMLDialogElement>(null)
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmer, setConfirmer] = useState(false)

  const [nom, setNom] = useState(jeu?.nom ?? '')
  const [url, setUrl] = useState(jeu?.url ?? '')
  const [emoji, setEmoji] = useState(jeu?.emoji ?? '')
  const [couleur, setCouleur] = useState((jeu?.couleur ?? '').toUpperCase())
  const [notes, setNotes] = useState(jeu?.notes ?? '')
  const [source, setSource] = useState(jeu?.source_type && sources.some(s => s.id === jeu.source_type) ? jeu.source_type : '')
  const [notifActive, setNotifActive] = useState(jeu?.notif_active ?? false)
  const [notifHeure, setNotifHeure] = useState(heureCourte(jeu?.notif_heure))
  const [notifFrequence, setNotifFrequence] = useState(jeu?.notif_frequence ?? 'quotidien')
  const [notifDebut, setNotifDebut] = useState(jeu?.notif_debut ?? '')
  const [notifFin, setNotifFin] = useState(jeu?.notif_fin ?? '')

  useEffect(() => {
    const d = dialogue.current
    if (d && !d.open) d.showModal()
  }, [])

  const fermer = () => dialogue.current?.close()

  function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const champs: ChampsJeu = {
      nom,
      url,
      emoji,
      couleur,
      notes,
      source_type: source,
      notif_active: notifActive,
      notif_heure: notifHeure,
      notif_frequence: notifFrequence,
      notif_debut: notifDebut,
      notif_fin: notifFin,
    }
    demarrer(async () => {
      const r = await sauvegarderJeu(jeu?.id ?? null, champs)
      if (r.ok) fermer()
      else setErreur(r.erreur)
    })
  }

  function retirer() {
    if (!jeu) return
    demarrer(async () => {
      const r = await retirerJeu(jeu.id)
      if (r.ok) fermer()
      else setErreur(r.erreur)
    })
  }

  return (
    <dialog
      ref={dialogue}
      onClose={onFermer}
      onClick={e => {
        if (e.target === e.currentTarget) fermer()
      }}
      aria-labelledby="titre-feuille"
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] bg-tableau p-0 text-craie backdrop:bg-black/65 md:inset-0 md:m-auto md:h-fit md:max-w-lg md:rounded-[28px]"
    >
      <form onSubmit={enregistrer} className="flex flex-col gap-5 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <div className="flex items-center justify-between">
          <h2 id="titre-feuille" className="font-display text-2xl font-semibold">
            {jeu ? jeu.nom : 'Ajouter un jeu'}
          </h2>
          <button type="button" onClick={fermer} className="h-11 rounded-xl px-3 text-brume hover:text-craie">
            Fermer
          </button>
        </div>

        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <div>
            <label htmlFor="f-emoji" className={etiquette}>
              Icône
            </label>
            <input
              id="f-emoji"
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
              maxLength={8}
              placeholder="🎾"
              className={`${champ} text-center text-xl`}
            />
          </div>
          <div>
            <label htmlFor="f-nom" className={etiquette}>
              Nom
            </label>
            <input id="f-nom" value={nom} onChange={e => setNom(e.target.value)} required maxLength={80} className={champ} />
          </div>
        </div>

        <div>
          <label htmlFor="f-url" className={etiquette}>
            Adresse du site
          </label>
          <input
            id="f-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
            placeholder="https://…"
            className={champ}
          />
        </div>

        <fieldset>
          <legend className={etiquette}>Couleur</legend>
          <div className="flex flex-wrap gap-1" role="radiogroup">
            {COULEURS.map(c => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={couleur === c}
                aria-label={`Couleur ${c}`}
                onClick={() => setCouleur(c)}
                className="grid h-11 w-11 place-items-center"
              >
                <span
                  className={['h-7 w-7 rounded-full', couleur === c ? 'outline outline-2 outline-offset-2 outline-craie' : ''].join(' ')}
                  style={{ background: c }}
                />
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="f-source" className={etiquette}>
            À la une
          </label>
          <select id="f-source" value={source} onChange={e => setSource(e.target.value)} className={champ}>
            <option value="">Non : simple raccourci</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>
                Oui, avec le statut {s.libelle}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-sm text-brume">Un jeu à la une a une grande carte sur l’accueil, avec son statut en direct.</p>
        </div>

        <div>
          <label htmlFor="f-notes" className={etiquette}>
            Note
          </label>
          <input
            id="f-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={2000}
            placeholder="Code de ligue, identifiant…"
            className={champ}
          />
        </div>

        <section className="flex flex-col gap-4 rounded-2xl bg-nuit p-4">
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span className="font-semibold">Me rappeler par notification</span>
            <input
              type="checkbox"
              checked={notifActive}
              onChange={e => setNotifActive(e.target.checked)}
              className="h-6 w-6 accent-[#DCF44A]"
            />
          </label>

          {notifActive && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="f-nh" className={etiquette}>
                  Heure
                </label>
                <input id="f-nh" type="time" value={notifHeure} onChange={e => setNotifHeure(e.target.value)} required className={champ} />
              </div>
              <div>
                <label htmlFor="f-nf" className={etiquette}>
                  Fréquence
                </label>
                <select id="f-nf" value={notifFrequence} onChange={e => setNotifFrequence(e.target.value)} className={champ}>
                  <option value="quotidien">Chaque jour</option>
                  <option value="hebdo">Chaque semaine</option>
                </select>
              </div>
              <div>
                <label htmlFor="f-nd" className={etiquette}>
                  À partir du
                </label>
                <input id="f-nd" type="date" value={notifDebut} onChange={e => setNotifDebut(e.target.value)} className={champ} />
              </div>
              <div>
                <label htmlFor="f-nfin" className={etiquette}>
                  Jusqu’au
                </label>
                <input id="f-nfin" type="date" value={notifFin} onChange={e => setNotifFin(e.target.value)} className={champ} />
              </div>
            </div>
          )}
        </section>

        {erreur && (
          <p role="alert" className="rounded-xl bg-carton/15 px-3 py-2.5 text-sm text-carton">
            {erreur}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={enCours} className="h-12 rounded-2xl bg-craie text-base font-semibold text-nuit disabled:opacity-50">
            {enCours ? 'Enregistrement…' : jeu ? 'Enregistrer' : 'Ajouter le jeu'}
          </button>
          {jeu &&
            (confirmer ? (
              <button
                type="button"
                onClick={retirer}
                disabled={enCours}
                className="h-12 rounded-2xl bg-carton text-base font-semibold text-white disabled:opacity-50"
              >
                Oui, retirer {jeu.nom}
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmer(true)} className="h-12 rounded-2xl text-carton">
                Retirer du dashboard
              </button>
            ))}
        </div>
      </form>
    </dialog>
  )
}
