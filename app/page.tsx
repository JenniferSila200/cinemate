'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Tab = 'films' | 'friends'
type HomeTab = 'feed' | 'picker'

type MovieRow = { id: string; title: string }
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

/** Hard-coded “Most popular” list (for Search screen) */
const MOST_POPULAR = [
  { id: 'p1', title: 'Saltburn', year: '2023', director: 'Emerald Fennell' },
  { id: 'p2', title: 'La La Land', year: '2016', director: 'Damien Chazelle' },
  { id: 'p3', title: 'Poor Things', year: '2023', director: 'Yorgos Lanthimos' },
  { id: 'p4', title: 'Past Lives', year: '2023', director: 'Celine Song' },
  { id: 'p5', title: 'Challengers', year: '2024', director: 'Luca Guadagnino' },
] as const

/** Hard-coded list for the PICKER wheel */
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

async function searchMovies(q: string) {
  const { data, error } = await supabase
    .from('movies')
    .select('id,title')
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
      const { data, error } = await supabase
        .from(table)
        .select(`id,label:${col}`)
        .ilike(col, `%${q}%`)
        .limit(8)

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

export default function Page() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      {/* Phone frame */}
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {!searchOpen ? (
          <HomeScreen onOpenSearch={() => setSearchOpen(true)} />
        ) : (
          <SearchScreen onClose={() => setSearchOpen(false)} />
        )}

        {/* Bottom navbar*/}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#141414] border-t border-white/10">
          <div className="h-20 px-10 flex items-center justify-between">
            <button className="text-white/80 text-2xl" aria-label="Home">
              ⌂
            </button>

            <button
              className="h-14 w-14 rounded-full bg-black/60 border border-white/20 text-white text-2xl grid place-items-center"
              aria-label="Add"
            >
              +
            </button>

            <button className="text-white/80 text-2xl" aria-label="Profile">
              👤
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
          <span className="text-white/90">☆</span>
          <h1 className="text-white text-3xl tracking-widest font-semibold">Cinemate</h1>
          <span className="text-white/90">☆</span>
        </div>

        {/* Search bar that opens search screen */}
        <button
          onClick={onOpenSearch}
          className="mt-4 w-full flex items-center gap-3 bg-white rounded-full px-4 py-3"
        >
          <span className="text-black/50">⌕</span>
          <span className="text-[15px] text-black/45">Find films or friends…</span>
        </button>
      </div>

      {/* Journal-style tabs */}
      <div className="px-5">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setHomeTab('feed')}
            className={
              homeTab === 'feed'
                ? 'px-6 py-3 rounded-t-2xl bg-[#4b0f0f] text-white text-sm tracking-widest shadow'
                : 'px-6 py-3 rounded-t-2xl bg-[#2a0808] text-white/80 text-sm tracking-widest'
            }
          >
            FEED
          </button>

          <button
            onClick={() => setHomeTab('picker')}
            className={
              homeTab === 'picker'
                ? 'px-6 py-3 rounded-t-2xl bg-[#4b0f0f] text-white text-sm tracking-widest shadow'
                : 'px-6 py-3 rounded-t-2xl bg-[#2a0808] text-white/80 text-sm tracking-widest'
            }
          >
            PICKER
          </button>

          <div className="flex-1" />
        </div>
      </div>

      {/* Tabs */}
      <div className="h-[calc(844px- (10rem))]">
        {homeTab === 'feed' ? <FeedTab /> : <PickerTab />}
      </div>
    </div>
  )
}

