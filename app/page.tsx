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

type MovieRow = { id: string; title: string; year: number | null; director: string | null; poster_url?: string | null }
type FriendRow = { id: string; label: string; avatar_url?: string | null }

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

const MY_PROFILE_ID = '8c2d4b5a-1b6d-4c7a-9d26-5c4f73f2a9c1'


async function searchMovies(q: string) {
  const { data, error } = await supabase.from('movies').select('id,title,year,director,poster_url').ilike('title', `%${q}%`).limit(8)
  return { data: (data ?? []) as MovieRow[], error }
}


async function searchFriends(q: string) {
  const tables = ['profiles', 'friends'] as const
  const cols = ['display_name', 'username', 'name', 'full_name'] as const

  let lastError: unknown = null

  for (const table of tables) {
    for (const col of cols) {
 
      const selectStr = table === 'profiles' ? `id,label:${col},avatar_url` : `id,label:${col}`
      const { data, error } = await supabase.from(table).select(selectStr).ilike(col, `%${q}%`).limit(8)

      if (!error) {
        const friends = (data ?? [])
          .map((r: any) => ({
            id: String(r.id),
            label: String(r.label ?? ''),
            avatar_url: table === 'profiles' ? (r.avatar_url ?? null) : null,
          }))
          .filter((f: FriendRow) => f.label.length > 0) as FriendRow[]
        return { data: friends, error: null }
      }

      lastError = error
    }
  }

  return { data: [] as FriendRow[], error: lastError }
}


async function fetchMostPopularMovies() {
  const { data, error } = await supabase
    .from('movies')
    .select('id,title,year,director,poster_url')
    .not('poster_url', 'is', null)
    .order('title', { ascending: true })
    .limit(5)

  return { data: (data ?? []) as MovieRow[], error }
}


async function fetchRecommendedFromTaste(profileId: string, limit = 8) {
  const { data: favRows, error: favErr } = await supabase.from('favourite_movies').select('movie_id').eq('profile_id', profileId)
  if (favErr) return { data: [] as MovieRow[], error: favErr }

  const { data: pbRows, error: pbErr } = await supabase.from('pinboards').select('id').eq('profile_id', profileId)
  if (pbErr) return { data: [] as MovieRow[], error: pbErr }

  const pbIds = (pbRows ?? []).map((r: any) => String(r.id))

  let pbMovieRows: Array<{ movie_id: string }> = []
  if (pbIds.length) {
    const { data, error } = await supabase.from('pinboard_movies').select('movie_id').in('pinboard_id', pbIds)
    if (error) return { data: [] as MovieRow[], error }
    pbMovieRows = (data ?? []).map((r: any) => ({ movie_id: String(r.movie_id) }))
  }

  const seenIds = new Set<string>([
    ...(favRows ?? []).map((r: any) => String(r.movie_id)),
    ...pbMovieRows.map((r) => String(r.movie_id)),
  ])

  const seedIds = Array.from(seenIds)
  if (!seedIds.length) return { data: [] as MovieRow[], error: null }

  const { data: seedMovies, error: seedErr } = await supabase.from('movies').select('id,director').in('id', seedIds)
  if (seedErr) return { data: [] as MovieRow[], error: seedErr }

  const directors = Array.from(
    new Set(
      (seedMovies ?? [])
        .map((m: any) => (m.director ? String(m.director).trim() : ''))
        .filter((d: string) => d.length > 0)
    )
  )
  if (!directors.length) return { data: [] as MovieRow[], error: null }

  const { data: candidates, error: candErr } = await supabase.from('movies').select('id,title,year,director,poster_url').in('director', directors).limit(60)
  if (candErr) return { data: [] as MovieRow[], error: candErr }

  const filtered = (candidates ?? [])
    .map((m: any) => ({
      id: String(m.id),
      title: m.title,
      year: m.year ?? null,
      director: m.director ?? null,
      poster_url: m.poster_url ?? null,
    }))
    .filter((m: MovieRow) => !seenIds.has(m.id))

  const withPoster = filtered.filter((m) => !!m.poster_url)
  const withoutPoster = filtered.filter((m) => !m.poster_url)

  const shuffle = <T,>(arr: T[]) => arr.sort(() => Math.random() - 0.5)
  const picked = [...shuffle(withPoster), ...shuffle(withoutPoster)].slice(0, limit)

  return { data: picked as MovieRow[], error: null }
}

