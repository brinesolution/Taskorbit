import * as React from "react"

const MOBILE_BREAKPOINT = 768

const getSnapshot = () =>
  window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches

const getServerSnapshot = () => false

const subscribe = (onStoreChange: () => void) => {
  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mediaQuery.addEventListener("change", onStoreChange)
  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
