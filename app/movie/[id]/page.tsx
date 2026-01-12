'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DM_Mono } from 'next/font/google'
import { supabase } from '../../../lib/supabase'

const dmMono = DM_Mono({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
})

type MovieRow = {
  id: string
  title: string
  year: number | null
  director: string | null
 
  poster_url?: string | null
}

type MovieProfile = {
  movie_id: string
  runtime_minutes: number | null
  rating_value: number | null
  funny_synopsis: string
}

type MovieVibe = {
  movie_id: string
  chaos: number
  feels: number
  brain: number
  danger: number
  vibe_label: string
  vibe_note: string
}

type KitItem = { id: string | number; movie_id: string; item_text: string; sort_order: number }
type PeeWindow = { id: string | number; movie_id: string; start_timecode: string; end_timecode: string; sort_order: number }

export default function MovieProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [movie, setMovie] = useState<MovieRow | null>(null)
  const [profile, setProfile] = useState<MovieProfile | null>(null)
  const [vibe, setVibe] = useState<MovieVibe | null>(null)
  const [kitItems, setKitItems] = useState<KitItem[]>([])
  const [peeWindows, setPeeWindows] = useState<PeeWindow[]>([])

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!id) return
      setLoading(true)
      setErr(null)

     
      const movieRes = await supabase
        .from('movies')
        .select('id,title,year,director,poster_url')
        .eq('id', id)
        .single()

      if (cancelled) return
      if (movieRes.error) {
        setErr(movieRes.error.message)
        setLoading(false)
        return
      }
      const m = movieRes.data as MovieRow
      setMovie(m)

      const profRes = await supabase
        .from('movie_profiles')
        .select('movie_id,runtime_minutes,rating_value,funny_synopsis')
        .eq('movie_id', m.id)
        .maybeSingle()

      const vibeRes = await supabase
        .from('movie_vibes')
        .select('movie_id,chaos,feels,brain,danger,vibe_label,vibe_note')
        .eq('movie_id', m.id)
        .maybeSingle()

      const kitRes = await supabase
        .from('movie_survival_kit_items')
        .select('id,movie_id,item_text,sort_order')
        .eq('movie_id', m.id)
        .order('sort_order', { ascending: true })

      const peeRes = await supabase
        .from('movie_pee_windows')
        .select('id,movie_id,start_timecode,end_timecode,sort_order')
        .eq('movie_id', m.id)
        .order('sort_order', { ascending: true })

      if (cancelled) return

      setProfile((profRes.data as any) ?? null)
      setVibe((vibeRes.data as any) ?? null)
      setKitItems(((kitRes.data as any) ?? []) as KitItem[])
      setPeeWindows(((peeRes.data as any) ?? []) as PeeWindow[])

      const firstError =
        profRes.error?.message || vibeRes.error?.message || kitRes.error?.message || peeRes.error?.message || null
      if (firstError) setErr(firstError)

      setLoading(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [id])

  const kit = useMemo(() => kitItems.slice().sort((a, b) => a.sort_order - b.sort_order), [kitItems])
  const pee = useMemo(() => peeWindows.slice().sort((a, b) => a.sort_order - b.sort_order)[0], [peeWindows])

  return (
    <div className={`${dmMono.className} min-h-screen bg-black flex items-center justify-center p-6`}>
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="h-[calc(844px-80px)] overflow-y-auto">
          {/* Header */}
          <div className="relative z-10 px-5 pt-10 pb-10 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
            <div className="flex items-center justify-center gap-2">
              <span className="text-white/90 text-2xl">☆</span>
              <span className="text-white/90 text-2xl">☆</span>
              <h1 className="text-white text-2xl tracking-widest font-normal">Cinemate</h1>
              <span className="text-white/90 text-2xl">☆</span>
              <span className="text-white/90 text-2xl">☆</span>
            </div>

            <div className="mt-4 flex items-center justify-between">
             
              <button
                onClick={() => router.push('/')}
                className="h-9 w-9 rounded-full bg-[#4b0f0f] flex items-center justify-center text-white"
                aria-label="Back to search"
              >
                <span className="text-lg leading-none">‹</span>
              </button>

              <div className="h-9 w-9" />
            </div>

         
            <div className="pointer-events-none absolute left-1/2 top-25 -translate-x-1/2 z-30">
              <MoviePosterCard posterUrl={movie?.poster_url} title={movie?.title ?? 'Movie poster'} />
            </div>
          </div>

          {/* Body */}
          <div className="bg-[#f7f1e7] pb-10">
            {loading && <div className="p-6 text-black/70">Loading…</div>}
            {err && <div className="p-6 text-red-700">Error: {err}</div>}

            {!loading && movie && (
              <div className="px-5 pt-10">
                <div className="-mt-3 flex items-start justify-between">
                  <div className="text-center min-w-[90px]">
                    <div className="text-xl text-black font-medium leading-none">{profile?.runtime_minutes ?? '—'}</div>
                    <div className="text-black/70 text-xs mt-1">minutes</div>
                  </div>

                  <div className="w-28" />

                  <div className="text-center min-w-[90px]">
                    <div className="text-xl text-black font-medium leading-none">{profile?.rating_value ?? '—'}</div>
                    <div className="text-black/70 text-xs mt-1">rating</div>
                  </div>
                </div>

                <div className="mt-12 text-center">
                  <div className="text-black text-lg font-semibold leading-snug">
                    {movie.title}
                    {movie.year ? <span className="text-black/70 font-normal text-xs">, {movie.year}</span> : null}
                  </div>
                  {movie.director ? (
                    <div className="mt-1 text-black/70 italic text-xs">Directed by {movie.director}</div>
                  ) : null}
                </div>

                <div className="mt-4 text-black text-[0.8rem] leading-relaxed border-t border-black/10 pt-3">
                  {profile?.funny_synopsis ?? 'No synopsis yet for this movie.'}
                </div>

                <div className="mt-7 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-black font-normal tracking-widest text-sm mb-2">Survival Kit 🧰</div>
                    <div className="rounded-2xl bg-[#4b0f0f] text-white p-4 min-h-[140px]">
                      {kit.length ? (
                        <ul className="space-y-2 text-xs mt-1.5">
                          {kit.map((k) => (
                            <li key={k.id}>• {k.item_text}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-white/80 text-sm">No kit items yet.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-black font-normal tracking-widest text-sm mb-2">Toilet time 🚽</div>
                    <div className="rounded-2xl bg-[#4b0f0f] text-white p-4 min-h-[140px] grid place-items-center text-center">
                      {pee ? (
                        <div>
                          <div className="text-base font-medium">
                            {pee.start_timecode}–{pee.end_timecode}
                          </div>
                          <div className="text-white/80 text-xs mt-1">minutes in</div>
                        </div>
                      ) : (
                        <div className="text-white/80 text-sm">No pee window yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="text-black font-normal tracking-widest text-sm mb-2">Movie vibe checker 😎</div>
                  <div className="rounded-2xl bg-[#4b0f0f] text-white p-4">
                    {vibe ? (
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-white/80">Vibe</span>
                          <span className="font-normal italic">{vibe.vibe_label}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <VibeRow label="Chaos 🤯" value={vibe.chaos} />
                          <VibeRow label="Feels 🥰" value={vibe.feels} />
                          <VibeRow label="Brain 🧠" value={vibe.brain} />
                          <VibeRow label="Danger ⚠️" value={vibe.danger} />
                        </div>

                        <div className="text-white/80 text-xs pt-2 border-t border-white/15">{vibe.vibe_note}</div>
                      </div>
                    ) : (
                      <div className="text-white/80 text-sm">No vibe checker yet.</div>
                    )}
                  </div>
                </div>

                <div className="mt-10 border-t border-black/20 pt-6">
                  <div className="text-black font-normal tracking-widest text-sm mb-3">Where to stream 📺</div>

                  <div className="flex items-center gap-4">
                    <StreamBadge label="prime video" bg="bg-[#4aa6df]" icon="prime" />
                    <StreamBadge label="NETFLIX" bg="bg-black" icon="netflix" />
                    <StreamBadge label="hulu" bg="bg-[#1ce783]" icon="hulu" />
                  </div>
                </div>

                <div className="h-10" />
              </div>
            )}
          </div>
        </div>

        {/* Bottom navbar */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#141414] border-t border-white/10">
          <div className="h-20 px-10 flex items-center justify-between">
            <button className="text-white/80 grid place-items-center" aria-label="Home" onClick={() => router.push('/')}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
              >
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V21a1 1 0 0 0 1 1h12a 1 1 0 0 0 1-1V9.5" />
              </svg>
            </button>

            <button
              className="h-10 w-16 rounded-full bg-[#141414] border border-white text-white text-2xl grid place-items-center"
              aria-label="Add"
            >
              +
            </button>

            <button className="text-white/80 grid place-items-center" aria-label="Profile">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-7 w-7"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="8" r="4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MoviePosterCard({ posterUrl, title }: { posterUrl?: string | null; title: string }) {
  const [ok, setOk] = useState(true)

  return (
    <div className="h-40 w-28 rotate-[-4deg] rounded-2xl overflow-hidden border border-white/15 bg-black/10 grid place-items-center">
      {posterUrl && ok ? (
        <img
          src={posterUrl}
          alt={title}
          className="h-full w-full object-cover"
          onError={() => setOk(false)}
        />
      ) : (
        <span className="text-3xl">🎬</span>
      )}
    </div>
  )
}

function VibeRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
      <span className="text-white/80">{label}</span>
      <span className="font-semibold">{value}/10</span>
    </div>
  )
}

function StreamBadge({
  label,
  bg,
  icon,
}: {
  label: string
  bg: string
  icon: 'netflix' | 'prime' | 'hulu'
}) {
  return (
    <div className={['h-8 w-8 rounded-xl grid place-items-center', bg].join(' ')}>
      {icon === 'netflix' ? (
        <span className="text-[#e50914] text-xl font-semibold">N</span>
      ) : icon === 'prime' ? (
        <span className="text-white text-[6px] font-medium leading-none text-center">
          prime
          <br />
          video
        </span>
      ) : (
        <span className="text-black text-[9px] font-semibold">hulu</span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  )
}
