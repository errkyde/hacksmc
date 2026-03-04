import { Link } from 'react-router-dom'
import Layout from '@/components/Layout'
import { useHosts } from '@/hooks/useHosts'
import { useNatRules } from '@/hooks/useNatRules'
import { usePolicies } from '@/hooks/usePolicies'
import { useHostStatus } from '@/hooks/useHostStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Wifi, WifiOff } from 'lucide-react'

export default function DashboardPage() {
  const { data: hosts = [], isLoading: hostsLoading } = useHosts()
  const { data: rules = [], isLoading: rulesLoading } = useNatRules()
  const { data: policies = [] } = usePolicies()
  const { data: hostStatus = {}, isLoading: statusLoading } = useHostStatus()

  const activeRules = rules.filter((r) => r.status === 'ACTIVE')
  const pendingRules = rules.filter((r) => r.status === 'PENDING')
  const isLoading = hostsLoading || rulesLoading

  return (
    <Layout>
      <div className="mb-8">
        <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of your hosts and NAT rules
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Hosts', value: hosts.length, highlight: false },
          { label: 'Active Rules', value: activeRules.length, highlight: true },
          { label: 'Pending', value: pendingRules.length, highlight: false },
        ].map((stat) => (
          <Card key={stat.label} className={stat.highlight ? 'border-primary/30' : ''}>
            <CardContent className="pt-6">
              <div
                className={cn(
                  'text-3xl font-mono font-bold',
                  stat.highlight ? 'text-primary' : 'text-foreground'
                )}
              >
                {isLoading ? '—' : stat.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-mono">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Host grid */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Your Hosts</h3>
        <Link to="/rules" className="text-xs text-primary hover:text-primary/80 transition-colors">
          Manage rules →
        </Link>
      </div>

      {hostsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-muted rounded w-28 mb-3" />
                <div className="h-3 bg-muted rounded w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : hosts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No hosts assigned to your account.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Contact your administrator to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hosts.map((host) => {
            const policy = policies.find((p) => p.host.id === host.id)
            const hostActiveRules = activeRules.filter((r) => r.host.id === host.id)
            const maxRules = policy?.maxRules ?? 0
            const usage = maxRules > 0 ? hostActiveRules.length / maxRules : 0
            const atLimit = hostActiveRules.length >= maxRules && maxRules > 0
            const online = hostStatus[host.id]
            const statusKnown = !statusLoading && host.id in hostStatus

            return (
              <Card key={host.id} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">{host.name}</CardTitle>
                      {host.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{host.description}</p>
                      )}
                    </div>
                    <span
                      className="flex items-center gap-1.5 mt-0.5"
                      title={!statusKnown ? 'Checking…' : online ? 'Online' : 'Offline'}
                    >
                      {!statusKnown ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                      ) : online ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      )}
                      <span className={cn(
                        'text-[10px] font-mono',
                        !statusKnown ? 'text-muted-foreground/40' : online ? 'text-emerald-500' : 'text-red-500'
                      )}>
                        {!statusKnown ? '…' : online ? 'online' : 'offline'}
                      </span>
                    </span>
                  </div>
                  <p className="font-mono text-xs text-primary">{host.ipAddress}</p>
                </CardHeader>

                {policy && (
                  <>
                    <Separator />
                    <CardContent className="pt-4 space-y-3">
                      {/* Rule usage bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">Rules used</span>
                          <span
                            className={cn(
                              'font-mono font-medium',
                              atLimit ? 'text-destructive' : 'text-foreground'
                            )}
                          >
                            {hostActiveRules.length}/{maxRules}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              atLimit ? 'bg-destructive' : 'bg-primary'
                            )}
                            style={{ width: `${Math.min(usage * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Policy tags */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1 flex-wrap">
                          {policy.allowedProtocols.split(',').map((p) => (
                            <Badge key={p} variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                              {p.trim()}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {policy.portRangeMin}–{policy.portRangeMax}
                        </span>
                      </div>

                      {/* Active rules list */}
                      {hostActiveRules.length > 0 && (
                        <div className="pt-1 space-y-1">
                          {hostActiveRules.map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Wifi className="h-3 w-3 text-emerald-500" />
                                <span className="font-mono">{r.protocol}:{r.port}</span>
                              </span>
                              {r.description && (
                                <span className="text-muted-foreground/70 truncate max-w-[120px]">{r.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {hostActiveRules.length === 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 pt-1">
                          <WifiOff className="h-3 w-3" />
                          <span>No active rules</span>
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
