'use client'

import { DM_Mono } from 'next/font/google'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const dmMono = DM_Mono({ weight: ['300', '400', '500'], subsets: ['latin'] })

const MY_PROFILE_ID = '8c2d4b5a-1b6d-4c7a-9d26-5c4f73f2a9c1'
const RED = '#4b0f0f'

type RatedRow = {
  movie_id: number
  rating: number
  watched_on: string | null
  movies: {
    id: number
    title: string
    year: number | null
    poster_url: string | null
  } | null
}

function formatSupabaseError(error: unknown) {
  const e = error as any
  const parts = [e?.message, e?.details, e?.hint].filter(Boolean)
  return parts.length ? parts.join(' • ') : 'Unknown error'
}

function Poster({ url, title }: { url: string | null; title: string }) {
  const [ok, setOk] = useState(true)
  return (
    <div className="h-16 w-12 rounded-lg overflow-hidden border border-white/20 bg-white/10 grid place-items-center">
      {url && ok ? (
        <img src={url} alt={title} className="h-full w-full object-cover" onError={() => setOk(false)} loading="lazy" />
      ) : (
        <span className="text-white/80">🎬</span>
      )}
    </div>
  )
}

export default function ListPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<RatedRow[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setErr(null)

      const { data, error } = await supabase
        .from('movie_ratings')
        .select(
          `
          movie_id,
          rating,
          watched_on,
          movies:movie_id ( id, title, year, poster_url )
        `
        )
        .eq('profile_id', MY_PROFILE_ID)
        .order('watched_on', { ascending: false })

      if (cancelled) return

      if (error) {
        setErr(formatSupabaseError(error))
        setRows([])
      } else {
       
        const mapped: RatedRow[] = (data ?? []).map((r: any) => ({
          movie_id: Number(r.movie_id),
          rating: Number(r.rating),
          watched_on: r.watched_on ?? null,
          movies: r.movies
            ? {
                id: Number(r.movies.id),
                title: String(r.movies.title),
                year: r.movies.year ?? null,
                poster_url: r.movies.poster_url ?? null,
              }
            : null,
        }))

        setRows(mapped)
      }

      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => (r.movies?.title ?? '').toLowerCase().includes(s))
  }, [q, rows])

  return (
    <div className={`${dmMono.className} min-h-screen bg-black flex items-center justify-center p-6`}>
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="h-full flex flex-col min-h-0">
          {/* Header */}
          <div className="px-5 pt-10 pb-5 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
            <div className="flex items-center justify-center gap-2">
              <span className="text-white/90 text-2xl">☆</span>
              <span className="text-white/90 text-2xl">☆</span>
              <h1 className="text-white text-2xl tracking-widest font-normal">Cinemate</h1>
              <span className="text-white/90 text-2xl">☆</span>
              <span className="text-white/90 text-2xl">☆</span>
            </div>

            <div className="mt-4 relative">
              <button
                onClick={() => router.back()}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-11.5 w-14 rounded-full bg-[#4b0f0f] shadow flex items-center justify-center text-white text-xl"
                aria-label="Back"
              >
                ‹
              </button>

              <div className="bg-white rounded-full pl-16 pr-4 h-11 flex items-center">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search your films"
                  className="w-full bg-transparent outline-none text-[16px] leading-none text-black placeholder:text-black/40"
                />
              </div>
            </div>
          </div>

          {/* Body */}
          <div
            className="px-5 pt-4 pb-6 flex-1 min-h-0 overflow-y-auto bg-[#4b0f0f]"
            style={{ borderTopLeftRadius: '0.9375rem', borderTopRightRadius: '0.9375rem' }}
          >
            <div className="text-white text-xl tracking-widest">YOUR FILMS</div>
            <div className="mt-4 h-px bg-white/40" />

            {loading ? (
              <div className="mt-6 text-white/70 text-sm">Loading…</div>
            ) : err ? (
              <div className="mt-6 rounded-xl border border-white/20 bg-black/20 p-4 text-red-200 text-sm">{err}</div>
            ) : filtered.length === 0 ? (
              <div className="mt-6 text-white/70 text-sm">No rated films yet.</div>
            ) : (
              <ul className="mt-2">
                {filtered.map((r) => {
                  const m = r.movies
                  const title = m?.title ?? 'Unknown title'
                  return (
                    <li key={String(r.movie_id)} className="border-b border-white/30 py-5">
                      <div className="flex items-center gap-4 mb-4 mt-4">
                        <Poster url={m?.poster_url ?? null} title={title} />

                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm">
                            <span className="font-semibold">{title}</span>
                            {m?.year ? <span className="text-white/70">, {m.year}</span> : null}
                          </div>
                          <div className="mt-1 text-white/70 text-xs">Rating: {r.rating}/5</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => router.push(`/rating/${r.movie_id}`)}
                          className="px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest"
                        >
                          EDIT
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
