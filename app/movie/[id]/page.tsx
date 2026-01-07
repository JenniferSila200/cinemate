'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase' 

type MovieRow = {
  id: string
  title: string
  year: number | null
  director: string | null
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

     
      const movieRes = await supabase.from('movies').select('id,title,year,director').eq('id', id).single()
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
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="px-5 pt-10 pb-5 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="h-12 w-12 rounded-full bg-[#4b0f0f] shadow flex items-center justify-center text-white text-2xl"
              aria-label="Back"
            >
              ‹
            </button>
            <div className="flex-1 text-center pr-12">
              <div className="text-white text-lg tracking-widest">Cinemate</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(844px-120px)] overflow-y-auto bg-[#f7f1e7] pb-10">
          {loading && <div className="p-6 text-black/70">Loading…</div>}
          {err && <div className="p-6 text-red-700">Error: {err}</div>}

          {!loading && movie && (
            <div className="px-5 pt-6">
           
              <div className="flex items-start justify-between gap-4">
                <div className="text-center min-w-[90px]">
                  <div className="text-2xl text-black">{profile?.runtime_minutes ?? '—'}</div>
                  <div className="text-black/70 text-sm">minutes</div>
                </div>

                <div className="flex-1 text-center">
                  <div className="h-36 w-24 mx-auto rounded-xl bg-black/10 border border-black/10 grid place-items-center">🎬</div>
                </div>

                <div className="text-center min-w-[90px]">
                  <div className="text-2xl text-black">{profile?.rating_value ?? '—'}</div>
                  <div className="text-black/70 text-sm">rating</div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <div className="text-black text-xl font-semibold">
                  {movie.title}
                  {movie.year ? <span className="text-black/70 font-normal">, {movie.year}</span> : null}
                </div>
                {movie.director ? <div className="mt-1 text-black/70 italic">Directed by {movie.director}</div> : null}
              </div>

              <div className="mt-5 text-black text-sm leading-relaxed border-t border-black/10 pt-4">
                {profile?.funny_synopsis ?? 'No synopsis yet for this movie.'}
              </div>

              {/* Survival Kit + Toilet time section */}
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-black font-semibold tracking-widest text-sm mb-2">Survival Kit</div>
                  <div className="rounded-2xl bg-[#4b0f0f] text-white p-4 min-h-[140px] shadow">
                    {kit.length ? (
                      <ul className="space-y-2 text-sm">
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
                  <div className="text-black font-semibold tracking-widest text-sm mb-2">Toilet time</div>
                  <div className="rounded-2xl bg-[#4b0f0f] text-white p-4 min-h-[140px] shadow grid place-items-center text-center">
                    {pee ? (
                      <div>
                        <div className="text-2xl font-semibold">
                          {pee.start_timecode}–{pee.end_timecode}
                        </div>
                        <div className="text-white/80 text-sm mt-1">minutes in</div>
                      </div>
                    ) : (
                      <div className="text-white/80 text-sm">No pee window yet.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vibe checker section */}
              <div className="mt-8">
                <div className="text-black font-semibold tracking-widest text-sm mb-2">Movie vibe checker</div>
                <div className="rounded-2xl bg-[#4b0f0f] text-white p-4 shadow">
                  {vibe ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80">Vibe</span>
                        <span className="font-semibold">{vibe.vibe_label}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <VibeRow label="Chaos" value={vibe.chaos} />
                        <VibeRow label="Feels" value={vibe.feels} />
                        <VibeRow label="Brain" value={vibe.brain} />
                        <VibeRow label="Danger" value={vibe.danger} />
                      </div>

                      <div className="text-white/80 text-sm pt-2 border-t border-white/15">{vibe.vibe_note}</div>
                    </div>
                  ) : (
                    <div className="text-white/80 text-sm">No vibe checker yet.</div>
                  )}
                </div>
              </div>

              <div className="h-10" />
            </div>
          )}
        </div>
      </div>
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
