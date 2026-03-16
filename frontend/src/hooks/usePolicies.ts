import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Policy {
  id: number
  host: { id: number; name: string; ipAddress: string }
  allowedProtocols: string
  portRangeMin: number
  portRangeMax: number
  maxRules: number
}

export function usePolicies() {
  return useQuery<Policy[]>({
    queryKey: ['policies'],
    queryFn: () => api.get('/api/policies').then((r) => r.data),
  })
}
