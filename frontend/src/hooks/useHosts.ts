import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Host {
  id: number
  name: string
  ipAddress: string
  description: string | null
}

export function useHosts() {
  return useQuery<Host[]>({
    queryKey: ['hosts'],
    queryFn: () => api.get('/api/hosts').then((r) => r.data),
  })
}

export function useAdminHosts(options?: { enabled?: boolean }) {
  return useQuery<Host[]>({
    queryKey: ['admin-hosts'],
    queryFn: () => api.get('/api/admin/hosts').then((r) => r.data),
    enabled: options?.enabled ?? true,
  })
}
