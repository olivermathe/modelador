import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  ViewportPortal,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnDelete
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NO_GUIDES, snapToGuides, type Guides, type Rect } from '@/model/alignment'
import { areNested, containersOf, nestedWith } from '@/model/nesting'
import { relationNotation } from '@/model/archimate'
import { impactInfo } from '@/model/elementTypes'
import { ownersOf, selectedIds, technologiesOf, useModel, type ZOrderOp } from '@/model/store'
import { ArchimateMarkers, markerId, SELECTED_STROKE } from './ArchimateMarkers'
import { ContextMenu, type ContextMenuState } from './ContextMenu'
import { askPermanentDelete } from './deleteActions'
import { centerAnchor, DND_MIME, getDragPayload, isAnchorId } from './dnd'
import { ElementNode, type ElementFlowNode } from './ElementNode'
import { ShapeNode, type ShapeFlowNode } from './ShapeNode'
import { ToolSwitch } from './ToolSwitch'

const nodeTypes = { element: ElementNode, shape: ShapeNode }

type FlowNode = ElementFlowNode | ShapeFlowNode

/** Tamanho aproximado do nó, para centralizar no ponto onde foi solto. */
const NODE_HALF = { x: 120, y: 36 }

/** Distância, em pixels de tela, em que um item encaixa no alinhamento de outro. */
const SNAP_PX = 6

/** Escolhe os lados dos nós que se encaram, para a aresta não dar a volta. */
function facingSides(a: { x: number; y: number }, b: { x: number; y: number }): [Position, Position] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  // Nós são mais largos que altos: compara a distância normalizada pelo tamanho
  if (Math.abs(dx) / NODE_HALF.x > Math.abs(dy) / NODE_HALF.y) {
    return dx > 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right]
  }
  return dy > 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom]
}

const isEditingText = (): boolean => {
  const el = document.activeElement
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
}

