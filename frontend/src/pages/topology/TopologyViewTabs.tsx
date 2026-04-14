import { useEffect, useRef, useState } from 'react'
import { Zap, Plus, X, Check, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TopologyViewDto } from '@/hooks/useTopology'

interface Props {
  views: TopologyViewDto[]
  selectedViewId: number
  onSelect: (id: number) => void
  onCreateView: (name: string) => void
  onDeleteView: (id: number) => void
  onRenameView: (id: number, name: string) => void
  isAdmin: boolean
}

export function TopologyViewTabs({
  views,
  selectedViewId,
  onSelect,
  onCreateView,
  onDeleteView,
  onRenameView,
  isAdmin,
}: Props) {
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creatingNew) newInputRef.current?.focus()
  }, [creatingNew])

  useEffect(() => {
    if (renamingId != null) renameInputRef.current?.focus()
  }, [renamingId])

  function handleCreateSubmit() {
    const name = newName.trim()
    if (name) onCreateView(name)
    setCreatingNew(false)
    setNewName('')
  }

  function handleRenameSubmit(id: number) {
    const name = renameValue.trim()
    if (name) onRenameView(id, name)
    setRenamingId(null)
    setRenameValue('')
  }

  function startRename(view: TopologyViewDto) {
    setRenamingId(view.id)
    setRenameValue(view.name)
  }

  return (
    <div className="flex items-center gap-0 border-b bg-background px-2 overflow-x-auto min-h-[36px] shrink-0">
      {views.map(view => {
        const isSelected = view.id === selectedViewId
        const isRenaming = renamingId === view.id
        return (
          <div
            key={view.id}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 py-1.5 cursor-pointer shrink-0',
              'text-sm border-b-2 transition-colors select-none',
              isSelected
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
            onClick={() => !isRenaming && onSelect(view.id)}
            onDoubleClick={() => isAdmin && !view.isAuto && startRename(view)}
          >
            {view.isAuto && <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />}

            {isRenaming ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  ref={renameInputRef}
                  className="w-24 bg-transparent border-b border-primary outline-none text-sm text-foreground"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameSubmit(view.id)
                    if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                  }}
                />
                <button
                  className="text-primary hover:opacity-80"
                  onClick={() => handleRenameSubmit(view.id)}
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <span>{view.name}</span>
            )}

            {isAdmin && !view.isAuto && !isRenaming && (
              <>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground ml-0.5"
                  onClick={e => { e.stopPropagation(); startRename(view) }}
                  title="Umbenennen"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={e => { e.stopPropagation(); onDeleteView(view.id) }}
                  title="Ansicht löschen"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )
      })}

      {/* New-view creation inline */}
      {isAdmin && (
        creatingNew ? (
          <div className="flex items-center gap-1 px-2 py-1.5" onClick={e => e.stopPropagation()}>
            <input
              ref={newInputRef}
              className="w-28 bg-transparent border-b border-primary outline-none text-sm text-foreground placeholder:text-muted-foreground"
              placeholder="Name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateSubmit()
                if (e.key === 'Escape') { setCreatingNew(false); setNewName('') }
              }}
              onBlur={handleCreateSubmit}
            />
            <button className="text-primary hover:opacity-80" onClick={handleCreateSubmit}>
              <Check className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1 px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            onClick={() => setCreatingNew(true)}
            title="Neue Ansicht erstellen"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )
      )}
    </div>
  )
}