/**
 * ✅ Friend’s recommendations
 * Pull films friends (people you follow) have added to favourites OR pinboards.
 */
async function fetchFriendsRecommendations(profileId: string, limit = 12) {
  const { data: follows, error: fErr } = await supabase.from('follows').select('following_id').eq('follower_id', profileId)
  if (fErr) return { data: [] as MovieRow[], error: fErr }

  const friendIds = (follows ?? []).map((r: any) => String(r.following_id)).filter(Boolean)
  if (!friendIds.length) return { data: [] as MovieRow[], error: null }

  const { data: favs, error: favErr } = await supabase.from('favourite_movies').select('profile_id,movie_id').in('profile_id', friendIds)
  if (favErr) return { data: [] as MovieRow[], error: favErr }

  const { data: pbs, error: pbErr } = await supabase.from('pinboards').select('id,profile_id').in('profile_id', friendIds)
  if (pbErr) return { data: [] as MovieRow[], error: pbErr }

  const pbIds = (pbs ?? []).map((r: any) => String(r.id)).filter(Boolean)

  let pbMovies: Array<{ movie_id: string }> = []
  if (pbIds.length) {
    const { data, error } = await supabase.from('pinboard_movies').select('movie_id,pinboard_id').in('pinboard_id', pbIds)
    if (error) return { data: [] as MovieRow[], error }
    pbMovies = (data ?? []).map((r: any) => ({ movie_id: String(r.movie_id) })).filter((r) => !!r.movie_id)
  }

  const movieIds = Array.from(
    new Set<string>([
      ...(favs ?? []).map((r: any) => String(r.movie_id)).filter(Boolean),
      ...pbMovies.map((r) => r.movie_id),
    ])
  )

  if (!movieIds.length) return { data: [] as MovieRow[], error: null }

  const { data: movies, error: mErr } = await supabase.from('movies').select('id,title,year,director,poster_url').in('id', movieIds).limit(80)
  if (mErr) return { data: [] as MovieRow[], error: mErr }

  const rows: MovieRow[] = (movies ?? []).map((m: any) => ({
    id: String(m.id),
    title: m.title,
    year: m.year ?? null,
    director: m.director ?? null,
    poster_url: m.poster_url ?? null,
  }))

  const withPoster = rows.filter((m) => !!m.poster_url)
  const withoutPoster = rows.filter((m) => !m.poster_url)
  const shuffle = <T,>(arr: T[]) => arr.sort(() => Math.random() - 0.5)
  const picked = [...shuffle(withPoster), ...shuffle(withoutPoster)].slice(0, limit)

  return { data: picked, error: null }
}

