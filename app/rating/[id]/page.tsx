'use client'

import { DM_Mono } from 'next/font/google'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const dmMono = DM_Mono({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
})

type MovieRow = {
  id: string // keep as string for UI + routing; we convert to Number() when saving
  title: string
  year: number | null
  director: string | null
  poster_url?: string | null
}

const MY_PROFILE_ID = '8c2d4b5a-1b6d-4c7a-9d26-5c4f73f2a9c1'
const RED = '#4b0f0f'

function formatSupabaseError(error: unknown) {
  const e = error as any
  const parts = [e?.message, e?.details, e?.hint].filter(Boolean)
  return parts.length ? parts.join(' • ') : 'Unknown error'
}

function yyyyMmDdToday() {
  return new Date().toISOString().slice(0, 10)
}

function formatPrettyDate(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt)
}

function Star({
  filled,
  hovered,
  onClick,
  onHover,
  onLeave,
}: {
  filled: boolean
  hovered: boolean
  onClick: () => void
  onHover: () => void
  onLeave: () => void
}) {
  const isHover = hovered && !filled
  const isFilled = filled

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      aria-label="star"
      className="p-1 cursor-pointer transition-transform duration-150 hover:scale-105"
    >
      <svg viewBox="0 0 24 24" width="24" height="24" style={{ display: 'block' }}>
        <path
          d="M12 2.6l2.9 6.2 6.8.6-5.2 4.5 1.6 6.7L12 17.8 5.9 20.6l1.6-6.7-5.2-4.5 6.8-.6L12 2.6z"
          fill={isFilled ? '#ffffff' : isHover ? 'rgba(255,255,255,0.25)' : 'none'}
          stroke="#ffffff"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

export default function RatingPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const movieId = useMemo(() => String(params?.id ?? ''), [params])

  const [movie, setMovie] = useState<MovieRow | null>(null)
  const [loadingMovie, setLoadingMovie] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [watchedOn, setWatchedOn] = useState<string>(yyyyMmDdToday())
  const [rating, setRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const dateInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!movieId) return
      setLoadingMovie(true)
      setErrorMsg(null)

      // movies.id is bigint, but eq() is fine with a numeric string
      const { data, error } = await supabase
        .from('movies')
        .select('id,title,year,director,poster_url')
        .eq('id', movieId)
        .single()

      if (cancelled) return

      if (error) {
        setErrorMsg(formatSupabaseError(error))
        setMovie(null)
      } else {
        setMovie({
          id: String(data.id),
          title: data.title,
          year: data.year ?? null,
          director: data.director ?? null,
          poster_url: data.poster_url ?? null,
        })
      }

      setLoadingMovie(false)
    })()

    return () => {
      cancelled = true
    }
  }, [movieId])

  async function onSave() {
    if (!movie) return
    if (!rating) {
      setErrorMsg('Please choose a rating.')
      return
    }

    const movieIdNum = Number(movie.id)
    if (!Number.isFinite(movieIdNum)) {
      setErrorMsg('Invalid movie id.')
      return
    }

    setSaving(true)
    setErrorMsg(null)

    try {
      const payload = {
        profile_id: MY_PROFILE_ID,
        movie_id: movieIdNum, // ✅ bigint -> number
        watched_on: watchedOn, // date
        rating, // int 1-5
      }

      // ✅ save into movie_ratings (your new table)
   const { error } = await supabase
  .from('movie_ratings')
  .upsert(payload, { onConflict: 'profile_id,movie_id' })


      if (error) {
        setErrorMsg(formatSupabaseError(error))
        return
      }

      // ✅ go to your films list
      router.push('/list')
    } finally {
      setSaving(false)
    }
  }

  function openDatePicker() {
    const el = dateInputRef.current
    if (!el) return
    el.focus()
    ;(el as any).showPicker?.() ?? el.click()
  }

  return (
    <div className={`${dmMono.className} min-h-screen bg-black flex items-center justify-center p-6`}>
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex flex-col">
        {/* NAVBAR */}
        <div className="px-5 pt-10 pb-5 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
          <div className="flex items-center justify-center gap-2">
            <span className="text-white/90 text-2xl">☆</span>
            <span className="text-white/90 text-2xl">☆</span>
            <h1 className="text-white text-2xl tracking-widest font-normal">Cinemate</h1>
            <span className="text-white/90 text-2xl">☆</span>
            <span className="text-white/90 text-2xl">☆</span>
          </div>
        </div>

        {/* BODY */}
        <div
          className="flex-1 flex flex-col relative"
          style={{
            backgroundColor: RED,
            borderTopLeftRadius: '0.9375rem',
            borderTopRightRadius: '0.9375rem',
          }}
        >
          {/* TOP BAR */}
          <div className="px-6 h-20 flex items-center border-y border-white/20" style={{ backgroundColor: RED }}>
            <button type="button" onClick={() => router.back()} className="text-white text-sm leading-none">
              Cancel
            </button>

            <div className="flex-1 text-center text-white text-base tracking-wide font-medium leading-none">
              I watched...
            </div>

            <button
              type="button"
              onClick={onSave}
              disabled={saving || loadingMovie || !movie}
              className={['text-base font-semibold leading-none', saving ? 'text-white/60' : 'text-white'].join(' ')}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* MOVIE STRIP */}
          <div className="px-6 py-6 border-b border-white/20 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
            {loadingMovie ? (
              <div className="text-white/70">Loading…</div>
            ) : movie ? (
              <div className="flex items-center gap-4">
                <div className="h-12 w-9 rounded-lg overflow-hidden border border-white/20 bg-white/10 grid place-items-center">
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      className="h-full w-full object-cover -rotate-6 scale-110"
                    />
                  ) : (
                    <span className="text-white/80">🎬</span>
                  )}
                </div>

                <div className="text-white">
                  <div className="text-xs font-semibold leading-snug">{movie.title}</div>
                  <div className="text-white/80 text-xs">{movie.year ?? ''}</div>
                </div>
              </div>
            ) : (
              <div className="text-red-200">{errorMsg ?? 'Movie not found.'}</div>
            )}
          </div>

          {/* FORM AREA */}
          <div className="flex-1 py-6 overflow-y-auto" style={{ backgroundColor: RED }}>
            {errorMsg && (
              <div className="mb-4 rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-red-200 text-sm">
                {errorMsg}
              </div>
            )}

            {/* DATE ROW */}
            <div className="-mx-6 border-b border-white/20">
              <div className="px-6 py-5 flex items-center relative">
                <div className="text-white text-base mb-4">Date</div>
                <div className="flex-1" />

                <button type="button" onClick={openDatePicker} className="text-white/90 text-sm mb-4">
                  {formatPrettyDate(watchedOn)}
                </button>

                <input
                  ref={dateInputRef}
                  type="date"
                  value={watchedOn}
                  onChange={(e) => {
                    setWatchedOn(e.target.value)
                    requestAnimationFrame(() => dateInputRef.current?.blur())
                  }}
                  className="absolute inset-0 opacity-0"
                  aria-label="Pick date"
                />
              </div>
            </div>

            {/* RATE ROW */}
            <div className="-mx-6 border-b border-white/20">
              <div className="px-6 py-5">
                <div className="text-white text-base mb-3 mt-4">Rate</div>

                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const v = i + 1
                    return (
                      <Star
                        key={v}
                        filled={v <= rating}
                        hovered={hoverRating !== null && v <= hoverRating}
                        onClick={() => setRating(v)}
                        onHover={() => setHoverRating(v)}
                        onLeave={() => setHoverRating(null)}
                      />
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="h-10" />
          </div>

          {/* BOTTOM NAV */}
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#141414] border-t border-white/10">
            <div className="h-20 px-10 flex items-center justify-between">
              <button className="text-white/80 grid place-items-center" aria-label="Home" onClick={() => router.push('/')}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5 9.5V21a1 1 0 0 0 1 1h12a 1 1 0 0 0 1-1V9.5" />
                </svg>
              </button>

              <button className="h-10 w-16 rounded-full bg-[#141414] border border-white text-white text-2xl grid place-items-center" aria-label="Add">
                +
              </button>

              <button
                className="text-white/80 grid place-items-center"
                aria-label="Profile"
                onClick={() => router.push(`/personal/${MY_PROFILE_ID}`)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
