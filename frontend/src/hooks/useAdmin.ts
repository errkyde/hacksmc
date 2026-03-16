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

export function useUpdateHost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hostId, name, description }: { hostId: number; name: string; description?: string }) =>
      api.patch<HostDto>(`/api/admin/hosts/${hostId}`, { name, description }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'hosts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'rules'] })
    },
  })
}

export function useDeleteGlobalHost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hostId, deleteRules }: { hostId: number; deleteRules: boolean }) =>
      api.delete(`/api/admin/hosts/${hostId}`, { params: { deleteRules } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'hosts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'rules'] })
    },
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
  portStart: number
  portEnd: number
  description: string | null
  pfSenseRuleId: string | null
  status: 'PENDING' | 'ACTIVE' | 'DELETED'
  createdAt: string
  deletedAt: string | null
  expiresAt: string | null
}

export function useAdminRules() {
  return useQuery<AdminNatRule[]>({
    queryKey: ['admin', 'rules'],
    queryFn: () => api.get('/api/admin/rules').then((r) => r.data),
  })
}

export function useAdminDeleteRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rules'] })
    },
  })
}

export function useAdminBulkDeleteRules() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => api.delete('/api/admin/rules/bulk', { data: ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rules'] })
    },
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

export interface AuditLogPage {
  content: AuditLogEntry[]
  totalElements: number
  totalPages: number
  page: number
  size: number
  availableActors: string[]
  availableActions: string[]
}

export function useAuditLog(params: { page: number; size: number; actor?: string; action?: string }) {
  return useQuery<AuditLogPage>({
    queryKey: ['admin', 'audit-log', params],
    queryFn: () => api.get('/api/admin/audit-log', { params }).then((r) => r.data),
    placeholderData: (prev) => prev,
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

// ── Error Log ──────────────────────────────────────────────────────────────

export interface ErrorLogEntry {
  id: number
  ts: string
  actor: string | null
  method: string | null
  path: string | null
  httpStatus: number
  errorType: string | null
  message: string | null
}

export function useAdminErrors() {
  return useQuery<ErrorLogEntry[]>({
    queryKey: ['admin', 'errors'],
    queryFn: () => api.get('/api/admin/errors').then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 60_000,
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

// ── System Settings ─────────────────────────────────────────────────────────────

export interface SystemSettingsDto {
  pfSenseMaintenance: boolean
  siteMaintenance: boolean
  discordWebhookUrl: string | null
  discordEnabled: boolean
  discordNotifyCreate: boolean
  discordNotifyDelete: boolean
  discordNotifyExpire: boolean
  updatedBy: string | null
  updatedAt: string | null
  // SMTP
  mailHost: string | null
  mailPort: number
  mailUsername: string | null
  mailPasswordSet: boolean
  mailTlsEnabled: boolean
  mailFrom: string | null
}

export function useSystemSettings() {
  return useQuery<SystemSettingsDto>({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get('/api/admin/settings').then((r) => r.data),
  })
}

export interface UpdateSystemSettingsInput {
  pfSenseMaintenance?: boolean
  siteMaintenance?: boolean
  discordWebhookUrl?: string | null
  discordEnabled?: boolean
  discordNotifyCreate?: boolean
  discordNotifyDelete?: boolean
  discordNotifyExpire?: boolean
  mailHost?: string | null
  mailPort?: number
  mailUsername?: string | null
  mailPassword?: string
  mailTlsEnabled?: boolean
  mailFrom?: string | null
}

export function useUpdateSystemSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateSystemSettingsInput) =>
      api.put<SystemSettingsDto>('/api/admin/settings', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  })
}

export function useSendTestMail() {
  return useMutation({
    mutationFn: (to: string) =>
      api.post<{ status: string; message: string }>('/api/admin/settings/test-mail', { to }).then((r) => r.data),
  })
}

// ── Blocked Port Ranges ─────────────────────────────────────────────────────────

export interface BlockedPortRangeDto {
  id: number
  portStart: number
  portEnd: number
  reason: string | null
  createdAt: string
}

export function useBlockedPortRanges() {
  return useQuery<BlockedPortRangeDto[]>({
    queryKey: ['admin', 'blocked-ranges'],
    queryFn: () => api.get('/api/admin/blocked-ranges').then((r) => r.data),
  })
}

export function useCreateBlockedRange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { portStart: number; portEnd: number; reason?: string }) =>
      api.post<BlockedPortRangeDto>('/api/admin/blocked-ranges', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'blocked-ranges'] }),
  })
}

export function useDeleteBlockedRange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/blocked-ranges/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'blocked-ranges'] }),
  })
}

// ── Notification Settings ───────────────────────────────────────────────────────

export interface NotificationSettingsDto {
  id: number | null
  userId: number
  email: string | null
  emailEnabled: boolean
  notifyOnCreate: boolean
  notifyOnDelete: boolean
  notifyOnExpire: boolean
  notifyAllHosts: boolean
  notifyScope: 'OWN' | 'ALL'
  hostFilter: number[]
}

export function useNotificationSettings(userId: number | null) {
  return useQuery<NotificationSettingsDto>({
    queryKey: ['admin', 'users', userId, 'notifications'],
    queryFn: () => api.get(`/api/admin/users/${userId}/notifications`).then((r) => r.data),
    enabled: userId !== null,
  })
}

export function useUpdateNotificationSettings(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<NotificationSettingsDto, 'id' | 'userId'>) =>
      api.put<NotificationSettingsDto>(`/api/admin/users/${userId}/notifications`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users', userId, 'notifications'] }),
  })
}

// ── Email Notification Profiles ─────────────────────────────────────────────

export interface EmailNotificationProfileDto {
  id: number
  email: string
  notifyOnCreate: boolean
  notifyOnDelete: boolean
  notifyOnExpire: boolean
  scope: 'ALL' | 'SPECIFIC'
  userIds: number[]
  createdAt: string
}

export interface SaveEmailNotificationProfileRequest {
  email: string
  notifyOnCreate: boolean
  notifyOnDelete: boolean
  notifyOnExpire: boolean
  scope: 'ALL' | 'SPECIFIC'
  userIds: number[]
}

export function useEmailNotificationProfiles() {
  return useQuery<EmailNotificationProfileDto[]>({
    queryKey: ['admin', 'email-profiles'],
    queryFn: () => api.get('/api/admin/email-profiles').then((r) => r.data),
  })
}

export function useCreateEmailNotificationProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SaveEmailNotificationProfileRequest) =>
      api.post<EmailNotificationProfileDto>('/api/admin/email-profiles', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'email-profiles'] }),
  })
}

export function useUpdateEmailNotificationProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveEmailNotificationProfileRequest }) =>
      api.put<EmailNotificationProfileDto>(`/api/admin/email-profiles/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'email-profiles'] }),
  })
}

export function useDeleteEmailNotificationProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/email-profiles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'email-profiles'] }),
  })
}

// ── Admin Extend Expiry ─────────────────────────────────────────────────────────

export function useAdminExtendExpiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, expiresAt }: { id: number; expiresAt: string | null }) =>
      api.patch(`/api/admin/rules/${id}/expiry`, { expiresAt }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rules'] }),
  })
}
