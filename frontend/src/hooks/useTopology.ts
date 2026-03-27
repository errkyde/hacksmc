import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

export type DeviceType = 'HOST' | 'ROUTER' | 'FIREWALL' | 'SWITCH' | 'PRINTER' | 'INTERNET' | 'UNKNOWN'

export interface NetworkGroupDto {
  id: number
  name: string
  color: string
  layerOrder: number
  collapsed: boolean
  createdAt: string
}

export interface NetworkDeviceDto {
  id: number
  name: string
  ipAddress: string | null
  macAddress: string | null
  hostname: string | null
  description: string | null
  deviceType: DeviceType
  groupId: number | null
  posX: number
  posY: number
  isManual: boolean
  isShared: boolean
  hostId: number | null
  createdAt: string
  updatedAt: string
}

export interface NetworkConnectionDto {
  id: number
  sourceDeviceId: number
  targetDeviceId: number
  protocol: string | null
  portStart: number | null
  portEnd: number | null
  label: string | null
  status: string
  natRuleId: number | null
  createdAt: string
}

export interface CreateGroupInput {
  name: string
  color: string
  layerOrder: number
}

export interface UpdateGroupInput {
  name?: string
  color?: string
  layerOrder?: number
  collapsed?: boolean
}

export interface CreateDeviceInput {
  name: string
  ipAddress?: string
  macAddress?: string
  hostname?: string
  description?: string
  deviceType: string
  groupId?: number | null
  posX?: number
  posY?: number
  isShared?: boolean
  hostId?: number | null
}

export interface PatchDeviceInput {
  name?: string
  description?: string
  deviceType?: string
  groupId?: number | null
  posX?: number
  posY?: number
  isShared?: boolean
}

export interface CreateConnectionInput {
  sourceDeviceId: number
  targetDeviceId: number
  protocol?: string
  portStart?: number
  portEnd?: number
  label?: string
}

// ── User-facing hooks (role-aware, /api/topology) ─────────────────────────────

export function useTopologyGroups() {
  return useQuery<NetworkGroupDto[]>({
    queryKey: ['topology', 'groups'],
    queryFn: () => api.get('/api/topology/groups').then(r => r.data),
  })
}

export function useTopologyDevices() {
  return useQuery<NetworkDeviceDto[]>({
    queryKey: ['topology', 'devices'],
    queryFn: () => api.get('/api/topology/devices').then(r => r.data),
  })
}

export function useTopologyConnections() {
  return useQuery<NetworkConnectionDto[]>({
    queryKey: ['topology', 'connections'],
    queryFn: () => api.get('/api/topology/connections').then(r => r.data),
  })
}

export function useCreateConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateConnectionInput) =>
      api.post<NetworkConnectionDto>('/api/topology/connections', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topology', 'connections'] }),
  })
}

export function useDeleteConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/topology/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topology', 'connections'] }),
  })
}

export function useSaveDevicePosition() {
  return useMutation({
    mutationFn: ({ id, posX, posY }: { id: number; posX: number; posY: number }) =>
      api.patch(`/api/topology/devices/${id}/position`, { posX, posY }),
  })
}

// ── Admin-only hooks (/api/admin/topology) ────────────────────────────────────

export function useAdminTopologyGroups() {
  return useQuery<NetworkGroupDto[]>({
    queryKey: ['admin', 'topology', 'groups'],
    queryFn: () => api.get('/api/admin/topology/groups').then(r => r.data),
  })
}

export function useCreateTopologyGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateGroupInput) =>
      api.post<NetworkGroupDto>('/api/admin/topology/groups', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'groups'] })
      qc.invalidateQueries({ queryKey: ['topology', 'groups'] })
    },
  })
}

export function useUpdateTopologyGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateGroupInput }) =>
      api.put<NetworkGroupDto>(`/api/admin/topology/groups/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'groups'] })
      qc.invalidateQueries({ queryKey: ['topology', 'groups'] })
    },
  })
}

export function useDeleteTopologyGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/topology/groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'groups'] })
      qc.invalidateQueries({ queryKey: ['topology', 'groups'] })
    },
  })
}

export function useAdminTopologyDevices() {
  return useQuery<NetworkDeviceDto[]>({
    queryKey: ['admin', 'topology', 'devices'],
    queryFn: () => api.get('/api/admin/topology/devices').then(r => r.data),
  })
}

export function useCreateTopologyDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDeviceInput) =>
      api.post<NetworkDeviceDto>('/api/admin/topology/devices', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'devices'] })
      qc.invalidateQueries({ queryKey: ['topology', 'devices'] })
    },
  })
}

export function usePatchTopologyDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PatchDeviceInput }) =>
      api.patch<NetworkDeviceDto>(`/api/admin/topology/devices/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'devices'] })
      qc.invalidateQueries({ queryKey: ['topology', 'devices'] })
    },
  })
}

export function useDeleteTopologyDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/topology/devices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'devices'] })
      qc.invalidateQueries({ queryKey: ['topology', 'devices'] })
    },
  })
}

export function useImportScanToTopology() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (devices: { ipAddress: string; hostname: string | null; latencyMs: number; openPorts?: number[] }[]) =>
      api.post<{ imported: number }>('/api/admin/topology/devices/import-scan', { devices }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'devices'] })
      qc.invalidateQueries({ queryKey: ['topology', 'devices'] })
    },
  })
}

export function useImportArpTable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<{ upserted: number }>('/api/admin/topology/scan/arp').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'devices'] })
      qc.invalidateQueries({ queryKey: ['topology', 'devices'] })
    },
  })
}

export function useAdminTopologyConnections() {
  return useQuery<NetworkConnectionDto[]>({
    queryKey: ['admin', 'topology', 'connections'],
    queryFn: () => api.get('/api/admin/topology/connections').then(r => r.data),
  })
}

export function useCreateAdminTopologyConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateConnectionInput) =>
      api.post<NetworkConnectionDto>('/api/admin/topology/connections', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'connections'] })
      qc.invalidateQueries({ queryKey: ['topology', 'connections'] })
    },
  })
}

export function useDeleteAdminTopologyConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/topology/connections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'topology', 'connections'] })
      qc.invalidateQueries({ queryKey: ['topology', 'connections'] })
    },
  })
}

// ── Client-side device type inference (mirrors backend DeviceTypeDetector) ─────

export function inferDeviceType(ipAddress: string, openPorts: number[], pfSenseHost?: string): DeviceType {
  if (openPorts.includes(9100)) return 'PRINTER'
  if (openPorts.includes(161) && (openPorts.includes(22) || openPorts.includes(23))) return 'SWITCH'
  if (openPorts.includes(161) && (openPorts.includes(80) || openPorts.includes(443))) return 'ROUTER'
  if (pfSenseHost && ipAddress === pfSenseHost) return 'FIREWALL'
  if (openPorts.includes(22) || openPorts.includes(80) || openPorts.includes(443)) return 'HOST'
  if (openPorts.includes(3389)) return 'HOST'
  if (openPorts.length === 0) return 'UNKNOWN'
  return 'HOST'
}
