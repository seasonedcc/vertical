import { createContext, useContext, useEffect, useState } from 'react'
import { fetchActivity } from '~/file/api'

type Availability = 'unknown' | 'available' | 'unavailable'

const ActivityAvailabilityContext = createContext<Availability>('unknown')

function ActivityAvailabilityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [availability, setAvailability] = useState<Availability>('unknown')

  useEffect(() => {
    fetchActivity()
      .then((response) => {
        setAvailability(response.available ? 'available' : 'unavailable')
      })
      .catch(() => setAvailability('unavailable'))
  }, [])

  return (
    <ActivityAvailabilityContext.Provider value={availability}>
      {children}
    </ActivityAvailabilityContext.Provider>
  )
}

function useActivityAvailability() {
  return useContext(ActivityAvailabilityContext)
}

export { ActivityAvailabilityProvider, useActivityAvailability }
