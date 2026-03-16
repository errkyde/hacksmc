import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useHostStatus() {
  return useQuery<Record<number, boolean>>({
    queryKey: ['host-status'],
    queryFn: () => api.get('/api/hosts/status').then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
