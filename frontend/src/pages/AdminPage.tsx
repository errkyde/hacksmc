import { useState, useEffect, Fragment, type FormEvent } from 'react'
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
  useDeleteGlobalHost,
  useAdminRules,
  useAuditLog,
  usePfSenseStatus,
  type AdminUser,
  type HostDto,
  type AdminNatRule,
  type AuditLogEntry,
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
import { cn } from '@/lib/utils'
import { ChevronRight, Plus, Trash2, Pencil, Server, RefreshCw, Copy, Check, Users, Network, KeyRound, Lock, Unlock, ScrollText, Wifi } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge
      variant={role === 'ADMIN' ? 'default' : 'secondary'}
      className="font-mono text-xs"
    >
      {role}
    </Badge>
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | AdminNatRule['status']>('ALL')

  const filtered = statusFilter === 'ALL' ? rules : rules.filter((r) => r.status === statusFilter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">NAT-Regeln</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${filtered.length} Regel${filtered.length !== 1 ? 'n' : ''}`}
            {statusFilter !== 'ALL' && ` (${statusFilter})`}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px]">
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
                <TableHead>Benutzer</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Protokoll</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erstellt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rule) => (
                <TableRow key={rule.id}>
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
                  <TableCell className="font-mono text-sm">
                    {rule.port}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={rule.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(rule.createdAt).toLocaleString('de-DE')}
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
  NAT_RULE_CREATED:  'text-cyan-400',
  NAT_RULE_DELETED:  'text-rose-400',
}

function AuditLogTab() {
  const { data: entries = [], isLoading } = useAuditLog()

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Audit-Log</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? '…' : `${entries.length} Einträge`} · wird alle 30 s aktualisiert
        </p>
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
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>
            {done ? 'Passwort zurückgesetzt' : (
              <>Passwort für <span className="font-mono text-primary">@{user.username}</span> zurücksetzen</>
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
      <DialogContent className="sm:max-w-[400px]">
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
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useToast()
  const createHost = useCreateGlobalHost()
  const [name, setName] = useState('')
  const [ip, setIp] = useState('')
  const [description, setDescription] = useState('')

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
      <DialogContent className="sm:max-w-[420px]">
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
                className="font-mono"
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
      <DialogContent className="sm:max-w-[440px]">
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
      <DialogContent className="sm:max-w-[400px]">
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

// ─── Hosts Tab ─────────────────────────────────────────────────────────────────

function HostsTab() {
  const { data: hosts = [], isLoading } = useAllHosts()
  const deleteHost = useDeleteGlobalHost()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  async function handleDelete(hostId: number) {
    try {
      await deleteHost.mutateAsync(hostId)
      setDeleteConfirmId(null)
      toast({ title: 'Host gelöscht' })
    } catch {
      toast({ title: 'Fehler', description: 'Host konnte nicht gelöscht werden. Möglicherweise existieren noch aktive NAT-Regeln.', variant: 'destructive' })
      setDeleteConfirmId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Hosts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${hosts.length} Host${hosts.length !== 1 ? 's' : ''}`} · globale Ressourcen
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Neuer Host
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-14 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : hosts.length === 0 ? (
          <div className="py-16 text-center">
            <Server className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Noch keine Hosts angelegt.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Lege Hosts hier an und weise sie dann Benutzern zu.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>IP-Adresse</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hosts.map((host) => (
                <TableRow key={host.id}>
                  <TableCell className="font-medium font-mono">{host.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{host.ipAddress}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {host.description ?? <span className="italic text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {deleteConfirmId === host.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Löschen?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2"
                          disabled={deleteHost.isPending}
                          onClick={() => handleDelete(host.id)}
                        >
                          Ja
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          Nein
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteConfirmId(host.id)}
                        title="Host löschen"
                      >
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

      <CreateGlobalHostDialog open={createOpen} onOpenChange={setCreateOpen} />
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

function PfSenseTab() {
  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = usePfSenseStatus()
  const up = data?.status === 'UP'
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleString('de-DE')
    : null

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
          onClick={() => refetch()}
          disabled={isFetching}
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
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">Fehlerdetail</p>
          <p className="text-sm font-mono text-red-300/80 break-all">{data.error}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'users' | 'hosts' | 'rules' | 'audit' | 'pfsense'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'users', label: 'Benutzer', icon: <Users className="h-4 w-4" /> },
  { id: 'hosts', label: 'Hosts', icon: <Server className="h-4 w-4" /> },
  { id: 'rules', label: 'NAT-Regeln', icon: <Network className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit-Log', icon: <ScrollText className="h-4 w-4" /> },
  { id: 'pfsense', label: 'pfSense', icon: <Wifi className="h-4 w-4" /> },
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
    </Layout>
  )
}