export default function Page() {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)

  
  const [followTick, setFollowTick] = useState(0)
  const bumpFollowTick = () => setFollowTick((n) => n + 1)

  return (
    <div className={`${dmMono.className} min-h-screen bg-black flex items-center justify-center p-6`}>
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {!searchOpen ? (
          <HomeScreen onOpenSearch={() => setSearchOpen(true)} followTick={followTick} />
        ) : (
          <SearchScreen onClose={() => setSearchOpen(false)} onFollowChanged={bumpFollowTick} />
        )}

        <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#141414] border-t border-white/10">
          <div className="h-20 px-10 flex items-center justify-between">
            <button className="text-white/80 grid place-items-center" aria-label="Home">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              </svg>
            </button>

            <button className="h-10 w-16 rounded-full bg-[#141414] border border-white text-white text-2xl grid place-items-center" aria-label="Add">
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

function HomeScreen({ onOpenSearch, followTick }: { onOpenSearch: () => void; followTick: number }) {
  const [homeTab, setHomeTab] = useState<HomeTab>('feed')

  return (
    <div className="h-full">
      <div className="px-5 pt-10 pb-4 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
        <div className="flex items-center justify-center gap-2">
          <span className="text-white/90 text-2xl">☆</span>
          <span className="text-white/90 text-2xl">☆</span>
          <h1 className="text-white text-2xl tracking-widest font-normal">Cinemate</h1>
          <span className="text-white/90 text-2xl">☆</span>
          <span className="text-white/90 text-2xl">☆</span>
        </div>

        <button onClick={onOpenSearch} className="mt-4 w-full flex items-center gap-3 bg-white rounded-full px-4 py-2 mb-2">
          <span className="text-black/50 text-2xl">⌕</span>
          <span className="text-[13px] text-black/45">Find films or friends…</span>
        </button>
      </div>

      <div className="px-5">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setHomeTab('feed')}
            className={homeTab === 'feed' ? 'px-6 py-2 rounded-t-2xl bg-[#4b0f0f] text-white text-sm tracking-widest shadow' : 'px-6 py-2 rounded-t-2xl bg-[#2a0808] text-white/80 text-sm tracking-widest'}
          >
            FEED
          </button>

          <button
            onClick={() => setHomeTab('picker')}
            className={homeTab === 'picker' ? 'px-6 py-2 rounded-t-2xl bg-[#4b0f0f] text-white text-sm tracking-widest shadow' : 'px-6 py-2 rounded-t-2xl bg-[#2a0808] text-white/80 text-sm tracking-widest'}
          >
            PICKER
          </button>

          <div className="flex-1" />
        </div>
      </div>

      <div className="h-[calc(844px-(10rem))]">{homeTab === 'feed' ? <FeedTab followTick={followTick} /> : <PickerTab />}</div>
    </div>
  )
}

