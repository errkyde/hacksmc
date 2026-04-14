import { useState, useEffect, useCallback, useRef, Fragment, type FormEvent } from 'react'
import Layout from '@/components/Layout'
import {
  useAdminUsers,
  useCreateUser,
  useDeleteUser,
  useResetPassword,
  useSetUserEnabled,
  useUserHosts,
  useAssignHost,
  useUnassignHost,
  useUpdatePolicy,
  useAllHosts,
  useCreateGlobalHost,
  useUpdateHost,
  useDeleteGlobalHost,
  useNetworkScan,
  useAdminHostStatus,
  useUserOverview,
  useAdminRules,
  useAdminDeleteRule,
  useAdminBulkDeleteRules,
  useAdminExtendExpiry,
  useAuditLog,
  usePfSenseStatus,
  useAdminErrors,
  useSystemSettings,
  useUpdateSystemSettings,
  useBlockedPortRanges,
  useCreateBlockedRange,
  useDeleteBlockedRange,
  useEmailNotificationProfiles,
  useCreateEmailNotificationProfile,
  useUpdateEmailNotificationProfile,
  useDeleteEmailNotificationProfile,
  useSendTestMail,
  type EmailNotificationProfileDto,
  type SaveEmailNotificationProfileRequest,
  type AdminUser,
  type HostDto,
  type ScannedHost,
  type AdminNatRule,
  type AuditLogEntry,
  type ErrorLogEntry,
} from '@/hooks/useAdmin'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ChevronRight, Plus, Trash2, Pencil, Server, RefreshCw, Copy, Check, Users, Users2, Network, KeyRound, Lock, Unlock, ScrollText, Wifi, ScanLine, AlertCircle, AlertTriangle, Activity, Clock, Settings, Shield, Bell, Calendar, Mail, Send } from 'lucide-react'

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCooldown(ms: number) {
  const [cooling, setCooling] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback((fn: () => void) => {
    if (cooling) return
    fn()
    setCooling(true)
    timerRef.current = setTimeout(() => setCooling(false), ms)
  }, [cooling, ms])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { cooling, trigger }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border',
      role === 'ADMIN'
        ? 'bg-red-500/15 text-red-400 border-red-500/30'
        : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    )}>
      {role}
    </span>
  )
}

function StatusBadge({ status }: { status: AdminNatRule['status'] }) {
  const styles = {
    ACTIVE: 'bg-green-500/15 text-green-400 border-green-500/30',
    PENDING: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    DELETED: 'bg-muted text-muted-foreground border-border line-through',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border', styles[status])}>
      {status}
    </span>
  )
}

// ─── Passwort-Generator ────────────────────────────────────────────────────────

const PW_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$&'
function generatePassword(len = 18): string {
  const buf = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(buf).map(b => PW_CHARS[b % PW_CHARS.length]).join('')
}

// ─── Policy Fields (shared form fragment) ─────────────────────────────────────