export function Canvas(): JSX.Element {
  const resources = useModel((s) => s.resources)
  const technologies = useModel((s) => s.technologies)
  const relations = useModel((s) => s.relations)
  const activeDiagram = useModel((s) => s.activeDiagram)
  const diagram = useModel((s) => (s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined))
  const selection = useModel((s) => s.selection)
  const selectedItems = useModel((s) => s.selectedItems)
  const selectedEdges = useModel((s) => s.selectedEdges)
  // Ids selecionados (seleção simples ou múltipla), para destacar e para o React Flow mover juntos
  const selected = useMemo(() => {
    const ids = selectedIds({ selection, selectedItems, selectedEdges })
    return { items: new Set(ids.items), edges: new Set(ids.edges) }
  }, [selection, selectedItems, selectedEdges])
  const tool = useModel((s) => s.tool)
  const {
    moveItem,
    select,
    connect,
    createResource,
    placeResource,
    toggleTechnology,
    addShape,
    updateShape,
    duplicateShape,
    reorder,
    removeFromDiagram,
    removeEdgesFromDiagram,
    resizeNode,
    setEdgeAnchors,
    setTool,
    setHiddenEdges,
    notify
  } = useModel.getState()
  const { screenToFlowPosition, getZoom } = useReactFlow()
  const [guides, setGuides] = useState<Guides>(NO_GUIDES)
  // Tamanho medido de cada nó: é estado de tela, não vai para o arquivo
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  const [menu, setMenu] = useState<ContextMenuState | null>(null)

  const shapeIds = useMemo(() => new Set(diagram?.shapes.map((s) => s.id)), [diagram?.shapes])

  // Recursos e formas dividem a mesma pilha; as setas ficam logo abaixo do recurso mais ao fundo
  const edgeZ = useMemo(
    () => (diagram?.nodes.length ? Math.min(...diagram.nodes.map((n) => n.z ?? 0)) * 2 - 1 : 0),
    [diagram?.nodes]
  )

  const nodes = useMemo<FlowNode[]>(() => {
    if (!diagram) return []
    const elementNodes: ElementFlowNode[] = diagram.nodes
      .filter((n) => resources[n.resourceId])
      .map((n) => {
        const resource = resources[n.resourceId]
        return {
          id: n.resourceId,
          type: 'element',
          position: { x: n.x, y: n.y },
          ...(n.width && n.height ? { width: n.width, height: n.height } : {}),
          zIndex: (n.z ?? 0) * 2,
          data: {
            sized: !!(n.width && n.height),
            resource,
            locked: !!n.locked,
            technologies: technologiesOf(n.resourceId, relations, technologies).map((t) => t.technology.name),
            parentName:
              resource.type === 'endpoint'
                ? ownersOf(resource.id, resources, relations)
                    .map((o) => o.name)
                    .join(', ') || undefined
                : undefined
          },
          selected: selected.items.has(n.resourceId),
          measured: measured[n.resourceId],
          // Travado: não se move nem é selecionado; o mouse "atravessa" (só o cadeado responde)
          ...(n.locked ? { draggable: false, selectable: false, style: { pointerEvents: 'none' as const } } : {})
        }
      })
    const shapeNodes: ShapeFlowNode[] = diagram.shapes.map((shape) => ({
      id: shape.id,
      type: 'shape',
      position: { x: shape.x, y: shape.y },
      width: shape.width,
      height: shape.height,
      zIndex: (shape.z ?? 0) * 2,
      data: { shape },
      selected: selected.items.has(shape.id),
      measured: measured[shape.id],
      ...(shape.locked ? { draggable: false, selectable: false, style: { pointerEvents: 'none' as const } } : {})
    }))
    return [...shapeNodes, ...elementNodes]
  }, [diagram, resources, relations, technologies, selected, measured])

  // Caixa de cada recurso no desenho (tamanho medido na tela, senão o escolhido, senão o padrão)
  const resourceRects = useMemo<Map<string, Rect>>(
    () =>
      new Map(
        (diagram?.nodes ?? []).map((n) => [
          n.resourceId,
          {
            id: n.resourceId,
            x: n.x,
            y: n.y,
            w: measured[n.resourceId]?.width ?? n.width ?? NODE_HALF.x * 2,
            h: measured[n.resourceId]?.height ?? n.height ?? NODE_HALF.y * 2
          }
        ])
      ),
    [diagram?.nodes, measured]
  )

  // Ligações entre um recurso e outro que está dentro (ou em cima) dele: existem, mas não são desenhadas
  const hiddenEdgeIds = useMemo(() => {
    const hidden: string[] = []
    for (const id of diagram?.edges ?? []) {
      const rel = relations[id]
      const a = rel && resourceRects.get(rel.sourceId)
      const b = rel && resourceRects.get(rel.targetId)
      if (a && b && areNested(a, b)) hidden.push(id)
    }
    return hidden
  }, [diagram?.edges, relations, resourceRects])

  useEffect(() => setHiddenEdges(hiddenEdgeIds), [hiddenEdgeIds, setHiddenEdges])

  const edges = useMemo<Edge[]>(() => {
    if (!diagram) return []
    const nodeById = new Map(diagram.nodes.map((n) => [n.resourceId, n]))
    const rects = [...resourceRects.values()]
    /**
     * Seta com ponta dentro de outro recurso (ex.: endpoint dentro do serviço) é desenhada logo acima
     * desse recurso de fora, para aparecer inteira até a ponta. As demais ficam atrás dos recursos.
     */
    const zFor = (sourceId: string, targetId: string): number => {
      const outer = [sourceId, targetId].flatMap((end) => {
        const r = resourceRects.get(end)
        return r ? containersOf(r, rects).filter((c) => c.id !== sourceId && c.id !== targetId) : []
      })
      if (!outer.length) return edgeZ
      return Math.max(...outer.map((c) => nodeById.get(c.id)?.z ?? 0)) * 2 + 1
    }

    return diagram.edges.flatMap((id) => {
      const rel = relations[id]
      const source = rel && nodeById.get(rel.sourceId)
      const target = rel && nodeById.get(rel.targetId)
      if (!rel || !source || !target || hiddenEdgeIds.includes(id)) return []
      const [sourceSide, targetSide] = facingSides(source, target)
      const anchors = diagram.anchors?.[id]
      const strength = rel.relType === 'influence' && rel.strength ? rel.strength : ''
      const label = [strength, rel.label, rel.protocol && `[${rel.protocol}]`].filter(Boolean).join(' ')
      const isSelected = selected.edges.has(id)
      // Cor do impacto; azul quando selecionada (as pontas precisam da mesma cor)
      const color = isSelected ? SELECTED_STROKE : impactInfo(rel.impact).stroke
      const notation = relationNotation(rel)
      return [
        {
          id,
          source: source.resourceId,
          target: target.resourceId,
          // Ponto escolhido pelo usuário neste desenho; senão o centro do lado que encara a outra ponta
          sourceHandle: isAnchorId(anchors?.source) ? anchors.source : centerAnchor(sourceSide),
          targetHandle: isAnchorId(anchors?.target) ? anchors.target : centerAnchor(targetSide),
          label: label || undefined,
          type: 'smoothstep',
          zIndex: zFor(source.resourceId, target.resourceId),
          style: {
            stroke: color,
            strokeWidth: rel.impact || isSelected ? 2 : 1.5,
            // Excluída: tracejado longo, a menos que o tipo ArchiMate já tenha traço próprio
            strokeDasharray: notation.dash ?? (rel.impact === 'removed' ? '10 5' : undefined)
          },
          markerStart: notation.start && markerId(notation.start, color),
          markerEnd: notation.end && markerId(notation.end, color),
          selected: isSelected,
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4
        }
      ]
    })
  }, [diagram, relations, selected, edgeZ, hiddenEdgeIds, resourceRects])

  /** Retângulos de todos os itens do desenho, com o tamanho medido na tela. */
  const itemRects = useCallback((): Rect[] => {
    const d = useModel.getState().activeDiagram
    const current = d ? useModel.getState().diagrams[d] : undefined
    if (!current) return []
    return [
      ...current.nodes.map((n) => ({
        id: n.resourceId,
        x: n.x,
        y: n.y,
        w: measured[n.resourceId]?.width ?? NODE_HALF.x * 2,
        h: measured[n.resourceId]?.height ?? NODE_HALF.y * 2
      })),
      ...current.shapes.map((sh) => ({ id: sh.id, x: sh.x, y: sh.y, w: sh.width, h: sh.height }))
    ]
  }, [measured])

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const sizes: Record<string, { width: number; height: number }> = {}
      // Guias de alinhamento só quando um item é arrastado sozinho (em grupo, o encaixe deformaria o grupo)
      const draggingAlone = changes.filter((c) => c.type === 'position' && c.dragging).length === 1
      const selectChanges = changes.filter((c) => c.type === 'select')
      if (selectChanges.length) {
        const state = useModel.getState()
        const current = selectedIds(state)
        const items = new Set(current.items)
        for (const c of selectChanges) {
          if (c.type !== 'select') continue
          if (c.selected) items.add(c.id)
          else items.delete(c.id)
        }
        state.setMultiSelection([...items], current.edges)
      }
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          let { x, y } = change.position
          if (change.dragging && draggingAlone) {
            // Encaixa nas bordas/centros dos outros itens e mostra as guias
            const rects = itemRects()
            const me = rects.find((r) => r.id === change.id)
            if (me) {
              const snap = snapToGuides({ ...me, x, y }, rects.filter((r) => r.id !== change.id), SNAP_PX / getZoom())
              ;({ x, y } = snap)
              setGuides(snap.guides)
            }
          } else {
            setGuides(NO_GUIDES)
          }
          moveItem(change.id, x, y)
        } else if (change.type === 'dimensions' && change.dimensions) {
          sizes[change.id] = change.dimensions
          // Redimensionado pelo usuário (NodeResizer)
          if (change.resizing !== undefined) {
            if (shapeIds.has(change.id)) updateShape(change.id, change.dimensions)
            else resizeNode(change.id, change.dimensions)
          }
        }
      }
      if (Object.keys(sizes).length) setMeasured((m) => ({ ...m, ...sizes }))
    },
    [moveItem, updateShape, resizeNode, shapeIds, getZoom, itemRects]
  )

  const onConnect = useCallback(
    (c: Connection) => {
      // A direção é a do arrasto: de onde começou para onde soltou (ex.: Serve sai de quem serve)
      const sourceId = c.source
      const targetId = c.target
      // Ponto de conexão usado em cada ponta
      const anchors = {
        source: isAnchorId(c.sourceHandle) ? c.sourceHandle : undefined,
        target: isAnchorId(c.targetHandle) ? c.targetHandle : undefined
      }
      connect(sourceId, targetId, anchors)
      const a = resourceRects.get(sourceId)
      const b = resourceRects.get(targetId)
      if (a && b && areNested(a, b)) {
        notify('Ligação criada, mas fica oculta enquanto um recurso estiver dentro do outro.')
      }
    },
    [connect, resources, resourceRects, notify]
  )

  // Arrastar a ponta de uma seta (ferramenta Ligar) troca o ponto de conexão no mesmo recurso
  const onReconnect = useCallback(
    (edge: Edge, c: Connection) => {
      const rel = relations[edge.id]
      if (!rel) return
      const s = c.source
      const t = c.target
      const pick = (h: string | null | undefined): string | undefined => (isAnchorId(h) ? h : undefined)
      if (s === rel.sourceId && t === rel.targetId) {
        setEdgeAnchors(edge.id, { source: pick(c.sourceHandle), target: pick(c.targetHandle) })
      } else if (s === rel.targetId && t === rel.sourceId) {
        setEdgeAnchors(edge.id, { source: pick(c.targetHandle), target: pick(c.sourceHandle) })
      }
      // Soltar em outro recurso não muda a relação: isso se faz criando uma ligação nova
    },
    [relations, setEdgeAnchors]
  )

  // Delete/Backspace remove do desenho, mas mantém o arquivo em aplicações/ e relações/
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const selectChanges = changes.filter((c) => c.type === 'select')
    if (!selectChanges.length) return
    const state = useModel.getState()
    const current = selectedIds(state)
    const items = new Set(current.items)
    const edges = new Set(current.edges)
    for (const c of selectChanges) {
      if (c.type !== 'select') continue
      const rel = state.relations[c.id]
      // O retângulo de seleção do React Flow também marca as ligações que só encostam num recurso
      // selecionado. Só entra a ligação com as duas pontas na seleção (ou clicada sozinha), para
      // um Shift+Delete não apagar ligações com recursos que ficaram de fora.
      const bothEnds = !!rel && items.has(rel.sourceId) && items.has(rel.targetId)
      if (c.selected && (bothEnds || items.size === 0)) edges.add(c.id)
      else if (!c.selected) edges.delete(c.id)
    }
    state.setMultiSelection(current.items, [...edges])
  }, [])

  const onDelete = useCallback<OnDelete>(
    ({ nodes: deletedNodes, edges: deletedEdges }) => {
      if (deletedEdges.length) removeEdgesFromDiagram(deletedEdges.map((e) => e.id))
      if (deletedNodes.length) removeFromDiagram(deletedNodes.map((n) => n.id))
      useModel.getState().setMultiSelection([], [])
    },
    [removeEdgesFromDiagram, removeFromDiagram]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes(DND_MIME)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const payload = getDragPayload(event)
      if (!payload) return
      event.preventDefault()
      if (payload.kind === 'technology') {
        // Tecnologia solta sobre um recurso: cria a relação "usa"
        const nodeId = (event.target as HTMLElement).closest('.react-flow__node')?.getAttribute('data-id')
        if (nodeId && resources[nodeId]) toggleTechnology(nodeId, payload.id)
        return
      }
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      if (payload.kind === 'shape') return addShape(payload.shape, point)
      const position = { x: point.x - NODE_HALF.x, y: point.y - NODE_HALF.y }
      if (payload.kind === 'new') createResource(payload.type, position)
      else placeResource(payload.id, position)
    },
    [createResource, placeResource, toggleTechnology, addShape, screenToFlowPosition, resources]
  )

  // Shift+Delete (ou Shift+Backspace): excluir de vez, com confirmação. Delete sozinho só tira do desenho
  // (deleteKeyCode do React Flow). Escuta na captura para o React Flow não tratar como Delete comum.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.shiftKey || (e.key !== 'Delete' && e.key !== 'Backspace') || isEditingText()) return
      const state = useModel.getState()
      const { items, edges } = selectedIds(state)
      if ((!items.length && !edges.length) || state.choice) return
      e.preventDefault()
      e.stopPropagation()
      // Formas só existem no desenho: saem direto. Recursos e ligações: pergunta antes de excluir de vez
      const shapes = items.filter((id) => shapeIds.has(id))
      if (shapes.length) removeFromDiagram(shapes)
      const targets = [
        ...items.filter((id) => !shapeIds.has(id)).map((id) => ({ kind: 'resource' as const, id })),
        ...edges.map((id) => ({ kind: 'relation' as const, id }))
      ]
      if (targets.length) askPermanentDelete(targets)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [removeFromDiagram, shapeIds])

  // Ferramentas: V = selecionar, L = ligar, Esc volta a selecionar
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditingText()) return
      if (e.key === 'v' || e.key === 'V') setTool('select')
      else if (e.key === 'l' || e.key === 'L') setTool('connect')
      else if (e.key === 'Escape' && useModel.getState().tool === 'connect') setTool('select')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool])

  // Atalhos de ordem (⌘] ⌘[ ⇧⌘] ⇧⌘[) e duplicar forma (⌘D)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || isEditingText()) return
      const s = useModel.getState().selection
      if (!s || (s.kind !== 'resource' && s.kind !== 'shape')) return
      let op: ZOrderOp | null = null
      if (e.code === 'BracketRight') op = e.shiftKey ? 'front' : 'forward'
      if (e.code === 'BracketLeft') op = e.shiftKey ? 'back' : 'backward'
      if (op) {
        e.preventDefault()
        reorder(s.id, op)
      } else if (e.key === 'd' && s.kind === 'shape') {
        e.preventDefault()
        duplicateShape(s.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reorder, duplicateShape])

  /** Item travado embaixo de um ponto da tela (o de cima, se houver vários). */
  const lockedItemAt = useCallback(
    (clientX: number, clientY: number): { id: string; kind: 'resource' | 'shape' } | null => {
      const d = useModel.getState().activeDiagram
      const current = d ? useModel.getState().diagrams[d] : undefined
      if (!current) return null
      const p = screenToFlowPosition({ x: clientX, y: clientY })
      const inside = (r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
      const hits = [
        ...current.nodes
          .filter((n) => n.locked)
          .map((n) => ({ id: n.resourceId, kind: 'resource' as const, z: n.z ?? 0, rect: resourceRects.get(n.resourceId) })),
        ...current.shapes
          .filter((sh) => sh.locked)
          .map((sh) => ({ id: sh.id, kind: 'shape' as const, z: sh.z ?? 0, rect: { id: sh.id, x: sh.x, y: sh.y, w: sh.width, h: sh.height } }))
      ].filter((h) => h.rect && inside(h.rect))
      const top = hits.sort((a, b) => b.z - a.z)[0]
      return top ? { id: top.id, kind: top.kind } : null
    },
    [screenToFlowPosition, resourceRects]
  )

  const hiddenAtDragStart = useRef<Set<string>>(new Set())

  /**
   * Recurso solto dentro (ou em cima) de outro: o menor fica na frente, para continuar visível,
   * e um aviso diz quantas ligações deixaram de ser desenhadas.
   */
  const afterResourceDrop = useCallback(
    (id: string) => {
      const rects = [...resourceRects.values()]
      const me = resourceRects.get(id)
      if (!me) return
      for (const other of nestedWith(id, rects)) {
        const inner = me.w * me.h <= other.w * other.h ? me : other
        reorder(inner.id, 'front')
      }
      // As setas já somem durante o arrasto; o aviso explica por quê
      requestAnimationFrame(() => {
        const { hiddenEdges } = useModel.getState()
        const newlyHidden = hiddenEdges.filter((e) => !hiddenAtDragStart.current.has(e))
        if (newlyHidden.length) {
          notify(
            newlyHidden.length === 1
              ? '1 ligação oculta: um recurso está dentro do outro. Ela continua existindo.'
              : `${newlyHidden.length} ligações ocultas: um recurso está dentro do outro. Elas continuam existindo.`
          )
        }
      })
    },
    [resourceRects, reorder, notify]
  )

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Shift+clique soma à seleção (o React Flow cuida); item travado não é selecionado
      if (event.shiftKey || node.selectable === false) return
      select({ kind: node.type === 'shape' ? 'shape' : 'resource', id: node.id })
    },
    [select]
  )


  if (!diagram || !activeDiagram) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
        Abra um desenho em projetos/ ou crie um novo pelo botão ao passar o mouse sobre a pasta.
      </div>
    )
  }

  return (
    <div
      className={`relative h-full w-full tool-${tool}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={(event) => {
        // Botão direito no fundo do desenho. Item travado deixa o mouse passar, então o clique chega
        // aqui: se houver um travado embaixo do cursor, abre o menu dele (com "Destravar").
        // (Tratado aqui porque o React Flow não repassa o botão direito do fundo quando ele move o desenho.)
        const target = event.target as HTMLElement
        // Só o fundo (nós e ligações têm o menu deles, nos handlers do React Flow)
        if (!target.closest('.react-flow__pane') || target.closest('.react-flow__node, .react-flow__edge')) return
        event.preventDefault()
        const locked = lockedItemAt(event.clientX, event.clientY)
        setMenu(
          locked
            ? { x: event.clientX, y: event.clientY, id: locked.id, kind: locked.kind, items: [locked.id], edges: [] }
            : null
        )
      }}
    >
      <ReactFlow
        key={activeDiagram}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        edgesReconnectable={tool === 'connect'}
        nodesDraggable={tool === 'select'}
        onDelete={onDelete}
        onNodeClick={onNodeClick}
        onEdgesChange={onEdgesChange}
        onEdgeClick={(event, edge) => {
          if (!event.shiftKey) select({ kind: 'relation', id: edge.id })
        }}
        onPaneClick={() => {
          select(null)
          setMenu(null)
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault()
          // Botão direito num item da seleção múltipla: o menu vale para todos os selecionados
          const current = selectedIds(useModel.getState())
          const inGroup = current.items.length + current.edges.length > 1 && current.items.includes(node.id)
          if (!inGroup) onNodeClick(event, node)
          setMenu({
            x: event.clientX,
            y: event.clientY,
            id: node.id,
            kind: node.type === 'shape' ? 'shape' : 'resource',
            items: inGroup ? current.items : [node.id],
            edges: inGroup ? current.edges : []
          })
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault()
          const current = selectedIds(useModel.getState())
          const inGroup = current.items.length + current.edges.length > 1 && current.edges.includes(edge.id)
          if (!inGroup) select({ kind: 'relation', id: edge.id })
          setMenu({
            x: event.clientX,
            y: event.clientY,
            id: edge.id,
            kind: 'relation',
            items: inGroup ? current.items : [],
            edges: inGroup ? current.edges : [edge.id]
          })
        }}
        onPaneContextMenu={(event) => event.preventDefault()}
        onMoveStart={() => setMenu(null)}
        onNodeDragStart={() => {
          hiddenAtDragStart.current = new Set(useModel.getState().hiddenEdges)
        }}
        onNodeDragStop={(_, node) => {
          setGuides(NO_GUIDES)
          if (node.type === 'element') afterResourceDrop(node.id)
        }}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Backspace', 'Delete']}
        // Arrastar no fundo seleciona vários (retângulo); mover o desenho: botão do meio/direito,
        // Espaço + arrastar ou dois dedos no trackpad; zoom: pinça ou ⌘ + roda
        selectionOnDrag
        selectionMode={SelectionMode.Full}
        panOnDrag={[1, 2]}
        panOnScroll
        multiSelectionKeyCode="Shift"
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={false}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="#cbd5e1" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-slate-50" style={{ width: 160, height: 100 }} />
        <Panel position="top-left">
          <ToolSwitch />
        </Panel>
        <ViewportPortal>
          <ArchimateMarkers />
          <AlignmentGuides guides={guides} />
        </ViewportPortal>
      </ReactFlow>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}

/** Linhas de alinhamento desenhadas por cima do desenho enquanto um item é arrastado. */
function AlignmentGuides({ guides }: { guides: Guides }): JSX.Element | null {
  if (!guides.v.length && !guides.h.length) return null
  const line = { stroke: '#e11d74', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const }
  return (
    <svg
      width={1}
      height={1}
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      style={{ zIndex: 10000 }}
    >
      {guides.v.map((g) => (
        <line key={`v${g.x}`} x1={g.x} x2={g.x} y1={g.y1 - 16} y2={g.y2 + 16} {...line} />
      ))}
      {guides.h.map((g) => (
        <line key={`h${g.y}`} x1={g.x1 - 16} x2={g.x2 + 16} y1={g.y} y2={g.y} {...line} />
      ))}
    </svg>
  )
}
