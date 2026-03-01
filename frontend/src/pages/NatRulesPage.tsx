import { useState, type FormEvent } from 'react'
import Layout from '@/components/Layout'
import { useHosts } from '@/hooks/useHosts'
import { useNatRules, useCreateNatRule, useDeleteNatRule, type NatRule } from '@/hooks/useNatRules'
import { usePolicies } from '@/hooks/usePolicies'
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<NatRule['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  PENDING: 'secondary',
  DELETED: 'outline',
}

function StatusBadge({ status }: { status: NatRule['status'] }) {
  const label = { ACTIVE: 'Active', PENDING: 'Pending', DELETED: 'Deleted' }[status]
  const dotColor = {
    ACTIVE: 'bg-emerald-500',
    PENDING: 'bg-amber-400',
    DELETED: 'bg-muted-foreground',
  }[status]

  return (
    <Badge variant={STATUS_VARIANT[status]} className="gap-1.5">
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor, status === 'ACTIVE' && 'pulse-dot')} />
      {label}
    </Badge>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NatRulesPage() {
  const { data: rules = [], isLoading } = useNatRules()
  const { data: hosts = [] } = useHosts()
  const { data: policies = [] } = usePolicies()
  const createMutation = useCreateNatRule()
  const deleteMutation = useDeleteNatRule()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedHostId, setSelectedHostId] = useState('')
  const [protocol, setProtocol] = useState('')
  const [port, setPort] = useState('')
  const [description, setDescription] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | NatRule['status']>('ALL')

  const selectedPolicy = policies.find((p) => p.host.id === Number(selectedHostId))
  const allowedProtocols = selectedPolicy
    ? selectedPolicy.allowedProtocols.split(',').map((s) => s.trim())
    : ['TCP', 'UDP']

  function resetForm() {
    setSelectedHostId('')
    setProtocol('')
    setPort('')
    setDescription('')
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open)
    if (!open) resetForm()
  }

  function handleHostChange(id: string) {
    setSelectedHostId(id)
    const pol = policies.find((p) => p.host.id === Number(id))
    setProtocol(pol ? pol.allowedProtocols.split(',')[0].trim() : 'TCP')
    setPort('')
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    try {
      await createMutation.mutateAsync({
        hostId: Number(selectedHostId),
        protocol,
        port: Number(port),
        description: description.trim() || undefined,
      })
      setDialogOpen(false)
      resetForm()
      toast({ title: 'Rule created', description: `${protocol} :${port} is now active.` })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to create rule'
      toast({ title: 'Creation failed', description: msg, variant: 'destructive' })
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteConfirmId(null)
      toast({ title: 'Rule deleted' })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to delete rule'
      toast({ title: 'Deletion failed', description: msg, variant: 'destructive' })
      setDeleteConfirmId(null)
    }
  }

  const activeCount = rules.filter((r) => r.status === 'ACTIVE').length
  const filtered = statusFilter === 'ALL' ? rules : rules.filter((r) => r.status === statusFilter)

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">NAT Rules</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${activeCount} active rule${activeCount !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="DELETED">Deleted</SelectItem>
            </SelectContent>
          </Select>

        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button disabled={hosts.length === 0}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-1.5">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New Rule
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Create NAT Rule</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreate} id="create-rule-form" className="space-y-4 py-2">
              {/* Host */}
              <div className="space-y-1.5">
                <Label htmlFor="host">Host</Label>
                <Select value={selectedHostId} onValueChange={handleHostChange} required>
                  <SelectTrigger id="host">
                    <SelectValue placeholder="Select a host…" />
                  </SelectTrigger>
                  <SelectContent>
                    {hosts.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>
                        {h.name} — <span className="font-mono text-xs">{h.ipAddress}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Protocol */}
              <div className="space-y-1.5">
                <Label htmlFor="protocol">Protocol</Label>
                <Select value={protocol} onValueChange={setProtocol} required>
                  <SelectTrigger id="protocol">
                    <SelectValue placeholder="Select protocol…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedProtocols.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPolicy && (
                  <p className="text-xs text-muted-foreground">
                    Allowed: <span className="font-mono">{selectedPolicy.allowedProtocols}</span>
                  </p>
                )}
              </div>

              {/* Port */}
              <div className="space-y-1.5">
                <Label htmlFor="port">
                  Port{' '}
                  {selectedPolicy && (
                    <span className="text-muted-foreground font-normal">
                      ({selectedPolicy.portRangeMin}–{selectedPolicy.portRangeMax})
                    </span>
                  )}
                </Label>
                <Input
                  id="port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  min={selectedPolicy?.portRangeMin ?? 1}
                  max={selectedPolicy?.portRangeMax ?? 65535}
                  placeholder="e.g. 25565"
                  required
                  className="font-mono"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">
                  Description{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Minecraft server"
                  maxLength={255}
                />
              </div>
            </form>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                form="create-rule-form"
                disabled={createMutation.isPending || !selectedHostId || !protocol || !port}
              >
                {createMutation.isPending ? 'Creating…' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Rules table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-14 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'ALL' ? 'No NAT rules yet' : `No ${statusFilter} rules`}
            </p>
            {statusFilter === 'ALL' && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create your first rule to get started
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Host</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rule) => (
                <TableRow
                  key={rule.id}
                  className={rule.status === 'DELETED' ? 'opacity-40' : ''}
                >
                  <TableCell>
                    <div className="font-medium">{rule.host.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {rule.host.ipAddress}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {rule.protocol}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono font-semibold text-primary">
                    {rule.port}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[180px] truncate">
                    {rule.description ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={rule.status} />
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(rule.createdAt).toLocaleDateString('de-DE')}
                  </TableCell>
                  <TableCell className="text-right">
                    {rule.status !== 'DELETED' &&
                      (deleteConfirmId === rule.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Delete?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(rule.id)}
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            No
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteConfirmId(rule.id)}
                        >
                          Delete
                        </Button>
                      ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Layout>
  )
}
