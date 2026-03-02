import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AdminUser {
  id: number
  username: string
  role: 'USER' | 'ADMIN'
  hostCount: number
  enabled: boolean
}

export interface PolicyDto {
  id: number
  allowedProtocols: string
  portRangeMin: number
  portRangeMax: number
  maxRules: number
}

export interface HostDto {
  id: number
  name: string
  ipAddress: string
  description: string | null
  policy: PolicyDto | null
}

export interface CreateUserInput {
  username: string
  password: string
  role: 'USER' | 'ADMIN'
}

export interface CreateHostInput {
  name: string
  ipAddress: string
  description?: string
  allowedProtocols: string
  portRangeMin: number
  portRangeMax: number
  maxRules: number
}

export interface UpdatePolicyInput {
  allowedProtocols: string
  portRangeMin: number
  portRangeMax: number
  maxRules: number
}

// ── Users ──────────────────────────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/api/admin/users').then((r) => r.data),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserInput) =>
      api.post<AdminUser>('/api/admin/users', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      api.put(`/api/admin/users/${id}/password`, { newPassword }),
  })
}

export function useSetUserEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.patch<AdminUser>(`/api/admin/users/${id}/enabled`, { enabled }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

// ── Hosts ──────────────────────────────────────────────────────────────────────

export function useUserHosts(userId: number | null) {
  return useQuery<HostDto[]>({
    queryKey: ['admin', 'users', userId, 'hosts'],
    queryFn: () => api.get(`/api/admin/users/${userId}/hosts`).then((r) => r.data),
    enabled: userId !== null,
  })
}

export function useCreateHost(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateHostInput) =>
      api.post<HostDto>(`/api/admin/users/${userId}/hosts`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users', userId, 'hosts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useDeleteHost(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hostId: number) => api.delete(`/api/admin/hosts/${hostId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users', userId, 'hosts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useUpdatePolicy(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hostId, data }: { hostId: number; data: UpdatePolicyInput }) =>
      api.put<PolicyDto>(`/api/admin/hosts/${hostId}/policy`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users', userId, 'hosts'] }),
  })
}

// ── Admin NAT Rules ────────────────────────────────────────────────────────────

export interface AdminNatRule {
  id: number
  username: string
  hostName: string
  hostIp: string
  protocol: string
  port: number
  description: string | null
  pfSenseRuleId: string | null
  status: 'PENDING' | 'ACTIVE' | 'DELETED'
  createdAt: string
  deletedAt: string | null
}

export function useAdminRules() {
  return useQuery<AdminNatRule[]>({
    queryKey: ['admin', 'rules'],
    queryFn: () => api.get('/api/admin/rules').then((r) => r.data),
  })
}

// ── Audit Log ──────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number
  ts: string
  actor: string
  action: string
  target: string | null
  detail: string | null
}

export function useAuditLog() {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['admin', 'audit-log'],
    queryFn: () => api.get('/api/admin/audit-log').then((r) => r.data),
    refetchInterval: 30_000,
  })
}

// ── pfSense Status ─────────────────────────────────────────────────────────────

export interface PfSenseStatus {
  status: 'UP' | 'DOWN'
  latencyMs: number | null
  url: string | null
  error: string | null
}

export function usePfSenseStatus() {
  return useQuery<PfSenseStatus>({
    queryKey: ['admin', 'pfsense-status'],
    queryFn: () => api.get('/api/admin/pfsense/status').then((r) => r.data),
    refetchInterval: 60_000,
  })
}
