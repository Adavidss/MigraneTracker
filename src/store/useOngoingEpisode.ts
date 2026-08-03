import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getOngoingEpisode } from '@/lib/db'
import type { Episode } from '@/lib/types'

/**
 * The episode in progress, held across remounts.
 *
 * Every route renders its own AppShell, so navigating unmounts and remounts the
 * navigation, and `useLiveQuery` yields undefined on its first render. Without
 * this cache the main action would fall back to its default for a frame on
 * every single navigation, which reads as the icon flickering.
 *
 * The query returns null for "no episode", so undefined unambiguously means
 * "not answered yet" and the cache can be trusted only in that case.
 */
let cache: Episode | null | undefined

export function useOngoingEpisode(): Episode | null | undefined {
  const live = useLiveQuery(getOngoingEpisode, [], cache)

  useEffect(() => {
    if (live !== undefined) cache = live
  }, [live])

  return live
}
