import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  BaseEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getStraightPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BoardItemKind, BoardPin } from '../contracts/game-api'
import { isMockMode } from '../lib/mock'
import { useGameStore } from '../stores/gameStore'
import { InvestigationDialog } from './InvestigationDialog'

interface BoardNodeData extends Record<string, unknown> {
  kind: BoardItemKind
  title: string
  summary: string
  meta?: string
  onEdit?: () => void
  onRemove: () => void
}

type BoardNode = Node<BoardNodeData, 'boardCard'>
type BoardEdge = Edge<{ onRemove: () => void }, 'boardString'>

interface ResolvedItem {
  title: string
  summary: string
  meta?: string
}

interface InvestigationBoardProps {
  onReturnToStation: () => void
}

const GRID_COLUMNS = 3
const NODE_SPACING_X = 280
const NODE_SPACING_Y = 210

function kindLabel(kind: BoardItemKind): string {
  switch (kind) {
    case 'clue':
      return 'Evidence'
    case 'suspect':
      return 'Suspect'
    case 'quote':
      return 'Interview quote'
    case 'note':
      return 'Team note'
  }
}

function BoardCardNode({ data, selected }: NodeProps<BoardNode>) {
  return (
    <article className="investigation-board-card" data-kind={data.kind} data-selected={selected}>
      <Handle type="target" position={Position.Left} aria-label={`Connect to ${data.title}`} />
      <header className="investigation-board-card-header">
        <span className="investigation-board-card-kind">{kindLabel(data.kind)}</span>
        <button
          type="button"
          className="investigation-board-card-remove nodrag"
          aria-label={`Remove ${data.title} from the board`}
          title="Remove from board"
          onClick={(event) => {
            event.stopPropagation()
            data.onRemove()
          }}
        >
          ×
        </button>
      </header>
      <h3 className="investigation-board-card-title">{data.title}</h3>
      {data.meta && <p className="investigation-board-card-meta">{data.meta}</p>}
      <p className="investigation-board-card-summary">{data.summary}</p>
      {data.onEdit && (
        <button
          type="button"
          className="investigation-board-card-edit nodrag"
          onClick={(event) => {
            event.stopPropagation()
            data.onEdit?.()
          }}
        >
          Edit note
        </button>
      )}
      <Handle type="source" position={Position.Right} aria-label={`Connect from ${data.title}`} />
    </article>
  )
}

const nodeTypes = { boardCard: BoardCardNode }

function BoardStringEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
}: EdgeProps<BoardEdge>) {
  const [path, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  return (
    <>
      <BaseEdge id={id} path={path} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="investigation-board-string-remove nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            aria-label="Remove string"
            title="Remove string"
            onClick={(event) => {
              event.stopPropagation()
              data?.onRemove()
            }}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = { boardString: BoardStringEdge }

function itemKey(kind: BoardItemKind, ref: string): string {
  return `${kind}:${ref}`
}

function InvestigationBoardCanvas({ onReturnToStation }: InvestigationBoardProps) {
  const snapshot = useGameStore((state) => state.snapshot)
  const pinBoardItem = useGameStore((state) => state.pinBoardItem)
  const addBoardNote = useGameStore((state) => state.addBoardNote)
  const editBoardNote = useGameStore((state) => state.editBoardNote)
  const moveBoardItem = useGameStore((state) => state.moveBoardItem)
  const connectBoardItems = useGameStore((state) => state.connectBoardItems)
  const removeBoardItem = useGameStore((state) => state.removeBoardItem)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, applyFlowNodeChanges] = useNodesState<BoardNode>([])
  const [edges, setEdges, applyFlowEdgeChanges] = useEdgesState<BoardEdge>([])
  const [draftNote, setDraftNote] = useState('')
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const board = snapshot?.board
  const boardItems = useMemo(() => board?.items ?? [], [board?.items])
  const boardLinks = useMemo(() => board?.links ?? [], [board?.links])

  const resolvedItems = useMemo(() => {
    const resolved = new Map<string, ResolvedItem>()
    if (!snapshot) return resolved

    // Notebooks are personal: a clue pinned by a teammate comes with its card on the board.
    const pinnedClues = snapshot.board.items.flatMap((item) => (item.clue ? [item.clue] : []))
    for (const clue of [...pinnedClues, ...snapshot.notebook]) {
      resolved.set(itemKey('clue', clue.id), {
        title: clue.title,
        summary: clue.text,
        meta: `Found in ${clue.room.replaceAll('_', ' ')}`,
      })
    }
    for (const suspect of snapshot.suspects) {
      resolved.set(itemKey('suspect', suspect.id), {
        title: suspect.name,
        summary: suspect.initial_statement,
        meta: suspect.role,
      })
    }
    const suspectNames = new Map(snapshot.suspects.map((suspect) => [suspect.id, suspect.name]))
    for (const interrogation of snapshot.interrogations) {
      for (const entry of interrogation.entries) {
        resolved.set(itemKey('quote', entry.id), {
          title: `${suspectNames.get(entry.suspect) ?? entry.suspect} — Interview answer`,
          summary: entry.answer,
          meta: entry.question,
        })
      }
    }
    return resolved
  }, [snapshot])

  const runAction = useCallback(
    async (label: string, action: () => Promise<{ ok: boolean; error?: string | null }>) => {
      if (pendingAction) return false
      setPendingAction(label)
      setBoardError(null)
      const ack = await action()
      if (!ack.ok) setBoardError(ack.error ?? `${label} could not be completed.`)
      setPendingAction(null)
      return ack.ok
    },
    [pendingAction],
  )

  const handleEditNote = useCallback((id: string, text: string) => {
    setEditingNote({ id, text })
  }, [])

  const handleRemoveItem = useCallback(
    (id: string) => {
      void runAction('Removing item', () => removeBoardItem({ id }))
    },
    [removeBoardItem, runAction],
  )

  const buildNodes = useCallback(
    (items: typeof boardItems): BoardNode[] =>
      items.map((item) => {
        const reference = item.ref ? resolvedItems.get(itemKey(item.kind, item.ref)) : undefined
        const data: BoardNodeData =
          item.kind === 'note'
            ? {
                kind: item.kind,
                title: 'Team note',
                summary: item.text ?? '',
                onEdit: () => handleEditNote(item.id, item.text ?? ''),
                onRemove: () => handleRemoveItem(item.id),
              }
            : {
                kind: item.kind,
                title: reference?.title ?? `Unavailable ${kindLabel(item.kind).toLowerCase()}`,
                summary:
                  reference?.summary ?? 'This item is no longer available in the game snapshot.',
                meta: reference?.meta,
                onRemove: () => handleRemoveItem(item.id),
              }
        return {
          id: item.id,
          type: 'boardCard',
          position: { x: item.x, y: item.y },
          data,
        }
      }),
    [handleEditNote, handleRemoveItem, resolvedItems],
  )

  useEffect(() => {
    setNodes(buildNodes(boardItems))
    setEdges(
      boardLinks.map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
        type: 'boardString',
        style: { stroke: 'var(--seal-burgundy)', strokeWidth: 2.5 },
        data: { onRemove: () => handleRemoveItem(link.id) },
      })),
    )
  }, [boardItems, boardLinks, buildNodes, handleRemoveItem, setEdges, setNodes])

  const onNodesChange: OnNodesChange<BoardNode> = useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      const removals = changes.filter((change) => change.type === 'remove')
      const remaining = changes.filter((change) => change.type !== 'remove')
      if (remaining.length) applyFlowNodeChanges(remaining)
      for (const change of removals) {
        if (change.type === 'remove') handleRemoveItem(change.id)
      }
    },
    [applyFlowNodeChanges, handleRemoveItem],
  )

  const onEdgesChange: OnEdgesChange<BoardEdge> = useCallback(
    (changes: EdgeChange<BoardEdge>[]) => {
      const removals = changes.filter((change) => change.type === 'remove')
      const remaining = changes.filter((change) => change.type !== 'remove')
      if (remaining.length) applyFlowEdgeChanges(remaining)
      for (const change of removals) {
        if (change.type === 'remove') handleRemoveItem(change.id)
      }
    },
    [applyFlowEdgeChanges, handleRemoveItem],
  )

  function nextPosition() {
    const rect = canvasRef.current?.getBoundingClientRect()
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 }
    const index = boardItems.length
    return {
      x: center.x - 120 + (index % GRID_COLUMNS) * NODE_SPACING_X,
      y: center.y - 80 + Math.floor(index / GRID_COLUMNS) * NODE_SPACING_Y,
    }
  }

  async function pin(kind: BoardPin['kind'], ref: string) {
    const position = nextPosition()
    await runAction(`Pinning ${kind}`, () => pinBoardItem({ kind, ref, ...position }))
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draftNote.trim()
    if (!text) return
    const position = nextPosition()
    const saved = await runAction('Adding note', () => addBoardNote({ text, ...position }))
    if (saved) setDraftNote('')
  }

  async function submitNoteEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingNote || !editingNote.text.trim()) return
    const saved = await runAction('Saving note', () =>
      editBoardNote({ item: editingNote.id, text: editingNote.text.trim() }),
    )
    if (saved) setEditingNote(null)
  }

  async function onConnect(connection: Connection) {
    if (!connection.source || !connection.target) return
    await runAction('Linking items', () =>
      connectBoardItems({ source: connection.source!, target: connection.target! }),
    )
  }

  async function onNodeDragStop(_event: MouseEvent | TouchEvent, node: BoardNode) {
    const moved = await runAction('Moving item', () =>
      moveBoardItem({ item: node.id, x: node.position.x, y: node.position.y }),
    )
    if (!moved) {
      const saved = boardItems.find((item) => item.id === node.id)
      if (saved) {
        setNodes((current) =>
          current.map((entry) =>
            entry.id === node.id ? { ...entry, position: { x: saved.x, y: saved.y } } : entry,
          ),
        )
      }
    }
  }

  const pinnedReferences = useMemo(
    () => new Set(boardItems.flatMap((item) => (item.ref ? [itemKey(item.kind, item.ref)] : []))),
    [boardItems],
  )
  const availableClues = (snapshot?.notebook ?? []).filter(
    (clue) => !pinnedReferences.has(itemKey('clue', clue.id)),
  )
  const availableSuspects = (snapshot?.suspects ?? []).filter(
    (suspect) => !pinnedReferences.has(itemKey('suspect', suspect.id)),
  )
  const quoteOptions = (snapshot?.interrogations ?? []).flatMap((interrogation) =>
    interrogation.entries.map((entry) => ({
      entry,
      suspect: snapshot?.suspects.find((suspect) => suspect.id === entry.suspect),
    })),
  )
  const availableQuotes = quoteOptions.filter(
    ({ entry }) => !pinnedReferences.has(itemKey('quote', entry.id)),
  )
  return (
    <section className="investigation-board" aria-labelledby="investigation-board-title">
      <header className="investigation-board-header">
        <div>
          <span className="investigation-board-kicker">POLICE STATION • SHARED CASE WALL</span>
          <h2 id="investigation-board-title" className="investigation-board-title">
            Investigation board
          </h2>
          <p className="investigation-board-intro">
            Arrange evidence, suspects, and interview answers. Connect related items with strings.
          </p>
        </div>
        <div className="investigation-board-header-actions">
          <button
            type="button"
            className="btn-order btn-order-secondary"
            onClick={onReturnToStation}
          >
            Return to Police Station
          </button>
        </div>
      </header>

      {isMockMode() && (
        <p className="investigation-board-notice" role="status">
          Shared board actions need a live game server. Set VITE_USE_MOCK=false and restart the
          frontend to edit this board.
        </p>
      )}
      {boardError && (
        <div className="dispatch-alert dispatch-alert-error" role="alert">
          <span>{boardError}</span>
          <button
            type="button"
            className="alert-close-btn"
            aria-label="Dismiss board error"
            onClick={() => setBoardError(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="investigation-board-layout">
        <div className="investigation-board-canvas" ref={canvasRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(connection) => void onConnect(connection)}
            onNodeDragStop={(event, node) => void onNodeDragStop(event, node)}
            nodesDraggable={pendingAction === null}
            nodesConnectable={pendingAction === null}
            elementsSelectable={pendingAction === null}
            deleteKeyCode={pendingAction === null ? ['Backspace', 'Delete'] : null}
            connectionLineType={ConnectionLineType.Straight}
            connectionLineStyle={{ stroke: 'var(--seal-burgundy)', strokeWidth: 2.5 }}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.25}
            maxZoom={1.5}
            snapToGrid
            snapGrid={[20, 20]}
            aria-label="Shared investigation board canvas"
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="rgba(190, 168, 135, 0.18)"
              gap={22}
              size={1}
            />
            <Controls showInteractive={false} />
          </ReactFlow>
          {nodes.length === 0 && (
            <p className="investigation-board-empty" role="status">
              The board is empty. Pin an item or add a note to begin.
            </p>
          )}
          {pendingAction && <span className="investigation-board-pending">{pendingAction}…</span>}
        </div>

        <aside className="investigation-board-tray" aria-label="Available items to pin">
          <div className="investigation-board-tray-heading">
            <h3>Available items</h3>
            <span>Pin to share with the team</span>
          </div>

          <section className="investigation-board-source-group" aria-labelledby="board-clues-title">
            <h4 id="board-clues-title">Clues</h4>
            {availableClues.length === 0 ? (
              <p className="investigation-board-source-empty">
                {snapshot?.notebook.length
                  ? 'All notebook clues are pinned.'
                  : 'No clues in your notebook yet.'}
              </p>
            ) : (
              <ul>
                {availableClues.map((clue) => (
                  <li key={clue.id}>
                    <button
                      type="button"
                      className="investigation-board-pin-option"
                      disabled={pendingAction !== null}
                      onClick={() => void pin('clue', clue.id)}
                    >
                      <span>{clue.title}</span>
                      <span className="investigation-board-pin-mark" aria-hidden="true">
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="investigation-board-source-group"
            aria-labelledby="board-suspects-title"
          >
            <h4 id="board-suspects-title">Suspects</h4>
            {availableSuspects.length === 0 ? (
              <p className="investigation-board-source-empty">
                {snapshot?.suspects.length
                  ? 'All suspects are pinned.'
                  : 'No suspects are available.'}
              </p>
            ) : (
              <ul>
                {availableSuspects.map((suspect) => (
                  <li key={suspect.id}>
                    <button
                      type="button"
                      className="investigation-board-pin-option"
                      disabled={pendingAction !== null}
                      onClick={() => void pin('suspect', suspect.id)}
                    >
                      <span>
                        {suspect.name}
                        <small>{suspect.role}</small>
                      </span>
                      <span className="investigation-board-pin-mark" aria-hidden="true">
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="investigation-board-source-group"
            aria-labelledby="board-quotes-title"
          >
            <h4 id="board-quotes-title">Interview quotes</h4>
            {availableQuotes.length === 0 ? (
              <p className="investigation-board-source-empty">
                {quoteOptions.length
                  ? 'All interview answers are pinned.'
                  : 'No interview answers yet.'}
              </p>
            ) : (
              <ul>
                {availableQuotes.map(({ entry, suspect }) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="investigation-board-pin-option"
                      disabled={pendingAction !== null}
                      onClick={() => void pin('quote', entry.id)}
                    >
                      <span>
                        {suspect?.name ?? entry.suspect}
                        <small>{entry.question}</small>
                      </span>
                      <span className="investigation-board-pin-mark" aria-hidden="true">
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form
            className="investigation-board-note-form"
            onSubmit={(event) => void submitNote(event)}
          >
            <label htmlFor="board-note">Free note</label>
            <textarea
              id="board-note"
              maxLength={500}
              rows={3}
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="Write a thought for the team…"
              disabled={pendingAction !== null}
            />
            <button
              type="submit"
              className="btn-order btn-order-primary"
              disabled={pendingAction !== null || !draftNote.trim()}
            >
              Add note
            </button>
          </form>
        </aside>
      </div>

      {editingNote && (
        <InvestigationDialog title="Edit team note" onClose={() => setEditingNote(null)}>
          <form
            className="investigation-board-edit-form"
            onSubmit={(event) => void submitNoteEdit(event)}
          >
            <label htmlFor="board-edit-note">Note text</label>
            <textarea
              id="board-edit-note"
              maxLength={500}
              rows={5}
              value={editingNote.text}
              onChange={(event) =>
                setEditingNote((current) =>
                  current ? { ...current, text: event.target.value } : null,
                )
              }
              disabled={pendingAction !== null}
            />
            <div className="investigation-board-edit-actions">
              <button
                type="button"
                className="btn-order btn-order-secondary"
                onClick={() => setEditingNote(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-order btn-order-primary"
                disabled={pendingAction !== null || !editingNote.text.trim()}
              >
                Save note
              </button>
            </div>
          </form>
        </InvestigationDialog>
      )}
    </section>
  )
}

export function InvestigationBoard(props: InvestigationBoardProps) {
  return (
    <ReactFlowProvider>
      <InvestigationBoardCanvas {...props} />
    </ReactFlowProvider>
  )
}
