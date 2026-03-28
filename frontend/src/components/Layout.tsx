import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, clearToken, getTokenPayload } from '@/lib/api'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/use-toast'
import { usePfSenseStatus } from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Moon, Sun, LogOut, KeyRound } from 'lucide-react'

const BASE_NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/rules', label: 'NAT Rules' },
  { href: '/topology', label: 'Topologie' },
]

// ─── Change Password Dialog ────────────────────────────────────────────────────

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setCurrent(''); setNext(''); setConfirm('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (next !== confirm) {
      toast({ title: 'Fehler', description: 'Die neuen Passwörter stimmen nicht überein.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next })
      toast({ title: 'Passwort geändert', description: 'Bitte melde dich erneut an.' })
      onOpenChange(false)
      reset()
      clearToken()
      navigate('/login')
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Fehler beim Ändern'
      toast({ title: 'Fehler', description: detail, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Passwort ändern</DialogTitle>
        </DialogHeader>
        <form id="change-pw-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Aktuelles Passwort</Label>
            <Input
              id="cp-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">Neues Passwort</Label>
            <Input
              id="cp-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="Mindestens 8 Zeichen"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Neues Passwort bestätigen</Label>
            <Input
              id="cp-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <Button type="submit" form="change-pw-form" disabled={loading}>
            {loading ? 'Speichert…' : 'Passwort ändern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Layout ────────────────────────────────────────────────────────────────────

function PfSenseStatusBadge() {
  const { data } = usePfSenseStatus()
  if (!data) return null
  const up = data.status === 'UP'
  return (
    <span
      title={up ? `pfSense UP — ${data.latencyMs}ms` : 'pfSense DOWN'}
      className={cn(
        'hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full border',
        up
          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
          : 'text-red-400 border-red-500/30 bg-red-500/10'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', up ? 'bg-emerald-400 pulse-dot' : 'bg-red-400')} />
      pfSense
    </span>
  )
}

export default function Layout({ children, fluid }: { children: React.ReactNode; fluid?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const payload = getTokenPayload()
  const username = payload?.sub ?? ''
  const isAdmin = payload?.role === 'ADMIN'
  const navItems = isAdmin ? [...BASE_NAV, { href: '/admin', label: 'Admin' }] : BASE_NAV

  const [changePwOpen, setChangePwOpen] = useState(false)

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  return (
    <div className={cn('min-h-screen bg-background dot-grid', fluid && 'h-screen flex flex-col', isAdmin && 'admin-mode')}>
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          {/* Brand + nav */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 select-none">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <rect x="1" y="1" width="18" height="18" rx="3" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                <rect x="4" y="5" width="12" height="2" rx="1" fill="hsl(var(--primary))" />
                <rect x="4" y="9" width="8" height="2" rx="1" fill="hsl(var(--primary))" opacity="0.6" />
                <rect x="4" y="13" width="10" height="2" rx="1" fill="hsl(var(--primary))" opacity="0.35" />
              </svg>
              <span className="font-mono text-[13px] font-bold tracking-[0.18em] text-foreground uppercase">
                HackSMC
              </span>
            </div>

            <Separator orientation="vertical" className="h-5" />

            <nav className="flex items-center gap-0.5">
              {navItems.map((item) => {
                const active = location.pathname === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {isAdmin && <PfSenseStatusBadge />}

            {username && (
              <span className="hidden sm:block text-[11px] font-mono text-muted-foreground px-2">
                {username}
              </span>
            )}

            {/* Theme toggle */}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="h-8 w-8">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Change password */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChangePwOpen(true)}
              aria-label="Passwort ändern"
              className="h-8 w-8"
              title="Passwort ändern"
            >
              <KeyRound className="h-4 w-4" />
            </Button>

            {/* Logout */}
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className={cn(fluid ? 'flex-1 overflow-hidden flex flex-col' : 'mx-auto max-w-7xl px-6 py-8')}>
        {children}
      </main>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
    </div>
  )
}
