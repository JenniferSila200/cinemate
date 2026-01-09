'use client'

import { DM_Mono } from 'next/font/google'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dmMono = DM_Mono({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
})

type Profile = {
  id: string
  username: string
  bio: string | null
  watcher_type: string | null
  avatar_url?: string | null
}

type Movie = {
  id: string
  title: string
  poster_url?: string | null
}

type Pinboard = {
  id: string
  title: string
  emoji: string | null
  description: string | null
  movies: Movie[]
}

function formatSupabaseError(error: unknown) {
  const e = error as any
  const parts = [e?.message, e?.details, e?.hint].filter(Boolean)
  return parts.length ? parts.join(' • ') : 'Unknown error'
}

export default function ProfilePage() {
  const params = useParams<{ id?: string }>()
  const id = params?.id ? String(params.id) : ''
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [pinboards, setPinboards] = useState<Pinboard[]>([])
  const [favourites, setFavourites] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMsg(null)

      try {
        let profileData: any = null
        let profileErr: any = null

        const res1 = await supabase
          .from('profiles')
          .select('id, username, bio, watcher_type, avatar_url')
          .eq('id', id)
          .maybeSingle()

        if (res1.error?.message?.includes('avatar_url')) {
          const res2 = await supabase
            .from('profiles')
            .select('id, username, bio, watcher_type')
            .eq('id', id)
            .maybeSingle()

          profileData = res2.data
          profileErr = res2.error
        } else {
          profileData = res1.data
          profileErr = res1.error
        }

        if (cancelled) return
        if (profileErr || !profileData) {
          setProfile(null)
          setErrorMsg(profileErr ? formatSupabaseError(profileErr) : 'Profile not found.')
          return
        }

        const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
        ])

        setProfile(profileData)
        setFollowers(followersCount ?? 0)
        setFollowing(followingCount ?? 0)

        const { data: pbRows, error: pbErr } = await supabase
          .from('pinboards')
          .select('id, title, emoji, description')
          .eq('profile_id', id)

        if (pbErr) console.error('pinboards fetch error:', pbErr)

        const pbList = (pbRows ?? []) as Array<{
          id: string
          title: string
          emoji: string | null
          description: string | null
        }>

        const pinboardIds = pbList.map((p) => String(p.id))

        let pbMoviesRows: Array<{ pinboard_id: string; movie_id: string; position: number | null }> = []
        if (pinboardIds.length) {
          const { data, error } = await supabase
            .from('pinboard_movies')
            .select('pinboard_id, movie_id, position')
            .in('pinboard_id', pinboardIds)

          if (error) console.error('pinboard_movies fetch error:', error)

          pbMoviesRows = (data ?? []).map((r: any) => ({
            pinboard_id: String(r.pinboard_id),
            movie_id: String(r.movie_id),
            position: r.position ?? 0,
          }))
        }

        const uniqueMovieIds = Array.from(new Set(pbMoviesRows.map((r) => String(r.movie_id))))
        const moviesById = new Map<string, Movie>()

        if (uniqueMovieIds.length) {
          const { data, error } = await supabase
            .from('movies')
            .select('id, title, poster_url')
            .in('id', uniqueMovieIds)

          if (error) console.error('movies fetch error:', error)

          ;(data ?? []).forEach((m: any) => {
            moviesById.set(String(m.id), {
              id: String(m.id),
              title: m.title,
              poster_url: m.poster_url,
            })
          })
        }

        const grouped = new Map<string, Array<{ position: number; movie: Movie }>>()
        for (const row of pbMoviesRows) {
          const mv = moviesById.get(String(row.movie_id))
          if (!mv) continue
          const arr = grouped.get(String(row.pinboard_id)) ?? []
          arr.push({ position: row.position ?? 0, movie: mv })
          grouped.set(String(row.pinboard_id), arr)
        }

        setPinboards(
          pbList.map((pb) => ({
            ...pb,
            movies: (grouped.get(String(pb.id)) ?? [])
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((x) => x.movie),
          }))
        )

        const { data: favRows, error: favErr } = await supabase
          .from('favourite_movies')
          .select('movie_id, position')
          .eq('profile_id', id)
          .order('position')

        if (favErr) console.error('favourite_movies fetch error:', favErr)

        const favIds = (favRows ?? []).map((r: any) => String(r.movie_id))

        if (!favIds.length) {
          setFavourites([])
        } else {
          const { data, error } = await supabase
            .from('movies')
            .select('id, title, poster_url')
            .in('id', favIds)

          if (error) console.error('movies (favourites) fetch error:', error)

          const byId = new Map<string, Movie>(
            (data ?? []).map((m: any) => [
              String(m.id),
              { id: String(m.id), title: m.title, poster_url: m.poster_url },
            ])
          )

          setFavourites(favIds.map((mid) => byId.get(String(mid))).filter(Boolean) as Movie[])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className={`${dmMono.className} min-h-screen bg-black flex items-center justify-center text-white`}>
        Loading…
      </div>
    )
  }

  if (!profile) {
    return (
      <div
        className={`${dmMono.className} min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center`}
      >
        <div className="text-lg mb-2">Couldn’t load profile.</div>
        <div className="text-white/70 text-sm mb-6">{errorMsg ?? 'Unknown error'}</div>
        <button onClick={() => router.back()} className="px-5 py-2 rounded-full bg-white/10 border border-white/20">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className={`${dmMono.className} min-h-screen bg-black flex items-center justify-center p-6`}>
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border border-white/10 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="h-[calc(844px-80px)] overflow-y-auto">
          <div className="relative z-10 px-5 pt-10 pb-14 bg-gradient-to-b from-[#1b1b1b] to-[#141414]">
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

            <div className="pointer-events-none absolute left-1/2 top-[120px] -translate-x-1/2 z-30 -mt-2.5">
              <AvatarCard avatarUrl={profile.avatar_url} />
            </div>
          </div>

          {/* Body */}
          <div className="bg-[#f7f1e7] pb-10">
            <div className="px-6 pt-20">
              <div className="flex justify-between px-6 text-black -mt-15">
                <div className="text-center">
                  <div className="text-xl leading-none">{followers}</div>
                  <div className="text-xs">Followers</div>
                </div>
                <div className="text-center">
                  <div className="text-xl leading-none">{following}</div>
                  <div className="text-xs">Following</div>
                </div>
              </div>

              <div className="mt-12 text-center text-black">
                <div className="font-semibold">
                  {profile.username} •{' '}
                  <span className="italic text-xs font-normal  text-black/70">{profile.watcher_type}</span>
                </div>
                <div className="mt-1 text-xs italic  text-black/70">“{profile.bio ?? 'Movies > everything else.'}”</div>
              </div>
            </div>

            {pinboards.map((pb) => (
              <Section
                key={pb.id}
                inset
                rounded
                mtClass="mt-6"
                title={
                  <>
                    <div className="text-base font-medium mt-0.5">{profile.username}’s pinboard 📌</div>
                    <div className="text-sm tracking-widest">
                      {pb.emoji ?? '📌'} {pb.title}
                    </div>
                  </>
                }
                bg="bg-[#6b0f0f]"
              >
                <PosterRow movies={pb.movies.slice(0, 12)} borderColor="border-white" />
              </Section>
            ))}

            {/* ✅ Move favourites up: smaller top margin */}
            <Section title="Favourites" mtClass="mt-2">
              <PosterRow movies={favourites} borderColor="border-[#620104]" />
            </Section>

            <div className="h-10" />
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

/* ---------- components ---------- */

function AvatarCard({ avatarUrl }: { avatarUrl?: string | null }) {
  const [ok, setOk] = useState(true)

  return (
    <div className="h-40 w-28 rounded-2xl overflow-hidden border-white/15 bg-black/10 grid place-items-center rotate-[-4deg]">
      {avatarUrl && ok ? (
        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" onError={() => setOk(false)} />
      ) : (
        <>👤</>
      )}
    </div>
  )
}

function Section({
  title,
  bg,
  children,
  mtClass = 'mt-6',
  rounded = false,
  inset = false,
}: {
  title: React.ReactNode
  bg?: string
  children: React.ReactNode
  mtClass?: string
  rounded?: boolean
  inset?: boolean
}) {
  // ✅ Wider pinboard/inset sections:
  // - reduce outer margins from mx-6 -> mx-3
  // - reduce padding slightly but keep it roomy
  const outer = inset ? 'mx-3' : ''
  const padding = inset ? 'px-4 py-4' : 'px-6 py-4'

  return (
    <div
      className={[
        bg ?? 'bg-[#f7f1e7]',
        outer,
        mtClass,
        padding,
        rounded ? 'rounded-2xl' : '',
      ].join(' ')}
    >
      <div className={`mb-3 ${bg ? 'text-[#f7f1e7]' : 'text-black'}`}>{title}</div>
      {children}
    </div>
  )
}

function PosterRow({ movies, borderColor }: { movies: Movie[]; borderColor: string }) {
  return (
    <div className="flex gap-4 overflow-x-auto overflow-y-visible pb-6 pt-4 pl-2 pr-2 [-webkit-overflow-scrolling:touch]">
      {movies.map((m, i) => {
        const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
        const y = i % 2 === 0 ? 'translate-y-1' : '-translate-y-1'
        return <PosterCard key={m.id} movie={m} className={[rot, y].join(' ')} borderColor={borderColor} />
      })}
    </div>
  )
}

function PosterCard({
  movie,
  className = '',
  borderColor = 'border-white',
}: {
  movie: Movie
  className?: string
  borderColor?: string
}) {
  const [ok, setOk] = useState(true)

  return (
    <div
      className={[
        'h-28 w-20 shrink-0 rounded-xl bg-white/10',
        'border-2',
        borderColor,
        'transform',
        className,
        'overflow-hidden cursor-pointer relative group',
      ].join(' ')}
      title={movie.title}
    >
      {movie.poster_url && ok ? (
        <img
          src={movie.poster_url}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          alt={movie.title}
          onError={() => setOk(false)}
        />
      ) : (
        <div className="h-full w-full grid place-items-center">🎬</div>
      )}

      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
        <div className="text-[10px] leading-tight text-white line-clamp-3">{movie.title}</div>
      </div>
    </div>
  )
}
