'use client'
import { DM_Mono } from 'next/font/google'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

const dmMono = DM_Mono({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
})

type Tab = 'films' | 'friends'
type HomeTab = 'feed' | 'picker'

// ✅ include poster_url so we can show posters in search results
type MovieRow = { id: string; title: string; year: number | null; director: string | null; poster_url?: string | null }
type FriendRow = { id: string; label: string }

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

/** “Most popular” list (titles must exist in your movies table) */
const MOST_POPULAR = [
  { title: 'Saltburn', year: '2023', director: 'Emerald Fennell' },
  { title: 'La La Land', year: '2016', director: 'Damien Chazelle' },
  { title: 'Poor Things', year: '2023', director: 'Yorgos Lanthimos' },
  { title: 'Past Lives', year: '2023', director: 'Celine Song' },
  { title: 'Challengers', year: '2024', director: 'Luca Guadagnino' },
] as const

/** Hard-coded list for the spin the wheel */
const PICKER_MOVIES = [
  'Saltburn',
  'La La Land',
  'Poor Things',
  'Past Lives',
  'Challengers',
  'Jaws',
  'Parasite',
  'E.T.',
  'Priscilla',
  'Home Alone',
] as const

// ✅ now fetch poster_url too
async function searchMovies(q: string) {
  const { data, error } = await supabase
    .from('movies')
    .select('id,title,year,director,poster_url')
    .ilike('title', `%${q}%`)
    .limit(8)

  return { data: (data ?? []) as MovieRow[], error }
}

async function searchFriends(q: string) {
  const tables = ['profiles', 'friends'] as const
  const cols = ['display_name', 'username', 'name', 'full_name'] as const

  let lastError: unknown = null

  for (const table of tables) {
    for (const col of cols) {
      const { data, error } = await supabase.from(table).select(`id,label:${col}`).ilike(col, `%${q}%`).limit(8)

      if (!error) {
        const friends = (data ?? [])
          .map((r: any) => ({ id: String(r.id), label: String(r.label ?? '') }))
          .filter((f) => f.label.length > 0) as FriendRow[]
        return { data: friends, error: null }
      }

      lastError = error
    }
  }

  return { data: [] as FriendRow[], error: lastError }
}

/** ✅ Helper: get real movie id by title (used for Most popular list) */
async function getMovieIdByTitle(title: string) {
  const { data, error } = await supabase.from('movies').select('id').eq('title', title).limit(1).maybeSingle()
  if (error) return { id: null as string | null, error }
  return { id: data?.id ? String(data.id) : null, error: null }
}