function PolicyFields({
  protocols, setProtocols,
  portMin, setPortMin,
  portMax, setPortMax,
  maxRules, setMaxRules,
}: {
  protocols: ('TCP' | 'UDP')[]
  setProtocols: (v: ('TCP' | 'UDP')[]) => void
  portMin: string
  setPortMin: (v: string) => void
  portMax: string
  setPortMax: (v: string) => void
  maxRules: string
  setMaxRules: (v: string) => void
}) {
  function toggleProtocol(p: 'TCP' | 'UDP') {
    setProtocols(protocols.includes(p) ? protocols.filter((x) => x !== p) : [...protocols, p])
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label>Erlaubte Protokolle</Label>
        <div className="flex gap-2">
          {(['TCP', 'UDP'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => toggleProtocol(p)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-mono border transition-colors',
                protocols.includes(p)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Port-Bereich</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={portMin}
            onChange={(e) => setPortMin(e.target.value)}
            placeholder="Von"
            min={1}
            max={65535}
            required
            className="font-mono"
          />
          <span className="text-muted-foreground shrink-0">–</span>
          <Input
            type="number"
            value={portMax}
            onChange={(e) => setPortMax(e.target.value)}
            placeholder="Bis"
            min={1}
            max={65535}
            required
            className="font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Nur Ports in diesem Bereich sind für den Nutzer freischaltbar.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pf-max">Max. gleichzeitige Regeln</Label>
        <Input
          id="pf-max"
          type="number"
          value={maxRules}
          onChange={(e) => setMaxRules(e.target.value)}
          min={1}
          max={100}
          required
          className="font-mono w-24"
        />
      </div>
    </>
  )
}

// ─── NAT Rules Tab ─────────────────────────────────────────────────────────────

function NatRulesTab() {
  const { data: rules = [], isLoading } = useAdminRules()
  const deleteMutation = useAdminDeleteRule()
  const bulkDeleteMutation = useAdminBulkDeleteRules()
  const extendMutation = useAdminExtendExpiry()
  const { toast } = useToast()

  const [statusFilter, setStatusFilter] = useState<'ALL' | AdminNatRule['status']>('ALL')
  const [protocolFilter, setProtocolFilter] = useState('ALL')
  const [portSearch, setPortSearch] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [extendRuleId, setExtendRuleId] = useState<number | null>(null)
  const [extendExpiry, setExtendExpiry] = useState('')

  const uniqueProtocols = [...new Set(rules.map((r) => r.protocol))].sort()

  const filtered = rules.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
    if (protocolFilter !== 'ALL' && r.protocol !== protocolFilter) return false
    if (portSearch.trim()) {
      const q = portSearch.trim()
      const portStr = r.portStart === r.portEnd ? String(r.portStart) : `${r.portStart}–${r.portEnd}`
      if (!portStr.includes(q) && !String(r.portStart).includes(q) && !String(r.portEnd).includes(q)) return false
    }
    return true
  })

  const deletableFiltered = filtered.filter((r) => r.status !== 'DELETED')
  const allSelected = deletableFiltered.length > 0 && deletableFiltered.every((r) => selected.has(r.id))

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const s = new Set(prev); deletableFiltered.forEach((r) => s.delete(r.id)); return s })
    } else {
      setSelected((prev) => { const s = new Set(prev); deletableFiltered.forEach((r) => s.add(r.id)); return s })
    }
  }

  function toggleOne(id: number) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function handleDelete(id: number) {
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteConfirmId(null)
      setSelected((prev) => { const s = new Set(prev); s.delete(id); return s })
      toast({ title: 'Regel gelöscht' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Löschen fehlgeschlagen'
      toast({ title: 'Fehler', description: msg, variant: 'destructive' })
      setDeleteConfirmId(null)
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    try {
      await bulkDeleteMutation.mutateAsync(ids)
      setSelected(new Set())
      setBulkConfirm(false)
      toast({ title: `${ids.length} Regel${ids.length !== 1 ? 'n' : ''} gelöscht` })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Bulk-Löschen fehlgeschlagen'
      toast({ title: 'Fehler', description: msg, variant: 'destructive' })
      setBulkConfirm(false)
    }
  }

  async function handleExtend(id: number) {
    try {
      await extendMutation.mutateAsync({ id, expiresAt: extendExpiry ? new Date(extendExpiry).toISOString() : null })
      setExtendRuleId(null)
      setExtendExpiry('')
      toast({ title: 'Ablaufzeit aktualisiert' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Aktualisierung fehlgeschlagen'
      toast({ title: 'Fehler', description: msg, variant: 'destructive' })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">NAT-Regeln</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${filtered.length} von ${rules.length} Regel${rules.length !== 1 ? 'n' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            bulkConfirm ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selected.size} löschen?</span>
                <Button size="sm" variant="destructive" disabled={bulkDeleteMutation.isPending} onClick={handleBulkDelete}>Ja</Button>
                <Button size="sm" variant="ghost" onClick={() => setBulkConfirm(false)}>Nein</Button>
              </span>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setBulkConfirm(true)}>
                {selected.size} löschen
              </Button>
            )
          )}
          <Input
            placeholder="Port suchen…"
            value={portSearch}
            onChange={(e) => setPortSearch(e.target.value)}
            className="w-[130px] h-9 font-mono text-sm"
          />
          <Select value={protocolFilter} onValueChange={setProtocolFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Protokolle</SelectItem>
              {uniqueProtocols.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Status</SelectItem>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="DELETED">DELETED</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-14 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Keine Regeln vorhanden</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-primary cursor-pointer"
                    title="Alle auswählen"
                  />
                </TableHead>
                <TableHead>Benutzer</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Protokoll</TableHead>
                <TableHead>Port(s)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Läuft ab</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rule) => (
                <TableRow key={rule.id} className={rule.status === 'DELETED' ? 'opacity-40' : ''}>
                  <TableCell>
                    {rule.status !== 'DELETED' && (
                      <input
                        type="checkbox"
                        checked={selected.has(rule.id)}
                        onChange={() => toggleOne(rule.id)}
                        className="accent-primary cursor-pointer"
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    {rule.username}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{rule.hostName}</div>
                    {rule.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {rule.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {rule.hostIp}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {rule.protocol}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-semibold text-primary">
                    {rule.portStart === rule.portEnd ? rule.portStart : `${rule.portStart}–${rule.portEnd}`}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={rule.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(rule.createdAt).toLocaleString('de-DE')}
                  </TableCell>
                  <TableCell className="text-xs font-mono whitespace-nowrap">
                    {rule.expiresAt ? (
                      <span className={cn(new Date(rule.expiresAt) < new Date() ? 'text-muted-foreground line-through' : 'text-amber-400')}>
                        {new Date(rule.expiresAt).toLocaleString('de-DE')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {rule.status !== 'DELETED' && (
                      extendRuleId === rule.id ? (
                        <span className="inline-flex items-center gap-2">
                          <Input
                            type="datetime-local"
                            value={extendExpiry}
                            onChange={(e) => setExtendExpiry(e.target.value)}
                            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                            className="h-7 text-xs font-mono w-[170px]"
                          />
                          <Button size="sm" variant="default" disabled={extendMutation.isPending} onClick={() => handleExtend(rule.id)}>
                            Speichern
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setExtendRuleId(null); setExtendExpiry('') }}>✕</Button>
                        </span>
                      ) : deleteConfirmId === rule.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Löschen?</span>
                          <Button size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => handleDelete(rule.id)}>Ja</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}>Nein</Button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-primary text-xs"
                            onClick={() => {
                              setExtendRuleId(rule.id)
                              setExtendExpiry(rule.expiresAt ? new Date(rule.expiresAt).toISOString().slice(0, 16) : '')
                              setDeleteConfirmId(null)
                            }}
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            Verlängern
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => { setDeleteConfirmId(rule.id); setExtendRuleId(null) }}>
                            Löschen
                          </Button>
                        </span>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

// ─── Audit Log Tab ─────────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, string> = {
  LOGIN:             'text-blue-400',
  USER_CREATED:      'text-green-400',
  USER_DELETED:      'text-red-400',
  USER_ENABLED:      'text-emerald-400',
  USER_DISABLED:     'text-orange-400',
  PASSWORD_RESET:    'text-yellow-400',
  NAT_RULE_CREATED:       'text-cyan-400',
  NAT_RULE_CREATED_ADMIN: 'text-cyan-300',
  NAT_RULE_DELETED:       'text-rose-400',
  NAT_RULE_DELETED_ADMIN: 'text-rose-300',
  NAT_RULE_EXPIRED:       'text-orange-400',
}

function AuditLogTab() {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [actorFilter, setActorFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const { data, isLoading, refetch } = useAuditLog({ page, size: pageSize, actor: actorFilter || undefined, action: actionFilter || undefined })
  const { cooling: auditCooling, trigger: auditTrigger } = useCooldown(5000)
  const entries: AuditLogEntry[] = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const totalElements = data?.totalElements ?? 0
  const availableActors: string[] = data?.availableActors ?? []
  const availableActions: string[] = data?.availableActions ?? []

  function handleActorChange(v: string) {
    setActorFilter(v)
    setPage(0)
  }
  function handleActionChange(v: string) {
    setActionFilter(v)
    setPage(0)
  }
  function handlePageSizeChange(v: string) {
    setPageSize(Number(v))
    setPage(0)
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Audit-Log</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${totalElements} Einträge`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => auditTrigger(() => refetch())}
            disabled={auditCooling || isLoading}
            className={cn('h-8 px-3 rounded-md border bg-card hover:bg-accent disabled:opacity-50 text-sm text-foreground', auditCooling && 'cooldown-btn')}
          >
            {isLoading ? '…' : '↻ Aktualisieren'}
          </button>
          <select
            value={actorFilter}
            onChange={(e) => handleActorChange(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Alle Benutzer</option>
            {availableActors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => handleActionChange(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Alle Aktionen</option>
            {availableActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={10}>10 / Seite</option>
            <option value={25}>25 / Seite</option>
            <option value={50}>50 / Seite</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-14 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Noch keine Einträge</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitstempel</TableHead>
                <TableHead>Aktor</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Ziel</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e: AuditLogEntry) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(e.ts).toLocaleString('de-DE')}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">{e.actor}</TableCell>
                  <TableCell>
                    <span className={cn('font-mono text-xs font-semibold', ACTION_STYLES[e.action] ?? 'text-foreground')}>
                      {e.action}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {e.target ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.detail ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Seite {page + 1} von {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 px-3 rounded-md border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
            >
              ← Zurück
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 px-3 rounded-md border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reset Password Dialog ─────────────────────────────────────────────────────

function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useToast()
  const resetPassword = useResetPassword()
  const [password, setPassword] = useState(() => generatePassword())
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  function reset() {
    setPassword(generatePassword())
    setDone(false)
    setCopied(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await resetPassword.mutateAsync({ id: user.id, newPassword: password })
      setDone(true)
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Fehler beim Zurücksetzen'
      toast({ title: 'Fehler', description: detail, variant: 'destructive' })
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`Benutzername: ${user.username}\nPasswort: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-[380px] border-t-destructive/60 border-t-2">
        <DialogHeader>
          <DialogTitle>
            {done ? 'Passwort zurückgesetzt' : (
              <>Passwort für <span className="font-mono text-primary">{user.username}</span> zurücksetzen</>
            )}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Zugangsdaten einmalig sichtbar — bitte jetzt kopieren und weitergeben.
            </p>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Benutzername</span>
                <span className="font-semibold">{user.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Passwort</span>
                <span className="font-semibold tracking-wide">{password}</span>
              </div>
            </div>
            <Button className="w-full" onClick={handleCopy} variant={copied ? 'secondary' : 'default'}>
              {copied
                ? <><Check className="h-4 w-4 mr-2" />Kopiert!</>
                : <><Copy className="h-4 w-4 mr-2" />Zugangsdaten kopieren</>}
            </Button>
          </div>
        ) : (
          <form id="reset-pw-form" onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Neues Passwort</Label>
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Neu generieren
                </button>
              </div>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="font-mono pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(password)
                    toast({ title: 'Passwort kopiert' })
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        <DialogFooter>
          {done ? (
            <Button onClick={() => { onOpenChange(false); reset() }}>Schließen</Button>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline">Abbrechen</Button>
              </DialogClose>
              <Button type="submit" form="reset-pw-form" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? 'Wird gesetzt…' : 'Passwort setzen'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create User Dialog ────────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useToast()
  const createUser = useCreateUser()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState(() => generatePassword())
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER')
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && !created) setPassword(generatePassword())
  }, [open])

  function reset() {
    setUsername('')
    setPassword(generatePassword())
    setRole('USER')
    setCreated(null)
    setCopied(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await createUser.mutateAsync({ username, password, role })
      setCreated({ username, password })
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Fehler beim Erstellen'
      toast({ title: 'Fehler', description: detail, variant: 'destructive' })
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`Benutzername: ${created!.username}\nPasswort: ${created!.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-[400px] border-t-destructive/60 border-t-2">
        <DialogHeader>
          <DialogTitle>
            {created ? 'Benutzer erstellt' : 'Neuen Benutzer anlegen'}
          </DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Zugangsdaten einmalig sichtbar — bitte jetzt kopieren und weitergeben.
            </p>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Benutzername</span>
                <span className="font-semibold">{created.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Passwort</span>
                <span className="font-semibold tracking-wide">{created.password}</span>
              </div>
            </div>
            <Button className="w-full" onClick={handleCopy} variant={copied ? 'secondary' : 'default'}>
              {copied
                ? <><Check className="h-4 w-4 mr-2" />Kopiert!</>
                : <><Copy className="h-4 w-4 mr-2" />Zugangsdaten kopieren</>}
            </Button>
          </div>
        ) : (
          <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="u-username">Benutzername</Label>
              <Input
                id="u-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="z.B. max.mustermann"
                minLength={3}
                maxLength={64}
                required
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Passwort</Label>
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Neu generieren
                </button>
              </div>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="font-mono pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(password)
                    toast({ title: 'Passwort kopiert' })
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  title="Passwort kopieren"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Automatisch generiert — du kannst es anpassen.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-role">Rolle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'USER' | 'ADMIN')}>
                <SelectTrigger id="u-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER — Normaler Nutzer</SelectItem>
                  <SelectItem value="ADMIN">ADMIN — Vollzugriff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        )}

        <DialogFooter>
          {created ? (
            <Button onClick={() => { onOpenChange(false); reset() }}>Schließen</Button>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline">Abbrechen</Button>
              </DialogClose>
              <Button type="submit" form="create-user-form" disabled={createUser.isPending}>
                {createUser.isPending ? 'Wird erstellt…' : 'Erstellen'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create Global Host Dialog ─────────────────────────────────────────────────

function CreateGlobalHostDialog({
  open,
  onOpenChange,
  initialName = '',
  initialIp = '',
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialName?: string
  initialIp?: string
}) {
  const { toast } = useToast()
  const createHost = useCreateGlobalHost()
  const [name, setName] = useState(initialName)
  const [ip, setIp] = useState(initialIp)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialName)
      setIp(initialIp)
      setDescription('')
    }
  }, [open, initialName, initialIp])

  function reset() { setName(''); setIp(''); setDescription('') }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      const host = await createHost.mutateAsync({ name, ipAddress: ip, description: description || undefined })
      toast({ title: 'Host angelegt', description: `${host.name} (${host.ipAddress})` })
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Fehler beim Erstellen'
      toast({ title: 'Fehler', description: detail, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-[420px] border-t-destructive/60 border-t-2">
        <DialogHeader>
          <DialogTitle>Neuen Host anlegen</DialogTitle>
        </DialogHeader>
        <form id="create-global-host-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gh-name">Name</Label>
              <Input
                id="gh-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="minecraft-server"
                maxLength={128}
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gh-ip">IP-Adresse</Label>
              <Input
                id="gh-ip"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.10.50"
                required
                className={cn('font-mono', initialIp && 'text-muted-foreground')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-desc">
              Beschreibung <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="gh-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Minecraft Game Server"
              maxLength={255}
              autoFocus={!!initialIp}
            />
          </div>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <Button type="submit" form="create-global-host-form" disabled={createHost.isPending}>
            {createHost.isPending ? 'Wird erstellt…' : 'Host anlegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Assign Host Dialog ────────────────────────────────────────────────────────

function AssignHostDialog({
  userId,
  assignedHostIds,
  open,
  onOpenChange,
}: {
  userId: number
  assignedHostIds: number[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useToast()
  const { data: allHosts = [] } = useAllHosts()
  const assignHost = useAssignHost(userId)

  const available = allHosts.filter((h) => !assignedHostIds.includes(h.id))

  const [selectedHostId, setSelectedHostId] = useState<string>('')
  const [protocols, setProtocols] = useState<('TCP' | 'UDP')[]>(['TCP'])
  const [portMin, setPortMin] = useState('')
  const [portMax, setPortMax] = useState('')
  const [maxRules, setMaxRules] = useState('5')

  function reset() {
    setSelectedHostId('')
    setProtocols(['TCP'])
    setPortMin('')
    setPortMax('')
    setMaxRules('5')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedHostId) {
      toast({ title: 'Fehler', description: 'Bitte einen Host auswählen.', variant: 'destructive' })
      return
    }
    if (protocols.length === 0) {
      toast({ title: 'Fehler', description: 'Mindestens ein Protokoll wählen.', variant: 'destructive' })
      return
    }
    try {
      const host = await assignHost.mutateAsync({
        hostId: Number(selectedHostId),
        data: {
          allowedProtocols: protocols.join(','),
          portRangeMin: Number(portMin),
          portRangeMax: Number(portMax),
          maxRules: Number(maxRules),
        },
      })
      toast({ title: 'Host zugewiesen', description: `${host.name} wurde zugewiesen.` })
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Fehler beim Zuweisen'
      toast({ title: 'Fehler', description: detail, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-[440px] border-t-destructive/60 border-t-2">
        <DialogHeader>
          <DialogTitle>Host zuweisen</DialogTitle>
        </DialogHeader>
        <form id="assign-host-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Host</Label>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Alle verfügbaren Hosts sind bereits zugewiesen. Lege zuerst einen neuen Host im Tab "Hosts" an.
              </p>
            ) : (
              <Select value={selectedHostId} onValueChange={setSelectedHostId}>
                <SelectTrigger>
                  <SelectValue placeholder="Host auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      <span className="font-mono">{h.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{h.ipAddress}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {available.length > 0 && (
            <PolicyFields
              protocols={protocols} setProtocols={setProtocols}
              portMin={portMin} setPortMin={setPortMin}
              portMax={portMax} setPortMax={setPortMax}
              maxRules={maxRules} setMaxRules={setMaxRules}
            />
          )}
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          {available.length > 0 && (
            <Button type="submit" form="assign-host-form" disabled={assignHost.isPending}>
              {assignHost.isPending ? 'Wird zugewiesen…' : 'Zuweisen'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Policy Dialog ────────────────────────────────────────────────────────

function EditPolicyDialog({
  userId,
  host,
  open,
  onOpenChange,
}: {
  userId: number
  host: HostDto
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useToast()
  const updatePolicy = useUpdatePolicy(userId)
  const pol = host.policy

  const [protocols, setProtocols] = useState<('TCP' | 'UDP')[]>(
    () => (pol?.allowedProtocols ?? 'TCP').split(',').map((s) => s.trim()) as ('TCP' | 'UDP')[]
  )
  const [portMin, setPortMin] = useState(String(pol?.portRangeMin ?? 1))
  const [portMax, setPortMax] = useState(String(pol?.portRangeMax ?? 65535))
  const [maxRules, setMaxRules] = useState(String(pol?.maxRules ?? 5))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (protocols.length === 0) {
      toast({ title: 'Fehler', description: 'Mindestens ein Protokoll wählen.', variant: 'destructive' })
      return
    }
    try {
      await updatePolicy.mutateAsync({
        hostId: host.id,
        data: {
          allowedProtocols: protocols.join(','),
          portRangeMin: Number(portMin),
          portRangeMax: Number(portMax),
          maxRules: Number(maxRules),
        },
      })
      toast({ title: 'Policy gespeichert', description: `${host.name} wurde aktualisiert.` })
      onOpenChange(false)
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Fehler beim Speichern'
      toast({ title: 'Fehler', description: detail, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] border-t-destructive/60 border-t-2">
        <DialogHeader>
          <DialogTitle>
            Berechtigung bearbeiten —{' '}
            <span className="font-mono text-primary">{host.name}</span>
          </DialogTitle>
        </DialogHeader>
        <form id="edit-policy-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          <PolicyFields
            protocols={protocols} setProtocols={setProtocols}
            portMin={portMin} setPortMin={setPortMin}
            portMax={portMax} setPortMax={setPortMax}
            maxRules={maxRules} setMaxRules={setMaxRules}
          />
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <Button type="submit" form="edit-policy-form" disabled={updatePolicy.isPending}>
            {updatePolicy.isPending ? 'Speichert…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── User Hosts Section (expanded per user) ────────────────────────────────────

function UserHostsSection({ user }: { user: AdminUser }) {
  const { data: hosts = [], isLoading } = useUserHosts(user.id)
  const unassignHost = useUnassignHost(user.id)
  const { toast } = useToast()

  const [assignOpen, setAssignOpen] = useState(false)
  const [editHost, setEditHost] = useState<HostDto | null>(null)
  const [unassignConfirmId, setUnassignConfirmId] = useState<number | null>(null)

  async function handleUnassign(hostId: number) {
    try {
      await unassignHost.mutateAsync(hostId)
      setUnassignConfirmId(null)
      toast({ title: 'Zuweisung entfernt' })
    } catch {
      toast({ title: 'Fehler', description: 'Zuweisung konnte nicht entfernt werden.', variant: 'destructive' })
      setUnassignConfirmId(null)
    }
  }

  return (
    <div className="border-t bg-muted/30 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Zugewiesene Hosts
        </p>
        <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Host zuweisen
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-2">Lädt…</p>
      ) : hosts.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 border border-dashed rounded-lg px-4">
          <Server className="h-4 w-4 shrink-0" />
          <span>Kein Host zugewiesen. Weise einen Host zu, um Ports freizuschalten.</span>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Host</TableHead>
                <TableHead>Protokolle</TableHead>
                <TableHead>Port-Bereich</TableHead>
                <TableHead>Max. Regeln</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hosts.map((host) => (
                <TableRow key={host.id}>
                  <TableCell>
                    <div className="font-medium">{host.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{host.ipAddress}</div>
                  </TableCell>
                  <TableCell>
                    {host.policy ? (
                      <div className="flex gap-1 flex-wrap">
                        {host.policy.allowedProtocols.split(',').map((p) => (
                          <Badge key={p} variant="secondary" className="font-mono text-xs">
                            {p.trim()}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {host.policy
                      ? `${host.policy.portRangeMin} – ${host.policy.portRangeMax}`
                      : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {host.policy?.maxRules ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditHost(host)}
                        title="Berechtigung bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {unassignConfirmId === host.id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Entfernen?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2"
                            disabled={unassignHost.isPending}
                            onClick={() => handleUnassign(host.id)}
                          >
                            Ja
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => setUnassignConfirmId(null)}
                          >
                            Nein
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => setUnassignConfirmId(host.id)}
                          title="Zuweisung entfernen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AssignHostDialog
        userId={user.id}
        assignedHostIds={hosts.map((h) => h.id)}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
      {editHost && (
        <EditPolicyDialog
          userId={user.id}
          host={editHost}
          open={true}
          onOpenChange={(v) => { if (!v) setEditHost(null) }}
        />
      )}
    </div>
  )
}

// ─── User Overview Dialog ───────────────────────────────────────────────────────

function UserOverviewDialog({ username, userId, open, onOpenChange }: {
  username: string
  userId: number
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data, isLoading } = useUserOverview(open ? userId : null)

  const statusStyle: Record<string, string> = {
    ACTIVE:  'bg-green-500/15 text-green-400 border-green-500/30',
    PENDING: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    DELETED: 'bg-muted text-muted-foreground border-border line-through',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] border-t-destructive/60 border-t-2 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-primary">{username}</span>
            {data && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border',
                data.role === 'ADMIN'
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              )}>
                {data.role}
              </span>
            )}
            {data && !data.enabled && (
              <span className="text-xs text-destructive font-normal">(gesperrt)</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1,2,3].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
          </div>
        ) : data ? (
          <div className="space-y-5 py-1">

            {/* ── Stats ── */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Hosts',    value: data.hostCount,        color: 'text-foreground' },
                { label: 'Aktiv',    value: data.activeRuleCount,  color: 'text-green-400' },
                { label: 'Pending',  value: data.pendingRuleCount, color: 'text-yellow-400' },
                { label: 'Gelöscht', value: data.deletedRuleCount, color: 'text-muted-foreground' },
              ].map(s => (
                <div key={s.label} className="rounded-lg border bg-muted/30 px-3 py-2.5 text-center">
                  <div className={cn('text-2xl font-mono font-bold', s.color)}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── Assigned Hosts ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" /> Zugewiesene Hosts
              </p>
              {data.hosts.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic px-1">Keine Hosts zugewiesen</p>
              ) : (
                <div className="space-y-1.5">
                  {data.hosts.map(host => (
                    <div key={host.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{host.name}</span>
                        <span className="font-mono text-xs text-primary ml-2">{host.ipAddress}</span>
                        {host.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{host.description}</p>
                        )}
                      </div>
                      {host.policy && (
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                              <Activity className="h-3 w-3" />
                              <span className="font-mono font-medium text-foreground">{host.activeRuleCount}</span>
                              <span>aktiv</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {host.policy.portRangeMin}–{host.policy.portRangeMax}
                            </div>
                          </div>
                          <div className="flex gap-0.5">
                            {host.policy.allowedProtocols.split(',').map(p => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted border border-border text-muted-foreground">
                                {p.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Recent Rules ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Letzte NAT-Regeln
              </p>
              {data.recentRules.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic px-1">Noch keine Regeln erstellt</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-2">Host</TableHead>
                        <TableHead className="py-2">Port</TableHead>
                        <TableHead className="py-2">Beschreibung</TableHead>
                        <TableHead className="py-2">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentRules.map(rule => (
                        <TableRow key={rule.id}>
                          <TableCell className="py-2 font-mono text-xs text-muted-foreground">{rule.hostName}</TableCell>
                          <TableCell className="py-2 font-mono text-xs">
                            {rule.protocol}:{rule.portStart === rule.portEnd ? rule.portStart : `${rule.portStart}–${rule.portEnd}`}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground max-w-[120px] truncate">
                            {rule.description ?? <span className="italic">—</span>}
                          </TableCell>
                          <TableCell className="py-2">
                            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border', statusStyle[rule.status])}>
                              {rule.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Schließen</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Hosts Tab ─────────────────────────────────────────────────────────────────

function HostsTab() {
  const { data: hosts = [], isLoading } = useAllHosts()
  const { data: hostStatus = {}, isLoading: statusLoading } = useAdminHostStatus()
  const deleteHost = useDeleteGlobalHost()
  const updateHost = useUpdateHost()
  const networkScan = useNetworkScan()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [prefillName, setPrefillName] = useState('')
  const [prefillIp, setPrefillIp] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [deleteRulesConfirm, setDeleteRulesConfirm] = useState<'ask' | 'yes' | 'no' | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [subnet, setSubnet] = useState('')
  const [scanResults, setScanResults] = useState<ScannedHost[] | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [overviewUser, setOverviewUser] = useState<{ id: number; username: string } | null>(null)

  function openCreateWithPrefill(name: string, ip: string) {
    setPrefillName(name)
    setPrefillIp(ip)
    setCreateOpen(true)
  }

  function openCreateEmpty() {
    setPrefillName('')
    setPrefillIp('')
    setCreateOpen(true)
  }

  async function handleDelete(hostId: number, deleteRules: boolean) {
    try {
      await deleteHost.mutateAsync({ hostId, deleteRules })
      setDeleteConfirmId(null)
      setDeleteRulesConfirm(null)
      toast({ title: 'Host gelöscht' })
    } catch {
      toast({ title: 'Fehler', description: 'Host konnte nicht gelöscht werden.', variant: 'destructive' })
      setDeleteConfirmId(null)
      setDeleteRulesConfirm(null)
    }
  }

  async function handleRename(hostId: number) {
    const name = editName.trim()
    if (!name) return
    try {
      await updateHost.mutateAsync({ hostId, name })
      setEditingId(null)
      toast({ title: 'Host umbenannt' })
    } catch {
      toast({ title: 'Fehler', description: 'Name konnte nicht geändert werden.', variant: 'destructive' })
    }
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    setScanError(null)
    setScanResults(null)
    try {
      const results = await networkScan.mutateAsync(subnet)
      setScanResults(results)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Scan fehlgeschlagen'
      setScanError(msg)
    }
  }

  const existingIps = new Set(hosts.map((h) => h.ipAddress))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Hosts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${hosts.length} Host${hosts.length !== 1 ? 's' : ''}`} · globale Ressourcen
          </p>
        </div>
        <Button onClick={openCreateEmpty}>
          <Plus className="h-4 w-4 mr-1.5" />
          Neuer Host
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-5">
                <div className="h-4 bg-muted rounded w-28 mb-3" />
                <div className="h-3 bg-muted rounded w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : hosts.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center">
          <Server className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Noch keine Hosts angelegt.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Lege Hosts hier an und weise sie dann Benutzern zu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hosts.map((host) => (
            <Card key={host.id} className="group hover:border-primary/30 transition-colors flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {editingId === host.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleRename(host.id) }} className="flex items-center gap-1 flex-1">
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleRename(host.id)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null) }}
                            className="text-sm font-medium bg-transparent border-b border-primary outline-none w-full font-mono"
                            maxLength={128}
                          />
                        </form>
                      ) : (
                        <CardTitle
                          className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
                          title="Klicken zum Umbenennen"
                          onClick={() => { setEditingId(host.id); setEditName(host.name) }}
                        >
                          {host.name}
                        </CardTitle>
                      )}
                      {(() => {
                        const known = !statusLoading && host.id in hostStatus
                        const online = hostStatus[host.id]
                        return (
                          <span
                            title={!known ? 'Checking…' : online ? 'Online' : 'Offline'}
                            className="flex items-center gap-1 shrink-0"
                          >
                            {!known
                              ? <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                              : online
                                ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
                                : <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            }
                            <span className={cn('text-[10px] font-mono', !known ? 'text-muted-foreground/40' : online ? 'text-emerald-500' : 'text-red-500')}>
                              {!known ? '…' : online ? 'online' : 'offline'}
                            </span>
                          </span>
                        )
                      })()}
                    </div>
                    <p className="font-mono text-xs text-primary mt-0.5">{host.ipAddress}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {deleteConfirmId === host.id ? (
                      deleteRulesConfirm === 'ask' ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground">Aktive Regeln mit löschen?</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" disabled={deleteHost.isPending}
                              onClick={() => handleDelete(host.id, true)}>Ja</Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={deleteHost.isPending}
                              onClick={() => handleDelete(host.id, false)}>Nein</Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                              onClick={() => { setDeleteConfirmId(null); setDeleteRulesConfirm(null) }}>Abbruch</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground">Host löschen?</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="destructive" className="h-6 px-2 text-xs"
                              onClick={() => {
                                if (host.activeRuleCount > 0) setDeleteRulesConfirm('ask')
                                else handleDelete(host.id, false)
                              }}>Ja</Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                              onClick={() => { setDeleteConfirmId(null); setDeleteRulesConfirm(null) }}>Nein</Button>
                          </div>
                        </div>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => { setDeleteConfirmId(host.id); setDeleteRulesConfirm(null) }}
                        title="Host löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {host.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{host.description}</p>
                )}
              </CardHeader>

              <Separator />

              <CardContent className="pt-3 pb-3 flex-1 space-y-3">
                {/* Stats row */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono font-medium text-foreground">{host.userCount}</span>
                    <span>{host.userCount === 1 ? 'User' : 'Users'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Activity className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono font-medium text-foreground">{host.activeRuleCount}</span>
                    <span>aktive {host.activeRuleCount === 1 ? 'Regel' : 'Regeln'}</span>
                  </div>
                </div>

                {/* Assigned users */}
                {host.assignedUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {host.assignedUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setOverviewUser({ id: u.id, username: u.username })}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                      >
                        {u.username}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground/50 italic">Kein User zugewiesen</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Network Scan ─────────────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Netzwerk-Scan</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Erreichbare Hosts im Netzwerk ermitteln (z.B. 192.168.1.0/24)
          </p>
        </div>

        <form onSubmit={handleScan} className="flex gap-2 mb-4">
          <Input
            placeholder="192.168.1.0/24"
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            className="font-mono max-w-56"
            disabled={networkScan.isPending}
          />
          <Button type="submit" variant="outline" disabled={networkScan.isPending || !subnet.trim()}>
            {networkScan.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                Scannt…
              </>
            ) : (
              <>
                <ScanLine className="h-4 w-4 mr-1.5" />
                Scan starten
              </>
            )}
          </Button>
        </form>

        {scanError && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {scanError}
          </div>
        )}

        {scanResults !== null && (
          <div className="rounded-xl border bg-card overflow-hidden">
            {scanResults.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Keine erreichbaren Hosts gefunden.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP-Adresse</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>Latenz</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanResults.map((host) => {
                    const alreadyAdded = existingIps.has(host.ipAddress)
                    return (
                      <TableRow key={host.ipAddress}>
                        <TableCell className="font-mono text-sm">{host.ipAddress}</TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {host.hostname ?? <span className="italic text-xs">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {host.latencyMs} ms
                        </TableCell>
                        <TableCell>
                          {alreadyAdded ? (
                            <span className="text-xs text-muted-foreground italic">bereits angelegt</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              erreichbar
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!alreadyAdded && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => openCreateWithPrefill(host.hostname ?? '', host.ipAddress)}
                              title="Als Host anlegen"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Anlegen
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
            <div className="px-4 py-2 border-t text-xs text-muted-foreground">
              {scanResults.length} erreichbare Host{scanResults.length !== 1 ? 's' : ''} gefunden
            </div>
          </div>
        )}
      </div>

      <CreateGlobalHostDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={prefillName}
        initialIp={prefillIp}
      />

      {overviewUser && (
        <UserOverviewDialog
          userId={overviewUser.id}
          username={overviewUser.username}
          open={!!overviewUser}
          onOpenChange={(v) => { if (!v) setOverviewUser(null) }}
        />
      )}
    </div>
  )
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data: users = [], isLoading } = useAdminUsers()
  const deleteUser = useDeleteUser()
  const setUserEnabled = useSetUserEnabled()
  const { toast } = useToast()

  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [resetPwUser, setResetPwUser] = useState<AdminUser | null>(null)

  async function handleDeleteUser(user: AdminUser) {
    try {
      await deleteUser.mutateAsync(user.id)
      setDeleteConfirmId(null)
      if (expandedUserId === user.id) setExpandedUserId(null)
      toast({ title: 'Benutzer gelöscht', description: `@${user.username} wurde entfernt.` })
    } catch {
      toast({ title: 'Fehler', description: 'Benutzer konnte nicht gelöscht werden.', variant: 'destructive' })
      setDeleteConfirmId(null)
    }
  }

  async function handleToggleEnabled(user: AdminUser) {
    try {
      await setUserEnabled.mutateAsync({ id: user.id, enabled: !user.enabled })
      toast({
        title: user.enabled ? 'Benutzer gesperrt' : 'Benutzer entsperrt',
        description: `@${user.username} wurde ${user.enabled ? 'gesperrt' : 'entsperrt'}.`,
      })
    } catch {
      toast({ title: 'Fehler', description: 'Status konnte nicht geändert werden.', variant: 'destructive' })
    }
  }

  function toggleExpand(id: number) {
    setExpandedUserId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Benutzerverwaltung</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${users.length} Benutzer`}
          </p>
        </div>
        <Button onClick={() => setCreateUserOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Neuer Benutzer
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-14 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Keine Benutzer vorhanden</p>
          </div>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Benutzername</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Hosts</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <Fragment key={user.id}>
                    <TableRow
                      className={cn(
                        'cursor-pointer select-none',
                        expandedUserId === user.id && 'bg-muted/50',
                        !user.enabled && 'opacity-60'
                      )}
                      onClick={() => toggleExpand(user.id)}
                    >
                      <TableCell className="pr-0">
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform duration-150',
                            expandedUserId === user.id && 'rotate-90'
                          )}
                        />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{user.username}</span>
                          {!user.enabled && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-mono">
                              gesperrt
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        {user.hostCount === 0
                          ? <span className="italic text-xs">Kein Host</span>
                          : `${user.hostCount} Host${user.hostCount !== 1 ? 's' : ''}`}
                      </TableCell>

                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {deleteConfirmId === user.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Wirklich löschen?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deleteUser.isPending}
                              onClick={() => handleDeleteUser(user)}
                            >
                              Ja
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Nein
                            </Button>
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                              title="Passwort zurücksetzen"
                              onClick={() => setResetPwUser(user)}
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn(
                                'h-7 px-2',
                                user.enabled
                                  ? 'text-muted-foreground hover:text-orange-400'
                                  : 'text-orange-400 hover:text-emerald-400'
                              )}
                              title={user.enabled ? 'Sperren' : 'Entsperren'}
                              disabled={setUserEnabled.isPending}
                              onClick={() => handleToggleEnabled(user)}
                            >
                              {user.enabled
                                ? <Lock className="h-3.5 w-3.5" />
                                : <Unlock className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteConfirmId(user.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>

                    {expandedUserId === user.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="p-0">
                          <UserHostsSection user={user} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CreateUserDialog open={createUserOpen} onOpenChange={setCreateUserOpen} />
      {resetPwUser && (
        <ResetPasswordDialog
          user={resetPwUser}
          open={true}
          onOpenChange={(v) => { if (!v) setResetPwUser(null) }}
        />
      )}
    </div>
  )
}

// ─── pfSense Tab ───────────────────────────────────────────────────────────────

function HttpStatusBadge({ status }: { status: number }) {
  const is5xx = status >= 500
  const is4xx = status >= 400 && status < 500
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border',
      is5xx ? 'bg-red-500/15 text-red-400 border-red-500/30'
        : is4xx ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
        : 'bg-muted text-muted-foreground border-border'
    )}>
      {status}
    </span>
  )
}

function ErrorDetailDialog({ entry, open, onOpenChange }: {
  entry: ErrorLogEntry | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  if (!entry) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Fehlerdetail</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[100px_1fr] gap-y-2 gap-x-3 items-start">
            <span className="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Zeitpunkt</span>
            <span className="font-mono">{new Date(entry.ts).toLocaleString('de-DE')}</span>

            <span className="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Actor</span>
            <span className="font-mono">{entry.actor ?? <span className="italic text-muted-foreground">anonym</span>}</span>

            <span className="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Request</span>
            <span className="font-mono break-all">{entry.method} {entry.path}</span>

            <span className="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Status</span>
            <span><HttpStatusBadge status={entry.httpStatus} /></span>

            <span className="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Typ</span>
            <span className="font-mono text-muted-foreground">{entry.errorType ?? '—'}</span>
          </div>
          {entry.message && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Nachricht</p>
              <p className="font-mono text-sm break-all whitespace-pre-wrap">{entry.message}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Schließen</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PfSenseTab() {
  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = usePfSenseStatus()
  const { data: errors = [], isLoading: errorsLoading } = useAdminErrors()
  const { cooling: pfCooling, trigger: pfTrigger } = useCooldown(5000)
  const up = data?.status === 'UP'
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleString('de-DE')
    : null

  const [selectedError, setSelectedError] = useState<ErrorLogEntry | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">pfSense-Verbindung</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lastUpdated ? `Zuletzt geprüft: ${lastUpdated}` : 'Wird geprüft…'} · automatisch alle 60 s
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pfTrigger(() => refetch())}
          disabled={pfCooling || isFetching}
          className={cn(pfCooling && 'cooldown-btn')}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
          Jetzt testen
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <div className={cn(
          'rounded-xl border p-6',
          isLoading
            ? 'border-border bg-card'
            : up
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/5'
        )}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Status</p>
          <div className="flex items-center gap-2.5">
            <span className={cn(
              'w-2.5 h-2.5 rounded-full shrink-0',
              isLoading ? 'bg-muted-foreground' : up ? 'bg-emerald-400 pulse-dot' : 'bg-red-400'
            )} />
            <span className={cn(
              'text-2xl font-bold font-mono tracking-tight',
              isLoading ? 'text-muted-foreground' : up ? 'text-emerald-400' : 'text-red-400'
            )}>
              {isLoading ? '…' : data?.status ?? '—'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Latenz</p>
          <span className="text-2xl font-bold font-mono tracking-tight">
            {isLoading ? '…' : data?.latencyMs != null ? `${data.latencyMs} ms` : '—'}
          </span>
          {data?.latencyMs != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.latencyMs < 100 ? 'gut' : data.latencyMs < 500 ? 'mittel' : 'langsam'}
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Endpunkt</p>
          <span className="text-sm font-mono text-foreground break-all leading-relaxed">
            {data?.url ?? '—'}
          </span>
        </div>
      </div>

      {!isLoading && !up && data?.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 mb-8">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">Fehlerdetail</p>
          <p className="text-sm font-mono text-red-300/80 break-all">{data.error}</p>
        </div>
      )}

      {/* ── Letzte Fehler ─────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">Letzte Fehler</h3>
          {errors.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground font-mono">({errors.length})</span>
          )}
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {errorsLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Lädt…</div>
          ) : errors.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Keine Fehler aufgezeichnet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeit</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Pfad</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((err) => (
                  <TableRow
                    key={err.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedError(err)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(err.ts).toLocaleString('de-DE')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {err.actor ?? <span className="italic text-muted-foreground text-xs">anonym</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      <span className="text-muted-foreground mr-1">{err.method}</span>
                      {err.path}
                    </TableCell>
                    <TableCell>
                      <HttpStatusBadge status={err.httpStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <ErrorDetailDialog
        entry={selectedError}
        open={selectedError !== null}
        onOpenChange={(v) => { if (!v) setSelectedError(null) }}
      />

      <div className="flex justify-end mt-6">
        <span className="text-[11px] font-mono text-muted-foreground">v1.6.1</span>
      </div>
    </div>
  )
}

// ─── Email Profile Form ────────────────────────────────────────────────────────

interface ProfileFormProps {
  editingId: number | 'new'
  formEmail: string; setFormEmail: (v: string) => void
  formCreate: boolean; setFormCreate: (v: boolean) => void
  formDelete: boolean; setFormDelete: (v: boolean) => void
  formExpire: boolean; setFormExpire: (v: boolean) => void
  formScope: 'ALL' | 'SPECIFIC'; setFormScope: (v: 'ALL' | 'SPECIFIC') => void
  formUserIds: number[]
  toggleUserId: (id: number) => void
  users: AdminUser[]
  isSaving: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

function ProfileForm({
  editingId, formEmail, setFormEmail,
  formCreate, setFormCreate, formDelete, setFormDelete, formExpire, setFormExpire,
  formScope, setFormScope, formUserIds, toggleUserId,
  users, isSaving, onSubmit, onCancel,
}: ProfileFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-4 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">E-Mail-Adresse</Label>
        <Input
          type="email"
          value={formEmail}
          onChange={e => setFormEmail(e.target.value)}
          placeholder="empfaenger@example.com"
          required
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Ereignisse</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formCreate} onChange={e => setFormCreate(e.target.checked)} className="accent-primary" />
            Regel erstellt
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formDelete} onChange={e => setFormDelete(e.target.checked)} className="accent-primary" />
            Regel gelöscht
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formExpire} onChange={e => setFormExpire(e.target.checked)} className="accent-primary" />
            Regel abgelaufen
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Benutzer</p>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setFormScope('ALL')}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-mono border transition-colors',
              formScope === 'ALL'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            Alle
          </button>
          <button
            type="button"
            onClick={() => setFormScope('SPECIFIC')}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-mono border transition-colors',
              formScope === 'SPECIFIC'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            Auswahl
          </button>
        </div>
        {formScope === 'SPECIFIC' && (
          <div className="flex flex-wrap gap-2">
            {users.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleUserId(u.id)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-mono border transition-colors',
                  formUserIds.includes(u.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                )}
              >
                {u.username}
              </button>
            ))}
            {users.length === 0 && (
              <span className="text-xs text-muted-foreground italic">Keine Benutzer</span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSaving || !formEmail.trim()}>
          {isSaving ? 'Wird gespeichert…' : editingId === 'new' ? 'Erstellen' : 'Speichern'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Abbrechen</Button>
      </div>
    </form>
  )
}

// ─── Email Profiles Section ────────────────────────────────────────────────────

function EmailProfilesSection() {
  const { data: profiles = [], isLoading } = useEmailNotificationProfiles()
  const { data: users = [] } = useAdminUsers()
  const createMutation = useCreateEmailNotificationProfile()
  const updateMutation = useUpdateEmailNotificationProfile()
  const deleteMutation = useDeleteEmailNotificationProfile()
  const { toast } = useToast()

  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Form state
  const [formEmail, setFormEmail] = useState('')
  const [formCreate, setFormCreate] = useState(true)
  const [formDelete, setFormDelete] = useState(true)
  const [formExpire, setFormExpire] = useState(true)
  const [formScope, setFormScope] = useState<'ALL' | 'SPECIFIC'>('ALL')
  const [formUserIds, setFormUserIds] = useState<number[]>([])

  function openNew() {
    setFormEmail('')
    setFormCreate(true)
    setFormDelete(true)
    setFormExpire(true)
    setFormScope('ALL')
    setFormUserIds([])
    setEditingId('new')
  }

  function openEdit(p: EmailNotificationProfileDto) {
    setFormEmail(p.email)
    setFormCreate(p.notifyOnCreate)
    setFormDelete(p.notifyOnDelete)
    setFormExpire(p.notifyOnExpire)
    setFormScope(p.scope)
    setFormUserIds([...p.userIds])
    setEditingId(p.id)
  }

  function toggleUserId(id: number) {
    setFormUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function buildRequest(): SaveEmailNotificationProfileRequest {
    return {
      email: formEmail.trim(),
      notifyOnCreate: formCreate,
      notifyOnDelete: formDelete,
      notifyOnExpire: formExpire,
      scope: formScope,
      userIds: formScope === 'ALL' ? [] : formUserIds,
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingId === 'new') {
        await createMutation.mutateAsync(buildRequest())
        toast({ title: 'Profil erstellt' })
      } else {
        await updateMutation.mutateAsync({ id: editingId as number, data: buildRequest() })
        toast({ title: 'Profil aktualisiert' })
      }
      setEditingId(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Fehler'
      toast({ title: 'Fehler', description: msg, variant: 'destructive' })
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteConfirmId(null)
      toast({ title: 'Profil gelöscht' })
    } catch {
      toast({ title: 'Fehler', description: 'Löschen fehlgeschlagen', variant: 'destructive' })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const sharedFormProps = {
    editingId: editingId as number | 'new',
    formEmail, setFormEmail, formCreate, setFormCreate,
    formDelete, setFormDelete, formExpire, setFormExpire,
    formScope, setFormScope, formUserIds, toggleUserId,
    users, isSaving, onSubmit: handleSave,
    onCancel: () => setEditingId(null),
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">E-Mail-Benachrichtigungsprofile</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Jedes Profil sendet E-Mails an eine Adresse bei bestimmten Ereignissen.
          </p>
        </div>
        {editingId !== 'new' && (
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Neues Profil
          </Button>
        )}
      </div>

      {editingId === 'new' && (
        <ProfileForm {...sharedFormProps} />
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Lädt…</div>
      ) : profiles.length === 0 && editingId !== 'new' ? (
        <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          Noch kein E-Mail-Profil angelegt
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id}>
              {editingId === p.id ? (
                <ProfileForm {...sharedFormProps} />
              ) : (
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium truncate">{p.email}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.notifyOnCreate && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            erstellt
                          </span>
                        )}
                        {p.notifyOnDelete && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            gelöscht
                          </span>
                        )}
                        {p.notifyOnExpire && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-500/15 text-orange-400 border border-orange-500/30">
                            abgelaufen
                          </span>
                        )}
                        {!p.notifyOnCreate && !p.notifyOnDelete && !p.notifyOnExpire && (
                          <span className="text-xs text-muted-foreground italic">Keine Ereignisse</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-muted-foreground font-mono mr-1">Benutzer:</span>
                        {p.scope === 'ALL' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
                            alle
                          </span>
                        ) : p.userIds.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Keine</span>
                        ) : (
                          p.userIds.map(uid => {
                            const u = users.find(x => x.id === uid)
                            return u ? (
                              <span key={uid} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                {u.username}
                              </span>
                            ) : null
                          })
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(p)}
                        title="Bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {deleteConfirmId === p.id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Button size="sm" variant="destructive" className="h-7 px-2" disabled={deleteMutation.isPending} onClick={() => handleDelete(p.id)}>Ja</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDeleteConfirmId(null)}>Nein</Button>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteConfirmId(p.id)}
                          title="Löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Einstellungen Tab ─────────────────────────────────────────────────────────

function EinstellungenTab() {
  const { data: settings, isLoading } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()
  const sendTestMail = useSendTestMail()
  const { data: blockedRanges = [], isLoading: rangesLoading } = useBlockedPortRanges()
  const createRange = useCreateBlockedRange()
  const deleteRange = useDeleteBlockedRange()
  const { toast } = useToast()

  const [pfMaintenance, setPfMaintenance] = useState(false)
  const [siteMaintenance, setSiteMaintenance] = useState(false)
  const [discordUrl, setDiscordUrl] = useState('')
  const [discordEnabled, setDiscordEnabled] = useState(false)
  const [discordNotifyCreate, setDiscordNotifyCreate] = useState(true)
  const [discordNotifyDelete, setDiscordNotifyDelete] = useState(true)
  const [discordNotifyExpire, setDiscordNotifyExpire] = useState(true)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [notifTab, setNotifTab] = useState<'discord' | 'email' | 'smtp'>('discord')

  // SMTP state
  const [mailHost, setMailHost] = useState('')
  const [mailPort, setMailPort] = useState('587')
  const [mailUsername, setMailUsername] = useState('')
  const [mailPassword, setMailPassword] = useState('')
  const [mailTlsEnabled, setMailTlsEnabled] = useState(true)
  const [mailFrom, setMailFrom] = useState('')
  const [testMailTo, setTestMailTo] = useState('')
  const [smtpSaved, setSmtpSaved] = useState(false)

  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [rangeReason, setRangeReason] = useState('')
  const [deleteConfirmRangeId, setDeleteConfirmRangeId] = useState<number | null>(null)

  useEffect(() => {
    if (settings) {
      setPfMaintenance(settings.pfSenseMaintenance)
      setSiteMaintenance(settings.siteMaintenance)
      setDiscordUrl(settings.discordWebhookUrl ?? '')
      setDiscordEnabled(settings.discordEnabled)
      setDiscordNotifyCreate(settings.discordNotifyCreate)
      setDiscordNotifyDelete(settings.discordNotifyDelete)
      setDiscordNotifyExpire(settings.discordNotifyExpire)
      setMailHost(settings.mailHost ?? '')
      setMailPort(String(settings.mailPort || 587))
      setMailUsername(settings.mailUsername ?? '')
      setMailTlsEnabled(settings.mailTlsEnabled ?? true)
      setMailFrom(settings.mailFrom ?? '')
      // Never pre-fill password — only set on explicit change
    }
  }, [settings])

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({
        pfSenseMaintenance: pfMaintenance,
        siteMaintenance,
        discordWebhookUrl: discordUrl.trim() || null,
        discordEnabled,
        discordNotifyCreate,
        discordNotifyDelete,
        discordNotifyExpire,
      })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
      toast({ title: 'Einstellungen gespeichert' })
    } catch {
      toast({ title: 'Fehler', description: 'Speichern fehlgeschlagen', variant: 'destructive' })
    }
  }

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({
        pfSenseMaintenance: pfMaintenance,
        siteMaintenance,
        discordWebhookUrl: discordUrl.trim() || null,
        discordEnabled,
        discordNotifyCreate,
        discordNotifyDelete,
        discordNotifyExpire,
        mailHost: mailHost.trim() || null,
        mailPort: Number(mailPort) || 587,
        mailUsername: mailUsername.trim() || null,
        mailPassword: mailPassword || undefined,
        mailTlsEnabled,
        mailFrom: mailFrom.trim() || null,
      })
      setMailPassword('')
      setSmtpSaved(true)
      setTimeout(() => setSmtpSaved(false), 2000)
      toast({ title: 'SMTP-Einstellungen gespeichert' })
    } catch {
      toast({ title: 'Fehler', description: 'Speichern fehlgeschlagen', variant: 'destructive' })
    }
  }

  async function handleTestMail(e: React.FormEvent) {
    e.preventDefault()
    try {
      const result = await sendTestMail.mutateAsync(testMailTo.trim())
      toast({ title: 'Test-Mail gesendet', description: result.message })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'SMTP-Fehler'
      toast({ title: 'Fehler', description: msg, variant: 'destructive' })
    }
  }

  async function handleCreateRange(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createRange.mutateAsync({
        portStart: Number(rangeStart),
        portEnd: Number(rangeEnd || rangeStart),
        reason: rangeReason.trim() || undefined,
      })
      setRangeStart('')
      setRangeEnd('')
      setRangeReason('')
      toast({ title: 'Port-Bereich gesperrt' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Fehler'
      toast({ title: 'Fehler', description: msg, variant: 'destructive' })
    }
  }

  async function handleDeleteRange(id: number) {
    try {
      await deleteRange.mutateAsync(id)
      setDeleteConfirmRangeId(null)
      toast({ title: 'Port-Bereich entsperrt' })
    } catch {
      toast({ title: 'Fehler', description: 'Löschen fehlgeschlagen', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-1">Einstellungen</h2>
        <p className="text-sm text-muted-foreground">Systemkonfiguration und Sicherheitseinstellungen</p>
      </div>

      {/* ── Wartungsmodus ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Wartungsmodus</h3>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lädt…</p>
          ) : (
            <>
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pfMaintenance}
                    onChange={(e) => setPfMaintenance(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      pfSense-Wartungsmodus
                      {pfMaintenance && (
                        <span className="text-xs font-mono text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">AKTIV</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sperrt alle pfSense-API-Operationen (Erstellen/Löschen von NAT-Regeln). Nur für Admins sichtbar.
                    </p>
                  </div>
                </label>
                <Separator />
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteMaintenance}
                    onChange={(e) => setSiteMaintenance(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      Website-Wartungsmodus
                      {siteMaintenance && (
                        <span className="text-xs font-mono text-red-400 border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 rounded">AKTIV</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Nicht-Admin-Benutzer können sich nicht einloggen. Nur Admins haben Zugang.
                    </p>
                  </div>
                </label>
              </div>

              <Button type="submit" disabled={updateSettings.isPending}>
                {settingsSaved ? (
                  <><Check className="h-4 w-4 mr-1.5" />Gespeichert</>
                ) : updateSettings.isPending ? 'Wird gespeichert…' : 'Einstellungen speichern'}
              </Button>
            </>
          )}
        </form>
      </section>

      {/* ── Benachrichtigungen ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Benachrichtigungen</h3>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b">
          {([
            { id: 'discord', label: 'Discord' },
            { id: 'email',   label: 'E-Mail' },
            { id: 'smtp',    label: 'SMTP-Server' },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setNotifTab(t.id)}
              className={cn(
                'flex-1 py-2 text-sm font-medium border-b-2 -mb-px transition-colors text-center',
                notifTab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {notifTab === 'discord' && (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Lädt…</p>
            ) : (
              <>
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Webhook-URL</Label>
                    <Input
                      type="url"
                      value={discordUrl}
                      onChange={(e) => setDiscordUrl(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="font-mono text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={discordEnabled}
                      onChange={(e) => setDiscordEnabled(e.target.checked)}
                      className="accent-primary"
                    />
                    Discord-Benachrichtigungen aktivieren
                  </label>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Discord — welche Ereignisse posten
                    </p>
                    <div className={cn('flex flex-wrap gap-4', !discordEnabled && 'opacity-50 pointer-events-none')}>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={discordNotifyCreate}
                          onChange={(e) => setDiscordNotifyCreate(e.target.checked)}
                          className="accent-primary"
                          disabled={!discordEnabled}
                        />
                        Regel erstellt
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={discordNotifyDelete}
                          onChange={(e) => setDiscordNotifyDelete(e.target.checked)}
                          className="accent-primary"
                          disabled={!discordEnabled}
                        />
                        Regel gelöscht
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={discordNotifyExpire}
                          onChange={(e) => setDiscordNotifyExpire(e.target.checked)}
                          className="accent-primary"
                          disabled={!discordEnabled}
                        />
                        Regel abgelaufen
                      </label>
                    </div>
                  </div>
                  {settings?.updatedBy && (
                    <p className="text-xs text-muted-foreground">
                      Zuletzt geändert von <span className="font-mono">{settings.updatedBy}</span>
                      {settings.updatedAt && ` · ${new Date(settings.updatedAt).toLocaleString('de-DE')}`}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={updateSettings.isPending}>
                  {settingsSaved ? (
                    <><Check className="h-4 w-4 mr-1.5" />Gespeichert</>
                  ) : updateSettings.isPending ? 'Wird gespeichert…' : 'Discord-Einstellungen speichern'}
                </Button>
              </>
            )}
          </form>
        )}

        {notifTab === 'email' && (
          <EmailProfilesSection />
        )}

        {notifTab === 'smtp' && (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              SMTP-Zugangsdaten für den E-Mail-Versand. Das Passwort wird verschlüsselt gespeichert und nie zurückgegeben.
            </p>

            <form onSubmit={handleSaveSmtp} className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">SMTP-Host</Label>
                    <Input
                      value={mailHost}
                      onChange={(e) => setMailHost(e.target.value)}
                      placeholder="smtp.example.com"
                      className="font-mono text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Port</Label>
                    <Input
                      type="number"
                      value={mailPort}
                      onChange={(e) => setMailPort(e.target.value)}
                      min={1}
                      max={65535}
                      className="font-mono text-sm h-8 w-24"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Benutzername</Label>
                    <Input
                      value={mailUsername}
                      onChange={(e) => setMailUsername(e.target.value)}
                      placeholder="user@example.com"
                      autoComplete="off"
                      className="font-mono text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Passwort
                      {settings?.mailPasswordSet && (
                        <span className="ml-1.5 text-emerald-500 font-mono text-[10px]">● gesetzt</span>
                      )}
                    </Label>
                    <Input
                      type="password"
                      value={mailPassword}
                      onChange={(e) => setMailPassword(e.target.value)}
                      placeholder={settings?.mailPasswordSet ? '(unverändert)' : 'Passwort eingeben'}
                      autoComplete="new-password"
                      className="font-mono text-sm h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Absender-Adresse (From)</Label>
                  <Input
                    type="email"
                    value={mailFrom}
                    onChange={(e) => setMailFrom(e.target.value)}
                    placeholder="hacksmc@example.com"
                    className="font-mono text-sm h-8"
                  />
                </div>
                <Separator />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mailTlsEnabled}
                    onChange={(e) => setMailTlsEnabled(e.target.checked)}
                    className="accent-primary"
                  />
                  STARTTLS aktivieren
                </label>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button type="submit" disabled={updateSettings.isPending}>
                  {smtpSaved ? (
                    <><Check className="h-4 w-4 mr-1.5" />Gespeichert</>
                  ) : updateSettings.isPending ? 'Wird gespeichert…' : (
                    <><Mail className="h-4 w-4 mr-1.5" />SMTP speichern</>
                  )}
                </Button>
              </div>
            </form>

            <Separator />

            {/* Test-Mail */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                Test-E-Mail senden
              </h4>
              <p className="text-xs text-muted-foreground">
                Sendet eine Test-Mail über die aktuell gespeicherte SMTP-Konfiguration.
              </p>
              <form onSubmit={handleTestMail} className="flex gap-2 items-end flex-wrap">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Empfänger</Label>
                  <Input
                    type="email"
                    value={testMailTo}
                    onChange={(e) => setTestMailTo(e.target.value)}
                    placeholder="test@example.com"
                    required
                    className="font-mono text-sm h-8"
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={sendTestMail.isPending || !testMailTo}
                  className="h-8"
                >
                  {sendTestMail.isPending ? 'Sendet…' : (
                    <><Send className="h-3.5 w-3.5 mr-1" />Senden</>
                  )}
                </Button>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* ── Gesperrte Port-Bereiche ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Gesperrte Port-Bereiche</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Diese Port-Bereiche sind für alle Benutzer gesperrt und können nicht in NAT-Regeln verwendet werden.
        </p>

        <form onSubmit={handleCreateRange} className="flex gap-2 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Start</Label>
            <Input
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              placeholder="Von"
              min={1}
              max={65535}
              required
              className="font-mono w-24 h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ende</Label>
            <Input
              type="number"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              placeholder="Bis"
              min={1}
              max={65535}
              className="font-mono w-24 h-8"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[160px]">
            <Label className="text-xs">Grund (optional)</Label>
            <Input
              value={rangeReason}
              onChange={(e) => setRangeReason(e.target.value)}
              placeholder="z.B. System-Port"
              className="h-8 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={createRange.isPending || !rangeStart} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Sperren
          </Button>
        </form>

        <div className="rounded-xl border bg-card overflow-hidden">
          {rangesLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Lädt…</div>
          ) : blockedRanges.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Keine gesperrten Bereiche</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Port-Bereich</TableHead>
                  <TableHead>Grund</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedRanges.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm font-semibold text-primary">
                      {r.portStart === r.portEnd ? r.portStart : `${r.portStart}–${r.portEnd}`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reason ?? <span className="italic text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('de-DE')}
                    </TableCell>
                    <TableCell className="text-right">
                      {deleteConfirmRangeId === r.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Entsperren?</span>
                          <Button size="sm" variant="destructive" disabled={deleteRange.isPending} onClick={() => handleDeleteRange(r.id)}>Ja</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmRangeId(null)}>Nein</Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirmRangeId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'users' | 'hosts' | 'rules' | 'audit' | 'pfsense' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'users', label: 'Benutzer', icon: <Users className="h-4 w-4" /> },
  { id: 'hosts', label: 'Hosts', icon: <Server className="h-4 w-4" /> },
  { id: 'rules', label: 'NAT-Regeln', icon: <Network className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit-Log', icon: <ScrollText className="h-4 w-4" /> },
  { id: 'pfsense', label: 'pfSense', icon: <Wifi className="h-4 w-4" /> },
  { id: 'settings', label: 'Einstellungen', icon: <Settings className="h-4 w-4" /> },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')

  return (
    <Layout>
      <div className="flex gap-1 mb-8 border-b pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'hosts' && <HostsTab />}
      {activeTab === 'rules' && <NatRulesTab />}
      {activeTab === 'audit' && <AuditLogTab />}
      {activeTab === 'pfsense' && <PfSenseTab />}
      {activeTab === 'settings' && <EinstellungenTab />}
    </Layout>
  )
}
