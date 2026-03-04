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

export interface AssignedUserRef {
  id: number
  username: string
}

export interface HostDto {
  id: number
  name: string
  ipAddress: string
  description: string | null
  policy: PolicyDto | null
  userCount: number
  activeRuleCount: number
  assignedUsers: AssignedUserRef[]
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
}

export interface AssignHostInput {
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

// ── Global Hosts ───────────────────────────────────────────────────────────────

export function useAllHosts() {
  return useQuery<HostDto[]>({
    queryKey: ['admin', 'hosts'],
    queryFn: () => api.get('/api/admin/hosts').then((r) => r.data),
  })
}

export function useCreateGlobalHost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateHostInput) =>
      api.post<HostDto>('/api/admin/hosts', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'hosts'] }),
  })
}

export function useDeleteGlobalHost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hostId: number) => api.delete(`/api/admin/hosts/${hostId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'hosts'] }),
  })
}

// ── User-Host Assignments ──────────────────────────────────────────────────────

export function useUserHosts(userId: number | null) {
  return useQuery<HostDto[]>({
    queryKey: ['admin', 'users', userId, 'hosts'],
    queryFn: () => api.get(`/api/admin/users/${userId}/hosts`).then((r) => r.data),
    enabled: userId !== null,
  })
}

export function useAssignHost(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hostId, data }: { hostId: number; data: AssignHostInput }) =>
      api.post<HostDto>(`/api/admin/users/${userId}/hosts/${hostId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users', userId, 'hosts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useUnassignHost(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hostId: number) => api.delete(`/api/admin/users/${userId}/hosts/${hostId}`),
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
      api.put<PolicyDto>(`/api/admin/users/${userId}/hosts/${hostId}/policy`, data).then((r) => r.data),
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

// ── User Overview ──────────────────────────────────────────────────────────────

export interface UserOverview {
  id: number
  username: string
  role: 'USER' | 'ADMIN'
  enabled: boolean
  hostCount: number
  activeRuleCount: number
  pendingRuleCount: number
  deletedRuleCount: number
  hosts: HostDto[]
  recentRules: AdminNatRule[]
}

export function useUserOverview(userId: number | null) {
  return useQuery<UserOverview>({
    queryKey: ['admin', 'users', userId, 'overview'],
    queryFn: () => api.get(`/api/admin/users/${userId}/overview`).then((r) => r.data),
    enabled: userId !== null,
  })
}

// ── Admin Host Status ──────────────────────────────────────────────────────────

export function useAdminHostStatus() {
  return useQuery<Record<number, boolean>>({
    queryKey: ['admin', 'hosts', 'status'],
    queryFn: () => api.get('/api/admin/hosts/status').then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}

// ── Network Scan ───────────────────────────────────────────────────────────────

export interface ScannedHost {
  ipAddress: string
  hostname: string | null
  latencyMs: number
}

export function useNetworkScan() {
  return useMutation({
    mutationFn: (subnet: string) =>
      api.post<ScannedHost[]>('/api/admin/hosts/scan', { subnet }).then((r) => r.data),
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
