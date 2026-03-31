import { useState } from 'react'
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NetworkGroupDto } from '@/hooks/useTopology'

interface Props {
  groups: NetworkGroupDto[]
  search: string
  onSearchChange: (v: string) => void
  isAdmin: boolean
  onAddGroup: () => void
  onDeleteGroup: (id: number) => void
  onToggleHidden: (id: number, hidden: boolean) => void
  focusedGroupId: number | null
  onFocusGroup: (id: number | null) => void
}

export function TopologyLeftSidebar({
  groups,
  search,
  onSearchChange,
  isAdmin,
  onAddGroup,
  onDeleteGroup,
  onToggleHidden,
  focusedGroupId,
  onFocusGroup,
}: Props) {
  return (
    <div className="flex w-52 shrink-0 flex-col border-r bg-background">
      <div className="border-b px-3 py-2">
        <Input
          placeholder="Suchen…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Gruppen
          </span>
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onAddGroup}>
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/50',
            focusedGroupId === null && 'bg-muted/40 font-medium',
          )}
          onClick={() => onFocusGroup(null)}
        >
          <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
          <span className="flex-1 truncate text-muted-foreground">Alle anzeigen</span>
        </div>

        {groups.map(g => (
          <GroupRow
            key={g.id}
            group={g}
            isAdmin={isAdmin}
            focused={focusedGroupId === g.id}
            onFocus={() => onFocusGroup(focusedGroupId === g.id ? null : g.id)}
            onDelete={() => onDeleteGroup(g.id)}
            onToggleHidden={() => onToggleHidden(g.id, !g.hidden)}
          />
        ))}

        {groups.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Keine Gruppen</p>
        )}
      </div>
    </div>
  )
}

function GroupRow({
  group,
  isAdmin,
  focused,
  onFocus,
  onDelete,
  onToggleHidden,
}: {
  group: NetworkGroupDto
  isAdmin: boolean
  focused: boolean
  onFocus: () => void
  onDelete: () => void
  onToggleHidden: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-muted/50 cursor-pointer',
        focused && 'bg-muted/40 font-medium',
        group.hidden && 'opacity-40',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onFocus}
    >
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ background: group.hidden ? '#64748b' : group.color }}
      />
      <span className={cn('flex-1 truncate', group.hidden && 'line-through')}>{group.name}</span>
      {isAdmin && hovered && (
        <>
          <button
            className="text-muted-foreground hover:text-foreground"
            title={group.hidden ? 'Einblenden' : 'Ausblenden'}
            onClick={e => { e.stopPropagation(); onToggleHidden() }}
          >
            {group.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
          <button
            className="text-destructive hover:opacity-70"
            onClick={e => { e.stopPropagation(); onDelete() }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}