function FeedTab({ followTick }: { followTick: number }) {
  const router = useRouter()

  const [yourRecs, setYourRecs] = useState<MovieRow[]>([])
  const [loadingRecs, setLoadingRecs] = useState(true)
  const [recsErr, setRecsErr] = useState<string | null>(null)

  const [friendRecs, setFriendRecs] = useState<MovieRow[]>([])
  const [loadingFriendRecs, setLoadingFriendRecs] = useState(true)
  const [friendErr, setFriendErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingRecs(true)
      setRecsErr(null)
      try {
        const { data, error } = await fetchRecommendedFromTaste(MY_PROFILE_ID, 8)
        if (cancelled) return
        if (error) {
          setYourRecs([])
          setRecsErr(formatSupabaseError(error))
        } else {
          setYourRecs(data)
        }
      } finally {
        if (!cancelled) setLoadingRecs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingFriendRecs(true)
      setFriendErr(null)
      try {
        const { data, error } = await fetchFriendsRecommendations(MY_PROFILE_ID, 12)
        if (cancelled) return
        if (error) {
          setFriendRecs([])
          setFriendErr(formatSupabaseError(error))
        } else {
          setFriendRecs(data)
        }
      } finally {
        if (!cancelled) setLoadingFriendRecs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [followTick])

  return (
    <div className="bg-[#4b0f0f] h-full px-5 pt-6 pb-28 text-white">
      <h2 className="text-sm tracking-widest mb-4">Your recommendations</h2>

      {recsErr && <div className="mb-4 rounded-xl border border-white/20 bg-black/20 p-3 text-red-200 text-sm">{recsErr}</div>}

      <div className="flex gap-4 overflow-x-auto overflow-y-visible pb-6 pt-4 pl-2 pr-2 [-webkit-overflow-scrolling:touch]">
        {loadingRecs && !yourRecs.length
          ? Array.from({ length: 6 }).map((_, i) => {
              const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
              const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'
              return <div key={i} className={['h-28 w-20 shrink-0 rounded-xl bg-white/10 border border-white', 'transform', rot, y].join(' ')} />
            })
          : yourRecs.map((m, i) => {
              const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
              const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'
              return <MoviePosterCard key={m.id} movie={m} className={[rot, y].join(' ')} onClick={() => router.push(`/movie/${m.id}`)} />
            })}

        {!loadingRecs && !recsErr && yourRecs.length === 0 && <div className="text-white/70 text-sm">No recommendations yet.</div>}
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

      {friendErr && <div className="mb-4 rounded-xl border border-white/20 bg-black/20 p-3 text-red-200 text-sm">{friendErr}</div>}

      <div className="flex gap-4 overflow-x-auto overflow-y-visible pb-6 pt-4 pl-2 pr-2">
        {loadingFriendRecs && !friendRecs.length
          ? Array.from({ length: 6 }).map((_, i) => {
              const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
              const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'
              return <div key={i} className={['h-28 w-20 shrink-0 rounded-xl bg-white/10 border border-white', 'transform', rot, y].join(' ')} />
            })
          : friendRecs.map((m, i) => {
              const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
              const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'
              return <MoviePosterCard key={m.id} movie={m} className={[rot, y].join(' ')} onClick={() => router.push(`/movie/${m.id}`)} />
            })}

        {!loadingFriendRecs && !friendErr && friendRecs.length === 0 && <div className="text-white/70 text-sm">No friend recs yet — follow someone to see theirs.</div>}
      </div>
    </div>
  )
}

function MoviePosterCard({ movie, className = '', onClick }: { movie: MovieRow; className?: string; onClick?: () => void }) {
  const [ok, setOk] = useState(true)

  return (
    <button
      type="button"
      onClick={onClick}
      className={['h-28 w-20 shrink-0 rounded-xl bg-white/10 border border-white', 'transform overflow-hidden cursor-pointer relative group', className].join(' ')}
      title={movie.title}
    >
      {movie.poster_url && ok ? (
        <img
          src={movie.poster_url}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          alt={movie.title}
          onError={() => setOk(false)}
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full grid place-items-center">🎬</div>
      )}

      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
        <div className="text-[10px] leading-tight text-white line-clamp-3">{movie.title}</div>
      </div>
    </button>
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

function SearchScreen({ onClose, onFollowChanged }: { onClose: () => void; onFollowChanged: () => void }) {
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('films')
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [movieResults, setMovieResults] = useState<MovieRow[]>([])
  const [friendResults, setFriendResults] = useState<FriendRow[]>([])

  const [popularMovies, setPopularMovies] = useState<MovieRow[]>([])

  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({})
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const isEmpty = debounced.trim().length === 0

  useEffect(() => {
    if (tab !== 'friends') return

    const ids = friendResults.map((f) => f.id)
    if (!ids.length) {
      setFollowingMap({})
      return
    }

    let cancelled = false

    ;(async () => {
      const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', MY_PROFILE_ID).in('following_id', ids)

      if (cancelled) return

      if (error) {
        setErrorMsg(formatSupabaseError(error))
        return
      }

      const map: Record<string, boolean> = {}
      ;(data ?? []).forEach((r: any) => {
        map[String(r.following_id)] = true
      })

      setFollowingMap(map)
    })()

    return () => {
      cancelled = true
    }
  }, [tab, friendResults])

  async function toggleFollow(targetId: string) {
    if (!targetId) return
    if (targetId === MY_PROFILE_ID) return

    setErrorMsg(null)
    setBusyMap((m) => ({ ...m, [targetId]: true }))

    let changed = false

    try {
      const isFollowing = !!followingMap[targetId]

      if (isFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', MY_PROFILE_ID).eq('following_id', targetId)
        if (error) {
          setErrorMsg(formatSupabaseError(error))
          return
        }
        setFollowingMap((m) => {
          const next = { ...m }
          delete next[targetId]
          return next
        })
        changed = true
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: MY_PROFILE_ID, following_id: targetId })
        const code = (error as any)?.code
        if (error && code !== '23505') {
          setErrorMsg(formatSupabaseError(error))
          return
        }
        setFollowingMap((m) => ({ ...m, [targetId]: true }))
        changed = true
      }
    } finally {
      setBusyMap((m) => ({ ...m, [targetId]: false }))
      if (changed) onFollowChanged()
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (tab !== 'films') return
      if (!isEmpty) return
      const { data, error } = await fetchMostPopularMovies()
      if (cancelled) return
      if (error) {
        setErrorMsg(formatSupabaseError(error))
        setPopularMovies([])
      } else {
        setPopularMovies(data)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [tab, isEmpty])

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
      <div className="px-5 pt-10 pb-5 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
        <div className="flex items-center justify-center gap-2">
          <span className="text-white/90 text-2xl">☆</span>
          <span className="text-white/90 text-2xl">☆</span>
          <h1 className="text-white text-2xl tracking-widest font-normal">Cinemate</h1>
          <span className="text-white/90 text-2xl">☆</span>
          <span className="text-white/90 text-2xl">☆</span>
        </div>

        <div className="mt-4 relative">
          <button onClick={onClose} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-11.5 w-14 rounded-full bg-[#4b0f0f] shadow flex items-center justify-center text-white text-xl" aria-label="Back">
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

      <div className="px-5 pt-4 pb-28 flex-1 min-h-0 overflow-y-auto bg-[#4b0f0f]" style={{ borderTopLeftRadius: '0.9375rem', borderTopRightRadius: '0.9375rem' }}>
        <div className="flex gap-4">
          <button onClick={() => setTab('films')} className={tab === 'films' ? 'px-5 py-2 rounded-full bg-black/55 text-white text-sm tracking-wide' : 'px-5 py-2 rounded-full bg-transparent text-white/80 text-sm tracking-wide'}>
            FILMS
          </button>

          <button onClick={() => setTab('friends')} className={tab === 'friends' ? 'px-5 py-2 rounded-full bg-black/55 text-white text-sm tracking-wide' : 'px-5 py-2 rounded-full bg-transparent text-white/80 text-sm tracking-wide'}>
            FRIENDS
          </button>
        </div>

        <div className="mt-6 text-white text-xl tracking-widest">{tab === 'films' ? 'Most popular' : 'People'}</div>
        <div className="mt-4 h-px bg-white/40" />

        {errorMsg && <div className="mt-4 rounded-xl border border-white/20 bg-black/20 p-3 text-red-200 text-sm">{errorMsg}</div>}

        <div className="mt-4">
          {tab === 'films' && isEmpty && (
            <ul>
              {popularMovies.map((m, i) => {
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
              {!popularMovies.length && !errorMsg && <li className="text-white/70 py-4 text-sm">No popular movies found.</li>}
            </ul>
          )}

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
                const isBusy = !!busyMap[f.id]
                const isFollowing = !!followingMap[f.id]

                return (
                  <li
                    key={f.id}
                    className="border-b border-white/40 py-6"
                    // ✅ click anywhere on the row (except the ADD button) to go to /profile/[id]
                    onClick={() => router.push(`/profile/${f.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') router.push(`/profile/${f.id}`)
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <AvatarThumb avatarUrl={f.avatar_url ?? null} rot={rot} y={y} />

                      <div className="flex-1">
                        <div className="text-white font-semibold">{f.label}</div>
                        <div className="text-white/80 text-sm font-normal">Friend</div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation() // ✅ don't navigate when tapping ADD
                          toggleFollow(f.id)
                        }}
                        disabled={isBusy}
                        className={['px-5 py-2 rounded-full bg-black/60 text-white text-xs tracking-widest', isBusy ? 'opacity-60 cursor-not-allowed' : ''].join(' ')}
                      >
                        {isBusy ? (isFollowing ? 'REMOVING…' : 'ADDING…') : isFollowing ? 'ADDED' : 'ADD'}
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


function AvatarThumb({ avatarUrl, rot, y }: { avatarUrl: string | null; rot: string; y: string }) {
  const [ok, setOk] = useState(true)
  return (
    <div className={['h-12 w-12 rounded-full bg-white/10 border border-white/20 overflow-hidden grid place-items-center', 'transform', rot, y].join(' ')}>
      {avatarUrl && ok ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" onError={() => setOk(false)} loading="lazy" /> : <>👤</>}
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
