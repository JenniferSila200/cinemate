'use client'

import { DM_Mono } from 'next/font/google'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

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

const MY_PROFILE_ID = '8c2d4b5a-1b6d-4c7a-9d26-5c4f73f2a9c1'

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatSupabaseError(error: unknown) {
  const e = error as any
  const parts = [e?.message, e?.details, e?.hint].filter(Boolean)
  return parts.length ? parts.join(' • ') : 'Unknown error'
}

function buildWordStartPatterns(q: string) {
  const s = q.trim().replace(/\s+/g, ' ')
  if (!s) return []
  return [s + '%', '% ' + s + '%']
}

async function searchMovies(q: string) {
  const patterns = buildWordStartPatterns(q)
  if (!patterns.length) return { data: [] as MovieRow[], error: null }

  const orExpr = patterns.map((p) => `title.ilike.${p}`).join(',')

  const { data, error } = await supabase.from('movies').select('id,title,year,director,poster_url').or(orExpr).limit(8)
  return { data: (data ?? []) as MovieRow[], error }
}

function PosterThumb({ poster_url, title, rot, y }: { poster_url: string | null; title: string; rot: string; y: string }) {
  const [ok, setOk] = useState(true)

  return (
    <div className={['h-20 w-14 rounded-lg bg-white/10 border border-white/20 overflow-hidden grid place-items-center', 'transform', rot, y].join(' ')}>
      {poster_url && ok ? (
        <img src={poster_url} alt={`${title} poster`} className="h-full w-full object-cover" onError={() => setOk(false)} loading="lazy" />
      ) : (
        <span>🎬</span>
      )}
    </div>
  )
}

export default function RatingSearchPage() {
  const router = useRouter()

  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const isEmpty = debounced.trim().length === 0

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [movieResults, setMovieResults] = useState<MovieRow[]>([])

  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const q = debounced.trim()
      setErrorMsg(null)

      if (!q) {
        setMovieResults([])
        return
      }

      setLoading(true)
      try {
        const { data, error } = await searchMovies(q)
        if (cancelled) return
        if (error) {
          setErrorMsg(formatSupabaseError(error))
          setMovieResults([])
        } else {
          setMovieResults(data)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced])

  return (
    <div className={`${dmMono.className} min-h-screen bg-black flex items-center justify-center p-6`}>
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="h-full flex flex-col min-h-0">
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
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-transparent outline-none text-[16px] leading-none text-black placeholder:text-black/40"
                />
              </div>
            </div>
          </div>

          <div
            className="px-5 pt-4 pb-28 flex-1 min-h-0 overflow-y-auto bg-[#4b0f0f]"
            style={{ borderTopLeftRadius: '0.9375rem', borderTopRightRadius: '0.9375rem' }}
          >
            {/* ✅ Title only */}
            <div className="text-white text-xl tracking-widest">ADD A FILM</div>
            <div className="mt-4 h-px bg-white/40" />

            {errorMsg && <div className="mt-4 rounded-xl border border-white/20 bg-black/20 p-3 text-red-200 text-sm">{errorMsg}</div>}

            {/* ✅ When empty, no popular section — just a hint */}
            {isEmpty ? (
              <div className="mt-6 text-white/70 text-sm">Search for a film to add it.</div>
            ) : (
              <div className="mt-4">
                <ul>
                  {loading && <li className="text-white/70 py-4">Searching…</li>}
                  {!loading && !errorMsg && movieResults.length === 0 && <li className="text-white/70 py-4">No results found.</li>}

                  {movieResults.map((m, i) => {
                    const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
                    const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'

                    return (
                      <li key={m.id} className="border-b border-white/40 py-6 text-sm">
                        <div className="flex items-center gap-4">
                          <PosterThumb poster_url={m.poster_url ?? null} title={m.title} rot={rot} y={y} />

                          <div className="flex-1">
                            <div className="text-white">
                              <span className="font-semibold">{m.title}</span>{' '}
                              {m.year ? <span className="text-white/80 font-normal">{m.year}, directed by</span> : null}
                            </div>
                            {m.director ? <div className="text-white/90 font-normal">{m.director}</div> : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => router.push(`/rating/${m.id}`)}
                            className="px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest"
                          >
                            ADD
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#141414] border-t border-white/10">
          <div className="h-20 px-10 flex items-center justify-between">
            <button className="text-white/80 grid place-items-center" aria-label="Home" onClick={() => router.push('/')}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              </svg>
            </button>

            <button
              className="h-10 w-16 rounded-full bg-[#141414] border border-white text-white text-2xl grid place-items-center"
              aria-label="Add"
              onClick={() => router.push('/rating/1')}
            >
              +
            </button>

            <button className="text-white/80 grid place-items-center" aria-label="Profile" onClick={() => router.push(`/personal/${MY_PROFILE_ID}`)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
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