function FeedTab() {
  return (
    <div className="bg-[#4b0f0f] h-full px-5 pt-6 pb-28 text-white">
      <h2 className="text-xl tracking-widest mb-4">Your recommendations</h2>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 w-24 shrink-0 rounded-2xl bg-white/10 border border-white/10"
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-black/15 border border-white/15 p-4">
        <div className="text-white/70 text-sm">This week’s mood</div>
        <div className="text-white text-lg font-semibold">Ugly cry night 😭</div>
      </div>

      <h2 className="mt-8 text-xl tracking-widest mb-4">Friend’s recommendations</h2>

      <div className="flex gap-4 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 w-24 shrink-0 rounded-2xl bg-white/10 border border-white/10"
          />
        ))}
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
        <div
          className="rounded-2xl border border-white/15 bg-black/15 overflow-hidden"
          style={{ height: containerH }}
        >
          <div
            ref={listRef}
            className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
            style={{
              paddingTop: ITEM_H * 2,
              paddingBottom: ITEM_H * 2,
            }}
          >
            {items.map((name, i) => (
              <button
                key={name}
                type="button"
                onClick={() => snapTo(i)}
                className="w-full snap-start"
                style={{ height: ITEM_H }}
              >
                <div
                  className={[
                    'h-full flex items-center justify-center',
                    i === selectedIndex ? 'text-white text-lg' : 'text-white/55',
                  ].join(' ')}
                >
                  {name}
                </div>
              </button>
            ))}
          </div>
        </div>

      
        <div
          className="pointer-events-none absolute left-0 right-0 border-y border-white/30 bg-white/5"
          style={{ top: ITEM_H * 2, height: ITEM_H }}
        />
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

          <button className="rounded-full bg-black/25 border border-white/20 px-5 py-3 text-sm tracking-widest">
            SAVE
          </button>
        </div>
      </div>
    </div>
  )
}

function SearchScreen({ onClose }: { onClose: () => void }) {
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
    <div className="h-full">
      <div className="px-5 pt-10 pb-5 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
        <div className="flex items-center justify-center gap-2">
          <span className="text-white/90">☆</span>
          <h1 className="text-white text-3xl tracking-widest font-semibold">Cinemate</h1>
          <span className="text-white/90">☆</span>
        </div>

        <div className="mt-4 relative">
          <button
            onClick={onClose}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-14 w-14 rounded-full bg-[#4b0f0f] shadow flex items-center justify-center text-white text-2xl"
            aria-label="Back"
          >
            ‹
          </button>

          <div className="bg-white rounded-full pl-16 pr-4 py-3 flex items-center">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent outline-none text-[15px] text-black placeholder:text-black/40"
            />
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-28 h-full bg-[#4b0f0f]">
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

        <div className="mt-6 text-white text-2xl tracking-widest">
          {tab === 'films' ? 'Most popular' : 'People'}
        </div>

        <div className="mt-4 h-px bg-white/40" />

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-white/20 bg-black/20 p-3 text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="mt-4">
          {tab === 'films' && isEmpty && (
            <ul>
              {MOST_POPULAR.map((m) => (
                <li key={m.id} className="border-b border-white/40 py-6">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-14 rounded-lg bg-white/10 border border-white/20 grid place-items-center">
                      🎬
                    </div>

                    <div className="flex-1">
                      <div className="text-white font-semibold">
                        {m.title} <span className="text-white/80">{m.year}</span>, directed
                      </div>
                      <div className="text-white/90">{m.director}</div>
                    </div>

                    <button className="px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest">
                      MORE
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === 'films' && !isEmpty && (
            <ul>
              {loading && <li className="text-white/70 py-4">Searching…</li>}

              {!loading && !errorMsg && movieResults.length === 0 && (
                <li className="text-white/70 py-4">No results found.</li>
              )}

              {movieResults.map((m) => (
                <li key={m.id} className="border-b border-white/40 py-6">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-14 rounded-lg bg-white/10 border border-white/20 grid place-items-center">
                      🎬
                    </div>

                    <div className="flex-1">
                      <div className="text-white font-semibold">{m.title}</div>
                      <div className="text-white/80 text-sm">Movie</div>
                    </div>

                    <button className="px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest">
                      MORE
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === 'friends' && (
            <ul>
              {isEmpty && <li className="text-white/70 py-4">Type a name to search people…</li>}

              {!isEmpty && loading && <li className="text-white/70 py-4">Searching…</li>}

              {!isEmpty && !loading && !errorMsg && friendResults.length === 0 && (
                <li className="text-white/70 py-4">No results found.</li>
              )}

              {friendResults.map((f) => (
                <li key={f.id} className="border-b border-white/40 py-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-white/10 border border-white/20 grid place-items-center">
                      👤
                    </div>

                    <div className="flex-1">
                      <div className="text-white font-semibold">{f.label}</div>
                      <div className="text-white/80 text-sm">Friend</div>
                    </div>

                    <button className="px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest">
                      MORE
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}


declare global {

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
