import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface NatRule {
  id: number
  host: { id: number; name: string; ipAddress: string }
  protocol: string
  port: number
  description: string | null
  pfSenseRuleId: string | null
  status: 'PENDING' | 'ACTIVE' | 'DELETED'
  createdAt: string
  deletedAt: string | null
}

export interface CreateNatRuleRequest {
  hostId: number
  protocol: string
  port: number
  description?: string
}

export function useNatRules() {
  return useQuery<NatRule[]>({
    queryKey: ['nat-rules'],
    queryFn: () => api.get('/api/nat/rules').then((r) => r.data),
  })
}

export function useCreateNatRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateNatRuleRequest) =>
      api.post('/api/nat/rules', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nat-rules'] })
    },
  })
}

export function useDeleteNatRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/api/nat/rules/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nat-rules'] })
    },
  })
}