export default function Page() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className={`${dmMono.className} min-h-screen bg-black flex items-center justify-center p-6`}>
      {/* Phone frame */}
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {!searchOpen ? <HomeScreen onOpenSearch={() => setSearchOpen(true)} /> : <SearchScreen onClose={() => setSearchOpen(false)} />}

        {/* Bottom navbar */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#141414] border-t border-white/10">
          <div className="h-20 px-10 flex items-center justify-between">
            <button className="text-white/80 grid place-items-center" aria-label="Home">
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
                <path d="M5 9.5V21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              </svg>
            </button>

            <button className="h-10 w-16 rounded-full bg-[#141414] border border-white text-white text-2xl grid place-items-center" aria-label="Add">
              +
            </button>

            <button className="text-white/80 grid place-items-center" aria-label="Profile">
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

function HomeScreen({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [homeTab, setHomeTab] = useState<HomeTab>('feed')

  return (
    <div className="h-full">
      {/* Header */}
      <div className="px-5 pt-10 pb-4 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
        <div className="flex items-center justify-center gap-2">
          <span className="text-white/90 text-2xl">☆</span>
          <span className="text-white/90 text-2xl">☆</span>
          <h1 className="text-white text-2xl tracking-widest font-normal">Cinemate</h1>
          <span className="text-white/90 text-2xl">☆</span>
          <span className="text-white/90 text-2xl">☆</span>
        </div>

        {/* Search bar that opens search screen */}
        <button onClick={onOpenSearch} className="mt-4 w-full flex items-center gap-3 bg-white rounded-full px-4 py-2 mb-2">
          <span className="text-black/50 text-2xl">⌕</span>
          <span className="text-[13px] text-black/45">Find films or friends…</span>
        </button>
      </div>

      {/* Journal-style tabs */}
      <div className="px-5">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setHomeTab('feed')}
            className={
              homeTab === 'feed'
                ? 'px-6 py-2 rounded-t-2xl bg-[#4b0f0f] text-white text-sm tracking-widest shadow'
                : 'px-6 py-2 rounded-t-2xl bg-[#2a0808] text-white/80 text-sm tracking-widest'
            }
          >
            FEED
          </button>

          <button
            onClick={() => setHomeTab('picker')}
            className={
              homeTab === 'picker'
                ? 'px-6 py-2 rounded-t-2xl bg-[#4b0f0f] text-white text-sm tracking-widest shadow'
                : 'px-6 py-2 rounded-t-2xl bg-[#2a0808] text-white/80 text-sm tracking-widest'
            }
          >
            PICKER
          </button>

          <div className="flex-1" />
        </div>
      </div>

      {/* Tabs */}
      <div className="h-[calc(844px-(10rem))]">{homeTab === 'feed' ? <FeedTab /> : <PickerTab />}</div>
    </div>
  )
}

function FeedTab() {
  return (
    <div className="bg-[#4b0f0f] h-full px-5 pt-6 pb-28 text-white">
      <h2 className="text-sm tracking-widest mb-4">Your recommendations</h2>

      <div className="flex gap-4 overflow-x-auto overflow-y-visible pb-6 pt-4 pl-2 pr-2">
        {Array.from({ length: 4 }).map((_, i) => {
          const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
          const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'
          return <div key={i} className={['h-28 w-20 shrink-0 rounded-xl bg-white/10 border border-white', 'transform', rot, y].join(' ')} />
        })}
      </div>

      <div
        className="mt-6 -mx-5 relative h-24 overflow-hidden bg-repeat-x"
        style={{
          backgroundImage: "url('/filmroll.jpg')",
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'left center',
          backgroundSize: 'auto 100%',
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10">
          <div className="text-black text-sm tracking-widest uppercase">This week’s mood</div>
          <div className="text-black text-xs font-normal mt-1 italic">Ugly cry night 😭</div>
        </div>
      </div>

      <h2 className="mt-8 text-sm tracking-widest mb-4">Friend’s recommendations</h2>

      <div className="flex gap-4 overflow-x-auto overflow-y-visible pb-6 pt-4 pl-2 pr-2">
        {Array.from({ length: 4 }).map((_, i) => {
          const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
          const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'
          return <div key={i} className={['h-28 w-20 shrink-0 rounded-xl bg-white/10 border border-white', 'transform', rot, y].join(' ')} />
        })}
      </div>
    </div>
  )
}

function PickerTab() {
  const items = PICKER_MOVIES
  const ITEM_H = 44
  const VISIBLE = 5
  const containerH = ITEM_H * VISIBLE

  const listRef = useRef<HTMLDivElement | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = selectedIndex * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollTop / ITEM_H)
        setSelectedIndex(Math.max(0, Math.min(items.length - 1, idx)))
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
    }
  }, [items.length])

  const selected = items[selectedIndex]

  const snapTo = (idx: number) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
  }

  return (
    <div className="bg-[#4b0f0f] h-full px-5 pt-6 pb-28 text-white">
      <h2 className="text-xl tracking-widest mb-4">Movie picker</h2>

      <div className="relative mx-auto w-full max-w-[320px]">
        <div className="rounded-2xl border border-white/15 bg-black/15 overflow-hidden" style={{ height: containerH }}>
          <div ref={listRef} className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none" style={{ paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2 }}>
            {items.map((name, i) => (
              <button key={name} type="button" onClick={() => snapTo(i)} className="w-full snap-start" style={{ height: ITEM_H }}>
                <div className={['h-full flex items-center justify-center', i === selectedIndex ? 'text-white text-lg' : 'text-white/55'].join(' ')}>
                  {name}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute left-0 right-0 border-y border-white/30 bg-white/5" style={{ top: ITEM_H * 2, height: ITEM_H }} />
      </div>

      <div className="mt-6 rounded-2xl bg-black/15 border border-white/15 p-4">
        <div className="text-white/70 text-sm">Tonight’s pick</div>
        <div className="text-white text-2xl font-semibold mt-1">{selected}</div>

        <div className="mt-4 flex gap-3">
          <button
            className="flex-1 rounded-full bg-black/55 border border-white/20 py-3 text-sm tracking-widest"
            onClick={() => {
              const idx = Math.floor(Math.random() * items.length)
              snapTo(idx)
            }}
          >
            PICK
          </button>

          <button className="rounded-full bg-black/25 border border-white/20 px-5 py-3 text-sm tracking-widest">SAVE</button>
        </div>
      </div>
    </div>
  )
}

function SearchScreen({ onClose }: { onClose: () => void }) {
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('films')
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [movieResults, setMovieResults] = useState<MovieRow[]>([])
  const [friendResults, setFriendResults] = useState<FriendRow[]>([])

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const isEmpty = debounced.trim().length === 0

  useEffect(() => {
    let cancelled = false

    async function run() {
      const q = debounced.trim()
      setErrorMsg(null)

      if (!q) {
        setMovieResults([])
        setFriendResults([])
        return
      }

      setLoading(true)
      try {
        if (tab === 'films') {
          const { data, error } = await searchMovies(q)
          if (cancelled) return
          if (error) {
            setErrorMsg(formatSupabaseError(error))
            setMovieResults([])
          } else {
            setMovieResults(data)
          }
        } else {
          const { data, error } = await searchFriends(q)
          if (cancelled) return
          if (error) {
            setErrorMsg(formatSupabaseError(error))
            setFriendResults([])
          } else {
            setFriendResults(data)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [debounced, tab])

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header (matches home) */}
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
            onClick={onClose}
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
        <div className="flex gap-4">
          <button
            onClick={() => setTab('films')}
            className={
              tab === 'films'
                ? 'px-5 py-2 rounded-full bg-black/55 text-white text-sm tracking-wide'
                : 'px-5 py-2 rounded-full bg-transparent text-white/80 text-sm tracking-wide'
            }
          >
            FILMS
          </button>

          <button
            onClick={() => setTab('friends')}
            className={
              tab === 'friends'
                ? 'px-5 py-2 rounded-full bg-black/55 text-white text-sm tracking-wide'
                : 'px-5 py-2 rounded-full bg-transparent text-white/80 text-sm tracking-wide'
            }
          >
            FRIENDS
          </button>
        </div>

        <div className="mt-6 text-white text-xl tracking-widest">{tab === 'films' ? 'Most popular' : 'People'}</div>
        <div className="mt-4 h-px bg-white/40" />

        {errorMsg && <div className="mt-4 rounded-xl border border-white/20 bg-black/20 p-3 text-red-200 text-sm">{errorMsg}</div>}

        <div className="mt-4">
          {/* ✅ Most popular shows posters from DB by title */}
          {tab === 'films' && isEmpty && (
            <ul>
              {MOST_POPULAR.map((m, i) => {
                const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
                const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'

                return (
                  <PopularMovieRow
                    key={m.title}
                    title={m.title}
                    year={m.year}
                    director={m.director}
                    rot={rot}
                    y={y}
                    onMore={async () => {
                      const { id } = await getMovieIdByTitle(m.title)
                      if (id) router.push(`/movie/${id}`)
                    }}
                  />
                )
              })}
            </ul>
          )}

          {/* ✅ Live search shows posters from movieResults.poster_url */}
          {tab === 'films' && !isEmpty && (
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

                      <button onClick={() => router.push(`/movie/${m.id}`)} className="px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest">
                        MORE
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {tab === 'friends' && (
            <ul>
              {isEmpty && <li className="text-white/70 py-4 text-sm">Type a name to search people…</li>}
              {!isEmpty && loading && <li className="text-white/70 py-4">Searching…</li>}
              {!isEmpty && !loading && !errorMsg && friendResults.length === 0 && <li className="text-white/70 py-4">No results found.</li>}

              {friendResults.map((f, i) => {
                const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
                const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'

                return (
                  <li key={f.id} className="border-b border-white/40 py-6">
                    <div className="flex items-center gap-4">
                      <div className={['h-12 w-12 rounded-full bg-white/10 border border-white/20 grid place-items-center', 'transform', rot, y].join(' ')}>
                        👤
                      </div>

                      <div className="flex-1">
                        <div className="text-white font-semibold">{f.label}</div>
                        <div className="text-white/80 text-sm font-normal">Friend</div>
                      </div>

                      <button onClick={() => router.push(`/profile/${f.id}`)} className="px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest">
                        MORE
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
  )
}

/* ---------- small components for posters ---------- */

function PosterThumb({
  poster_url,
  title,
  rot,
  y,
}: {
  poster_url: string | null
  title: string
  rot: string
  y: string
}) {
  const [ok, setOk] = useState(true)

  return (
    <div className={['h-20 w-14 rounded-lg bg-white/10 border border-white/20 overflow-hidden grid place-items-center', 'transform', rot, y].join(' ')}>
      {poster_url && ok ? (
        <img
          src={poster_url}
          alt={`${title} poster`}
          className="h-full w-full object-cover"
          onError={() => setOk(false)}
          loading="lazy"
        />
      ) : (
        <span>🎬</span>
      )}
    </div>
  )
}

function PopularMovieRow({
  title,
  year,
  director,
  rot,
  y,
  onMore,
}: {
  title: string
  year: string
  director: string
  rot: string
  y: string
  onMore: () => void
}) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [ok, setOk] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const { data } = await supabase.from('movies').select('poster_url').eq('title', title).limit(1).maybeSingle()
      if (cancelled) return
      setPosterUrl((data as any)?.poster_url ?? null)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [title])

  return (
    <li className="border-b border-white/40 py-6 text-sm">
      <div className="flex items-center gap-4">
        <div className={['h-20 w-14 rounded-lg bg-white/10 border border-white/20 overflow-hidden grid place-items-center', 'transform', rot, y].join(' ')}>
          {posterUrl && ok ? (
            <img
              src={posterUrl}
              alt={`${title} poster`}
              className="h-full w-full object-cover"
              onError={() => setOk(false)}
              loading="lazy"
            />
          ) : (
            <span>🎬</span>
          )}
        </div>

        <div className="flex-1">
          <div className="text-white">
            <span className="font-semibold">{title}</span> <span className="text-white/80 font-normal">{year}, directed by</span>
          </div>
          <div className="text-white/90 font-normal">{director}</div>
        </div>

        <button onClick={onMore} className="px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest">
          MORE
        </button>
      </div>
    </li>
  )
}

/* ---------- scrollbar utility ---------- */

declare global {
  // eslint-disable-next-line no-var
  var __scrollbar_none_added: boolean | undefined
}

if (typeof window !== 'undefined' && !globalThis.__scrollbar_none_added) {
  globalThis.__scrollbar_none_added = true
  const style = document.createElement('style')
  style.innerHTML = `
    .scrollbar-none::-webkit-scrollbar { display: none; }
    .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
  `
  document.head.appendChild(style)
}
