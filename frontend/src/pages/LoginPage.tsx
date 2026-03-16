import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken, getTokenPayload } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/auth/login', { username, password })
      setToken(res.data.token)
      const payload = getTokenPayload()
      navigate(payload?.role === 'ADMIN' ? '/admin' : '/')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Invalid credentials'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background dot-grid flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[340px]">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-primary/40 bg-primary/8 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="4" stroke="hsl(var(--primary))" strokeWidth="1.5" />
              <rect x="5" y="7" width="14" height="2.5" rx="1.25" fill="hsl(var(--primary))" />
              <rect x="5" y="11" width="9" height="2.5" rx="1.25" fill="hsl(var(--primary))" opacity="0.55" />
              <rect x="5" y="15" width="11" height="2.5" rx="1.25" fill="hsl(var(--primary))" opacity="0.3" />
            </svg>
          </div>
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-foreground uppercase">
            HackSMC
          </h1>
          <p className="text-[11px] font-mono tracking-[0.15em] text-muted-foreground mt-1 uppercase">
            NAT Management Portal
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <p className="text-sm text-muted-foreground text-center">Sign in to your account</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="your.username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Authenticating…' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/50 mt-6 font-mono tracking-wider">
          VPN ACCESS REQUIRED
        </p>
      </div>
    </div>
  )
}
