import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from 'react'

/**
 * A minimal hash router.
 *
 * GitHub Pages serves static files with no rewrite rules, so a path-based
 * router would 404 on refresh or on any deep link. Hashes sidestep that
 * entirely, and the app needs nothing more than pattern matching and a
 * navigate function.
 */

function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

export function useRoutePath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => '/')
}

export function navigate(to: string, options?: { replace?: boolean }) {
  const target = to.startsWith('/') ? to : `/${to}`
  const url = `${window.location.pathname}${window.location.search}#${target}`

  if (options?.replace) {
    window.location.replace(url)
    // `replace` on a hash-only change does not always fire hashchange in
    // Safari, so nudge listeners directly.
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }

  if (currentPath() === target) return
  window.location.hash = target
}

export function back() {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    navigate('/')
  }
}

/**
 * Matches `/day/:date` style patterns. Returns the decoded params, or null when
 * the path does not match.
 */
export function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('?')[0]!.split('/').filter(Boolean)

  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i += 1) {
    const p = patternParts[i]!
    const value = pathParts[i]!
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(value)
    } else if (p !== value) {
      return null
    }
  }
  return params
}

export function useParams(pattern: string): Record<string, string> | null {
  const path = useRoutePath()
  return useMemo(() => matchPath(pattern, path), [pattern, path])
}

/** Query string of the current route, e.g. `#/history?med=advil`. */
export function useQuery(): URLSearchParams {
  const path = useRoutePath()
  return useMemo(() => new URLSearchParams(path.split('?')[1] ?? ''), [path])
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string
  replace?: boolean
}

export function Link({ to, replace, onClick, ...rest }: LinkProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) return
      // Let the browser handle modified clicks so "open in new tab" still works.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return
      }
      event.preventDefault()
      navigate(to, { replace })
    },
    [to, replace, onClick],
  )

  return <a href={`#${to}`} onClick={handleClick} {...rest} />
}
