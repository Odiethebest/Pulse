import { useEffect, useState } from 'react'
import AgentTheaterLoadingDesktop from './AgentTheaterLoadingDesktop'
import AgentTheaterLoadingMobile from './AgentTheaterLoadingMobile'

const MOBILE_MEDIA_QUERY = '(max-width: 767px)'

function resolveIsMobile() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

export default function AgentTheaterLoading(props) {
  const [isMobile, setIsMobile] = useState(resolveIsMobile)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    const handleChange = (event) => {
      setIsMobile(event.matches)
    }

    setIsMobile(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return isMobile
    ? <AgentTheaterLoadingMobile {...props} />
    : <AgentTheaterLoadingDesktop {...props} />
}
