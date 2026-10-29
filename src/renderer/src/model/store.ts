import { create } from 'zustand'
import { REPO_FOLDERS } from './types'
import { ARCHIMATE_TYPES } from './archimate'
import { ELEMENT_TYPES, SHAPE_KINDS } from './elementTypes'
import { endpointName, isInside, parseScan, slugify, type DiskSnapshot, type RepoContent } from './repo'
import type {
  ArchimateRelType,
  Connector,
  EdgeAnchors,
  HttpMethod,
  Diagram,
  ElementType,
  Relation,
  RepoScan,
  Resource,
  Selection,
  Shape,
  ShapeKind,
  Technology
} from './types'

const uid = (): string => crypto.randomUUID()

export type ZOrderOp = 'front' | 'forward' | 'backward' | 'back'

/** Pergunta com opções (ex.: usar o existente / criar novo). Cancelar está sempre disponível. */
export interface ChoiceRequest {
  title: string
  message: string
  options: { label: string; primary?: boolean; danger?: boolean; run: () => void }[]
  /** Executado ao cancelar (Esc, clicar fora, botão Cancelar). */
  onCancel?: () => void
}

/** Ferramenta ativa no desenho: mover/selecionar ou ligar recursos pelos conectores. */
export type CanvasTool = 'select' | 'connect'

interface ModelState extends RepoContent {
  root: string | null
  /** Nome real em disco de cada pasta raiz (o repositório pode usar nomes em português ou inglês). */
  folderNames: Record<string, string>
  /** Como o disco estava na última leitura/gravação. Nada é gravado antes do Salvar. */
  snapshot: DiskSnapshot
  openDiagrams: string[]
  activeDiagram: string | null
  selection: Selection
  /**
   * Seleção múltipla (retângulo de seleção, Shift+clique): ids de recursos/formas e de ligações.
   * Só é usada com 2 ou mais itens; com 1, vale `selection`.
   */
  selectedItems: string[]
  selectedEdges: string[]
  dirty: boolean
  /** Tipo ArchiMate usado nas próximas ligações desenhadas. */
  newRelType: ArchimateRelType | undefined
  tool: CanvasTool
  /** Há o que desfazer/refazer (para os botões da barra). */
  history: { canUndo: boolean; canRedo: boolean }
  undo: () => void
  redo: () => void
  /** Ligações do desenho aberto que não são desenhadas por um recurso estar dentro do outro. */
  hiddenEdges: string[]
  /**
   * Texto original dos desenhos copiados de uma pasta modelo ainda não gravados. No Salvar, se o
   * desenho não foi editado, grava o original (cópia exata, com a formatação do modelo).
   */
  templateOriginals: Record<string, string>
  /** Pergunta "usar o existente ou criar novo" aberta (ver ChoiceDialog). */
  choice: ChoiceRequest | null
  ask: (choice: ChoiceRequest) => void
  closeChoice: () => void
  /** Aviso passageiro no rodapé do desenho (ex.: ligação repetida). */
  notice: { text: string; at: number } | null
  /** Modal "Nova feature" aberto, com a pasta sugerida. */
  featureDialog: { dir: string } | null
  /** Recurso que recebeu um nome já usado por outro; abre o aviso de recurso existente. */
  duplicateCheck: { resourceId: string; previousName: string } | null

  // Repositório
  loadRepo: (scan: RepoScan) => void
  markSaved: (files: Record<string, string>, paths: Record<string, string>) => void
  createDir: (path: string) => void
  /** Renomeia/move uma pasta ou desenho dentro de projetos/. */
  renamePath: (from: string, to: string) => void
  /** Remove uma pasta (com tudo dentro) ou um desenho de projetos/. */
  deletePath: (path: string) => void

  // Desenhos
  openDiagram: (path: string) => void
  closeDiagram: (path: string) => void
  createDiagram: (path: string) => void
  createDoc: (path: string) => void
  /** Pasta da feature com diagrama.json, processo.json e doc.md (em memória, como tudo). */
  createFeature: (folder: string, docText: string) => void
  /** Pasta da feature com cópia exata de uma pasta modelo (lida pelo processo principal). */
  createFeatureFromTemplate: (
    folder: string,
    template: { files: { path: string; base64: string }[]; dirs: string[] }
  ) => void
  openFeatureDialog: (dir?: string) => void
  closeFeatureDialog: () => void
  updateDoc: (path: string, text: string) => void

  // Recursos e endpoints
  createResource: (type: ElementType, position: { x: number; y: number }) => void
  /**
   * Cria o endpoint e a ligação de Composição dono → endpoint (é a ligação que diz de quem ele é).
   * Quem chama verifica antes se o dono já tem um endpoint com a mesma rota.
   */
  createEndpoint: (ownerId: string, method: HttpMethod, path: string) => string
  placeResource: (id: string, position: { x: number; y: number }) => void
  updateResource: (id: string, patch: Partial<Omit<Resource, 'id'>>) => void
  deleteResource: (id: string) => void
  /** Chamado ao terminar de digitar o nome: abre o aviso se outro recurso já tem esse nome. */
  checkDuplicateName: (resourceId: string, previousName: string) => void
  closeDuplicateCheck: () => void
  /**
   * Troca `fromId` pelo recurso existente `intoId` em tudo (desenhos, relações,
   * endpoints) e apaga `fromId`.
   */
  mergeResource: (fromId: string, intoId: string) => void

  // Tecnologias
  createTechnology: (name: string, select?: boolean) => string
  updateTechnology: (id: string, patch: Partial<Omit<Technology, 'id'>>) => void
  deleteTechnology: (id: string) => void
  toggleTechnology: (resourceId: string, technologyId: string) => void

  // Relações
  /**
   * Liga dois recursos. Antes pergunta (diálogo) se já existe ligação entre eles ou, para endpoints,
   * se o outro recurso já tem um endpoint com a mesma rota. `skip` pula verificações já respondidas.
   */
  connect: (
    sourceId: string,
    targetId: string,
    anchors?: EdgeAnchors,
    skip?: { endpoint?: boolean; relation?: boolean }
  ) => void
  /** Troca origem e destino de uma ligação (e os pontos de conexão dela nos desenhos). */
  reverseRelation: (id: string) => void
  /** Ligação só visual no desenho aberto (forma ↔ forma/recurso). */
  addConnector: (source: string, target: string, anchors?: EdgeAnchors) => string
  updateConnector: (id: string, patch: Partial<Omit<Connector, 'id'>>) => void
  reverseConnector: (id: string) => void
  /** Traz uma ligação existente para o desenho aberto e a seleciona. */
  showRelation: (id: string) => void
  /** Ponto de conexão de uma seta neste desenho. */
  setEdgeAnchors: (relationId: string, anchors: EdgeAnchors) => void
  setTool: (tool: CanvasTool) => void
  notify: (text: string) => void
  setHiddenEdges: (ids: string[]) => void
  updateRelation: (id: string, patch: Partial<Omit<Relation, 'id'>>) => void
  deleteRelation: (id: string) => void
  removeEdgesFromDiagram: (relationIds: string[]) => void
  setNewRelType: (relType: ArchimateRelType | undefined) => void

  // Formas
  addShape: (kind: ShapeKind, position: { x: number; y: number }) => void
  updateShape: (id: string, patch: Partial<Omit<Shape, 'id'>>) => void
  duplicateShape: (id: string) => void

  // Itens do desenho (recursos e formas)
  moveItem: (id: string, x: number, y: number) => void
  /** Tamanho do recurso neste desenho; `null` volta ao automático. */
  resizeNode: (resourceId: string, size: { width: number; height: number } | null) => void
  removeFromDiagram: (ids: string[]) => void
  reorder: (id: string, op: ZOrderOp) => void

  select: (selection: Selection) => void
  /** Aplica uma seleção vinda do desenho (1 item vira `selection`; 2+ viram seleção múltipla). */
  setMultiSelection: (items: string[], edges: string[]) => void
  /** Trava/destrava recursos e formas no desenho aberto. */
  setLocked: (ids: string[], locked: boolean) => void
}

const emptyContent: RepoContent = {
  resources: {},
  technologies: {},
  relations: {},
  diagrams: {},
  docs: {},
  paths: {},
  otherFiles: [],
  pendingFiles: {},
  dirs: []
}

const remap = (path: string, from: string, to: string): string =>
  isInside(path, from) ? to + path.slice(from.length) : path

const remapKeys = <T>(record: Record<string, T>, from: string, to: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [remap(k, from, to), v]))

/** Atualiza o desenho ativo. */
function updateActive(s: ModelState, fn: (d: Diagram) => Diagram): Partial<ModelState> {
  const d = s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined
  if (!d) return {}
  return { diagrams: { ...s.diagrams, [s.activeDiagram!]: fn(d) }, dirty: true }
}

/** Maior z do desenho + 1, para itens novos ficarem na frente. */
function nextZ(d: Diagram): number {
  return Math.max(0, ...d.nodes.map((n) => n.z ?? 0), ...d.shapes.map((s) => s.z ?? 0)) + 1
}

/** Remove relações e tudo que aponta para elas. */
function withoutRelations(s: ModelState, ids: Set<string>): Pick<ModelState, 'relations' | 'diagrams'> {
  const relations = Object.fromEntries(Object.entries(s.relations).filter(([id]) => !ids.has(id)))
  const diagrams = Object.fromEntries(
    Object.entries(s.diagrams).map(([path, d]) => [path, { ...d, edges: d.edges.filter((e) => !ids.has(e)) }])
  )
  return { relations, diagrams }
}

/** Ids dos recursos visíveis num desenho (endpoints são recursos como os outros, com nó próprio). */
export function presentIds(diagram: Diagram): Set<string> {
  return new Set(diagram.nodes.map((n) => n.resourceId))
}

/** Adiciona as setas das relações cujas duas pontas já estão no desenho. */
function withImpliedEdges(diagram: Diagram, relations: Record<string, Relation>): Diagram {
  const present = presentIds(diagram)
  const shown = new Set(diagram.edges)
  const missing = Object.values(relations).filter(
    (r) => r.kind === 'flow' && !shown.has(r.id) && present.has(r.sourceId) && present.has(r.targetId)
  )
  return missing.length ? { ...diagram, edges: [...diagram.edges, ...missing.map((r) => r.id)] } : diagram
}

export const useModel = create<ModelState>((set, get) => ({
  ...emptyContent,
  root: null,
  folderNames: {},
  snapshot: { files: {}, dirs: [], moves: [] },
  openDiagrams: [],
  activeDiagram: null,
  selection: null,
  selectedItems: [],
  selectedEdges: [],
  dirty: false,
  newRelType: undefined,
  tool: 'select',
  featureDialog: null,
  notice: null,
  templateOriginals: {},
  choice: null,
  ask: (choice) => set({ choice }),
  closeChoice: () => set({ choice: null }),
  history: { canUndo: false, canRedo: false },
  undo: () => stepHistory('undo'),
  redo: () => stepHistory('redo'),
  hiddenEdges: [],
  duplicateCheck: null,

  loadRepo: (scan) => {
    const { content, snapshot } = parseScan(scan)
    const first = Object.keys(content.diagrams).sort()[0] ?? null
    // Endpoints migrados do formato antigo ou pastas com nome antigo: ainda não estão em disco
    const migrated =
      [...Object.keys(content.resources), ...Object.keys(content.relations)].some((id) => !content.paths[id]) ||
      snapshot.moves.length > 0
    withoutHistory(() =>
      set({
        ...content,
        root: scan.root,
        folderNames: scan.folders ?? {},
        snapshot,
        openDiagrams: first ? [first] : [],
        activeDiagram: first,
        selection: null,
        dirty: migrated
      })
    )
    resetHistory()
  },

  markSaved: (files, paths) => {
    withoutHistory(() =>
      set((s) => {
        const dirs = [...new Set([...s.dirs, ...Object.keys(files).map((p) => p.split('/').slice(0, -1).join('/'))])]
        return { snapshot: { files, dirs, moves: [] }, paths, dirs, pendingFiles: {}, templateOriginals: {}, dirty: false }
      })
    )
    rebaseHistoryAfterSave()
  },

  createDir: (path) => set((s) => (s.dirs.includes(path) ? s : { dirs: [...s.dirs, path], dirty: true })),

  renamePath: (from, to) =>
    set((s) => {
      if (from === to) return s
      const onDisk = from in s.snapshot.files || s.snapshot.dirs.includes(from)
      // O snapshot passa a refletir o disco depois do move, que só acontece ao salvar
      const snapshot: DiskSnapshot = {
        files: remapKeys(s.snapshot.files, from, to),
        dirs: s.snapshot.dirs.map((d) => remap(d, from, to)),
        moves: onDisk ? [...s.snapshot.moves, { from, to }] : s.snapshot.moves
      }
      return {
        snapshot,
        diagrams: remapKeys(s.diagrams, from, to),
        docs: remapKeys(s.docs, from, to),
        dirs: s.dirs.map((d) => remap(d, from, to)),
        otherFiles: s.otherFiles.map((p) => remap(p, from, to)),
        pendingFiles: remapKeys(s.pendingFiles, from, to),
        openDiagrams: s.openDiagrams.map((p) => remap(p, from, to)),
        activeDiagram: s.activeDiagram && remap(s.activeDiagram, from, to),
        dirty: true
      }
    }),

  deletePath: (path) =>
    set((s) => {
      const diagrams = Object.fromEntries(Object.entries(s.diagrams).filter(([p]) => !isInside(p, path)))
      const openDiagrams = s.openDiagrams.filter((p) => !isInside(p, path))
      const activeDiagram =
        s.activeDiagram && isInside(s.activeDiagram, path) ? (openDiagrams.at(-1) ?? null) : s.activeDiagram
      return {
        diagrams,
        docs: Object.fromEntries(Object.entries(s.docs).filter(([p]) => !isInside(p, path))),
        dirs: s.dirs.filter((d) => !isInside(d, path)),
        otherFiles: s.otherFiles.filter((p) => !isInside(p, path)),
        pendingFiles: Object.fromEntries(Object.entries(s.pendingFiles).filter(([p]) => !isInside(p, path))),
        openDiagrams,
        activeDiagram,
        selection: null,
        dirty: true
      }
    }),

  openDiagram: (path) =>
    set((s) => ({
      openDiagrams: s.openDiagrams.includes(path) ? s.openDiagrams : [...s.openDiagrams, path],
      activeDiagram: path,
      selection: null
    })),

  closeDiagram: (path) =>
    set((s) => {
      const openDiagrams = s.openDiagrams.filter((p) => p !== path)
      const activeDiagram = s.activeDiagram === path ? (openDiagrams.at(-1) ?? null) : s.activeDiagram
      return { openDiagrams, activeDiagram }
    }),

  createDiagram: (path) =>
    set((s) => ({
      diagrams: { ...s.diagrams, [path]: { nodes: [], edges: [], shapes: [] } },
      openDiagrams: [...s.openDiagrams, path],
      activeDiagram: path,
      selection: null,
      dirty: true
    })),

  createDoc: (path) =>
    set((s) => ({
      docs: { ...s.docs, [path]: `# ${path.split('/').pop()!.replace(/\.md$/i, '')}\n\n` },
      openDiagrams: [...s.openDiagrams, path],
      activeDiagram: path,
      selection: null,
      dirty: true
    })),

  createFeature: (folder, docText) =>
    set((s) => {
      const diagram = `${folder}/diagrama.json`
      const empty = (): Diagram => ({ nodes: [], edges: [], shapes: [] })
      return {
        dirs: s.dirs.includes(folder) ? s.dirs : [...s.dirs, folder],
        diagrams: { ...s.diagrams, [diagram]: empty(), [`${folder}/processo.json`]: empty() },
        docs: { ...s.docs, [`${folder}/doc.md`]: docText },
        openDiagrams: s.openDiagrams.includes(diagram) ? s.openDiagrams : [...s.openDiagrams, diagram],
        activeDiagram: diagram,
        selection: null,
        featureDialog: null,
        dirty: true
      }
    }),

  createFeatureFromTemplate: (folder, template) =>
    set((s) => {
      // Desenhos (.json com nodes) e documentos (.md) viram editáveis; o resto é copiado como está
      const decode = (b64: string): string => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
      const textual = template.files.filter((f) => /\.(json|md)$/i.test(f.path))
      const { content } = parseScan({
        root: '',
        dirs: [],
        files: textual.map((f) => ({ path: `${folder}/${f.path}`, content: decode(f.base64) }))
      })
      const recognized = new Set([...Object.keys(content.diagrams), ...Object.keys(content.docs)])
      const raw = template.files
        .map((f) => ({ path: `${folder}/${f.path}`, base64: f.base64 }))
        .filter((f) => !recognized.has(f.path))
      const dirs = [folder, ...template.dirs.map((d) => `${folder}/${d}`)]
      // Abre o primeiro desenho (ou documento) da feature
      const first =
        Object.keys(content.diagrams).sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ??
        Object.keys(content.docs).sort()[0]
      return {
        dirs: [...new Set([...s.dirs, ...dirs])],
        diagrams: { ...s.diagrams, ...content.diagrams },
        docs: { ...s.docs, ...content.docs },
        otherFiles: [...new Set([...s.otherFiles, ...raw.map((f) => f.path)])],
        pendingFiles: { ...s.pendingFiles, ...Object.fromEntries(raw.map((f) => [f.path, f.base64])) },
        templateOriginals: {
          ...s.templateOriginals,
          ...Object.fromEntries(
            textual
              .map((f) => [`${folder}/${f.path}`, decode(f.base64)] as const)
              .filter(([path]) => path in content.diagrams)
          )
        },
        ...(first
          ? { openDiagrams: s.openDiagrams.includes(first) ? s.openDiagrams : [...s.openDiagrams, first], activeDiagram: first }
          : {}),
        selection: null,
        featureDialog: null,
        dirty: true
      }
    }),

  openFeatureDialog: (dir) =>
    set((s) => {
      // Sugere a pasta do desenho aberto, se estiver em projetos/
      const fromActive = s.activeDiagram?.split('/').slice(0, -1).join('/')
      const fallback = fromActive?.startsWith(REPO_FOLDERS.projects) ? fromActive : REPO_FOLDERS.projects
      return { featureDialog: { dir: dir ?? fallback } }
    }),

  closeFeatureDialog: () => set({ featureDialog: null }),

  updateDoc: (path, text) => set((s) => ({ docs: { ...s.docs, [path]: text }, dirty: true })),

  createResource: (type, position) =>
    set((s) => {
      if (!s.activeDiagram) return s
      const resource: Resource = {
        id: uid(),
        type,
        name: `Novo ${ELEMENT_TYPES[type].label.toLowerCase()}`,
        description: '',
        owner: ''
      }
      if (type === 'endpoint') {
        // Endpoint solto: ainda não está ligado a ninguém, então não há rota repetida a verificar
        Object.assign(resource, { method: 'GET', path: '/novo', name: endpointName('GET', '/novo') })
      }
      return {
        resources: { ...s.resources, [resource.id]: resource },
        ...updateActive(s, (d) => ({
          ...d,
          nodes: [...d.nodes, { resourceId: resource.id, ...position, z: nextZ(d) }]
        })),
        selection: { kind: 'resource', id: resource.id },
        dirty: true
      }
    }),

  createEndpoint: (ownerId, method, path) => {
    const endpoint: Resource = {
      id: uid(),
      type: 'endpoint',
      name: endpointName(method, path),
      description: '',
      owner: get().resources[ownerId]?.owner ?? '',
      method,
      path
    }
    const ownership: Relation = {
      id: uid(),
      kind: 'flow',
      relType: 'composition',
      sourceId: ownerId,
      targetId: endpoint.id,
      label: '',
      protocol: ''
    }
    set((s) => {
      const resources = { ...s.resources, [endpoint.id]: endpoint }
      const relations = { ...s.relations, [ownership.id]: ownership }
      // Dono no desenho aberto: o endpoint entra logo abaixo dele, já com as ligações que tiver
      const active = s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined
      const ownerNode = active?.nodes.find((n) => n.resourceId === ownerId)
      if (!active || !ownerNode) return { resources, relations, dirty: true }
      const siblings = endpointsOf(ownerId, s.resources, s.relations).filter((ep) =>
        active.nodes.some((n) => n.resourceId === ep.id)
      ).length
      const node = { resourceId: endpoint.id, x: ownerNode.x + siblings * 30, y: ownerNode.y + 180 + siblings * 30, z: nextZ(active) }
      return {
        resources,
        relations,
        ...updateActive(s, (d) => withImpliedEdges({ ...d, nodes: [...d.nodes, node] }, relations)),
        dirty: true
      }
    })
    return endpoint.id
  },

  placeResource: (id, position) =>
    set((s) => {
      const active = s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined
      if (!active || !s.resources[id]) return s
      // Um recurso aparece no máximo uma vez por desenho
      if (presentIds(active).has(id)) return { selection: { kind: 'resource', id } }
      return {
        ...updateActive(s, (d) =>
          withImpliedEdges(
            { ...d, nodes: [...d.nodes, { resourceId: id, ...position, z: nextZ(d) }] },
            s.relations
          )
        ),
        selection: { kind: 'resource', id }
      }
    }),

  updateResource: (id, patch) =>
    set((s) => {
      const current = s.resources[id]
      if (!current) return s
      const next = { ...current, ...patch }
      if (next.type === 'endpoint') next.name = endpointName(next.method, next.path)
      if ('impact' in patch && !patch.impact) delete next.impact
      return { resources: { ...s.resources, [id]: next }, dirty: true }
    }),

  deleteResource: (id) =>
    set((s) => {
      // Endpoints são recursos próprios: excluir o dono apaga só as ligações com eles
      const ids = new Set([id])
      const resources = Object.fromEntries(Object.entries(s.resources).filter(([rid]) => !ids.has(rid)))
      const relIds = new Set(
        Object.values(s.relations)
          .filter((r) => ids.has(r.sourceId) || ids.has(r.targetId))
          .map((r) => r.id)
      )
      const { relations, diagrams } = withoutRelations(s, relIds)
      for (const path of Object.keys(diagrams)) {
        diagrams[path] = { ...diagrams[path], nodes: diagrams[path].nodes.filter((n) => !ids.has(n.resourceId)) }
      }
      return { resources, relations, diagrams, selection: null, dirty: true }
    }),

  checkDuplicateName: (resourceId, previousName) =>
    set((s) => {
      const resource = s.resources[resourceId]
      if (!resource || resource.name === previousName || !sameNameResources(resource, s.resources).length) return s
      return { duplicateCheck: { resourceId, previousName } }
    }),

  closeDuplicateCheck: () => set({ duplicateCheck: null }),

  mergeResource: (fromId, intoId) =>
    set((s) => {
      const from = s.resources[fromId]
      const into = s.resources[intoId]
      if (!from || !into || fromId === intoId) return s

      // Ids que deixam de existir → id que fica no lugar
      const replaced = new Map<string, string>([[fromId, intoId]])
      // Endpoints acompanham as ligações (que passam para o recurso que fica)
      const resources = { ...s.resources }
      delete resources[fromId]

      // Relações passam para o recurso que fica; repetidas e as que ficariam sem ponta somem
      const relationIds = new Map<string, string>()
      const byKey = new Map<string, string>()
      const relations: Record<string, Relation> = {}
      const key = (r: Relation): string =>
        r.kind === 'uses'
          ? `uses|${r.sourceId}|${r.targetId}`
          : `flow|${r.sourceId}|${r.targetId}|${r.relType ?? ''}|${r.label}|${r.protocol}`
      // As relações que não mudam entram primeiro, para as repetidas caírem nelas
      const all = Object.values(s.relations).sort(
        (a, b) =>
          Number(replaced.has(a.sourceId) || replaced.has(a.targetId)) -
          Number(replaced.has(b.sourceId) || replaced.has(b.targetId))
      )
      for (const r of all) {
        const sourceId = replaced.get(r.sourceId) ?? r.sourceId
        const targetId = replaced.get(r.targetId) ?? r.targetId
        if (!sourceId || !targetId || sourceId === targetId) continue
        const next = sourceId === r.sourceId && targetId === r.targetId ? r : { ...r, sourceId, targetId }
        const existing = byKey.get(key(next))
        if (existing) {
          relationIds.set(r.id, existing)
          continue
        }
        byKey.set(key(next), r.id)
        relationIds.set(r.id, r.id)
        relations[r.id] = next
      }

      const diagrams: Record<string, Diagram> = {}
      for (const [path, d] of Object.entries(s.diagrams)) {
        const hasFrom = d.nodes.some((n) => n.resourceId === fromId)
        const hasInto = d.nodes.some((n) => n.resourceId === intoId)
        // O recurso que fica ocupa o lugar do outro; se já estava no desenho, mantém o lugar dele
        const nodes = d.nodes
          .filter((n) => !(n.resourceId === fromId && hasInto))
          .map((n) => (n.resourceId === fromId ? { ...n, resourceId: intoId } : n))
        const edges = [...new Set(d.edges.map((e) => relationIds.get(e)).filter((e): e is string => !!e))]
        let next: Diagram = hasFrom || edges.length !== d.edges.length ? { ...d, nodes, edges } : d
        if (hasFrom && path === s.activeDiagram) next = withImpliedEdges(next, relations)
        diagrams[path] = next
      }

      return {
        resources,
        relations,
        diagrams,
        selection: { kind: 'resource', id: intoId },
        duplicateCheck: null,
        dirty: true
      }
    }),

  createTechnology: (name, select = true) => {
    const technology: Technology = { id: uid(), name, category: '', description: '' }
    set((s) => ({
      technologies: { ...s.technologies, [technology.id]: technology },
      ...(select ? { selection: { kind: 'technology', id: technology.id } as Selection } : {}),
      dirty: true
    }))
    return technology.id
  },

  updateTechnology: (id, patch) =>
    set((s) =>
      s.technologies[id]
        ? { technologies: { ...s.technologies, [id]: { ...s.technologies[id], ...patch } }, dirty: true }
        : s
    ),

  deleteTechnology: (id) =>
    set((s) => {
      const { [id]: _removed, ...technologies } = s.technologies
      const relIds = new Set(
        Object.values(s.relations)
          .filter((r) => r.targetId === id)
          .map((r) => r.id)
      )
      return { technologies, ...withoutRelations(s, relIds), selection: null, dirty: true }
    }),

  toggleTechnology: (resourceId, technologyId) =>
    set((s) => {
      const existing = Object.values(s.relations).find(
        (r) => r.kind === 'uses' && r.sourceId === resourceId && r.targetId === technologyId
      )
      if (existing) return { ...withoutRelations(s, new Set([existing.id])), dirty: true }
      if (!s.resources[resourceId] || !s.technologies[technologyId]) return s
      const relation: Relation = {
        id: uid(),
        kind: 'uses',
        sourceId: resourceId,
        targetId: technologyId,
        label: '',
        protocol: ''
      }
      return { relations: { ...s.relations, [relation.id]: relation }, dirty: true }
    }),

  connect: (sourceId, targetId, anchors, skip = {}) =>
    set((s) => {
      if (sourceId === targetId) return s
      const { resources, relations } = s
      const again = (more: { endpoint?: boolean; relation?: boolean }) => () =>
        get().connect(sourceId, targetId, anchors, { ...skip, ...more })

      // Endpoint: o outro recurso já está ligado a um endpoint com a mesma rota?
      const endpointId = resources[targetId]?.type === 'endpoint' ? targetId : resources[sourceId]?.type === 'endpoint' ? sourceId : null
      const otherId = endpointId === targetId ? sourceId : targetId
      const endpoint = endpointId ? resources[endpointId] : undefined
      const sameRoute =
        endpoint && !skip.endpoint
          ? linkedEndpointWithRoute(resources, relations, otherId, endpoint.method, endpoint.path, endpoint.id)
          : undefined
      if (endpoint && sameRoute) {
        return {
          choice: {
            title: 'Esse endpoint já existe',
            message: `"${resources[otherId]?.name}" já está ligado a ${sameRoute.name}. Usar o endpoint existente ou criar a ligação com este novo, mantendo os dois?`,
            options: [
              {
                label: 'Usar o existente',
                primary: true,
                run: () => {
                  // O novo dá lugar ao existente (no desenho e nas ligações dele)
                  get().mergeResource(endpoint.id, sameRoute.id)
                  const rel = relationBetween(get().relations, otherId, sameRoute.id)
                  if (rel) get().showRelation(rel.id)
                }
              },
              { label: 'Criar novo, manter os dois', run: again({ endpoint: true }) }
            ]
          }
        }
      }

      // Já existe ligação entre os dois (qualquer tipo, qualquer direção)?
      const existing = skip.relation ? undefined : relationBetween(relations, sourceId, targetId)
      if (existing) {
        const describe = `${resources[existing.sourceId]?.name} → ${resources[existing.targetId]?.name}${
          existing.relType ? ` (${ARCHIMATE_TYPES[existing.relType].label})` : ''
        }`
        return {
          choice: {
            title: 'Já existe uma ligação entre esses recursos',
            message: `${describe}. Usar a ligação existente ou criar uma nova, mantendo as duas?`,
            options: [
              { label: 'Usar a existente', primary: true, run: () => get().showRelation(existing.id) },
              { label: 'Criar nova, manter as duas', run: again({ relation: true }) }
            ]
          }
        }
      }

      const relation: Relation = { id: uid(), kind: 'flow', sourceId, targetId, label: '', protocol: '' }
      if (s.newRelType) relation.relType = s.newRelType
      return {
        relations: { ...s.relations, [relation.id]: relation },
        ...updateActive(s, (d) => ({
          ...d,
          edges: [...d.edges, relation.id],
          ...(anchors && (anchors.source || anchors.target)
            ? { anchors: { ...d.anchors, [relation.id]: anchors } }
            : {})
        })),
        selection: { kind: 'relation', id: relation.id },
        dirty: true
      }
    }),

  reverseRelation: (id) =>
    set((s) => {
      const rel = s.relations[id]
      if (!rel || rel.kind !== 'flow') return s
      const diagrams = Object.fromEntries(
        Object.entries(s.diagrams).map(([path, d]) => {
          const a = d.anchors?.[id]
          if (!a) return [path, d]
          return [path, { ...d, anchors: { ...d.anchors, [id]: { source: a.target, target: a.source } } }]
        })
      )
      return {
        relations: { ...s.relations, [id]: { ...rel, sourceId: rel.targetId, targetId: rel.sourceId } },
        diagrams,
        dirty: true
      }
    }),

  showRelation: (id) =>
    set((s) => {
      const rel = s.relations[id]
      const active = s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined
      if (!rel || !active) return s
      const shown = active.edges.includes(id)
      return {
        ...(shown ? {} : updateActive(s, (d) => ({ ...d, edges: [...d.edges, id] }))),
        selection: { kind: 'relation', id }
      }
    }),

  updateRelation: (id, patch) =>
    set((s) => {
      const current = s.relations[id]
      if (!current) return s
      const next = { ...current, ...patch }
      // Campos opcionais vazios saem do arquivo
      for (const key of ['impact', 'relType', 'accessMode', 'strength', 'directed'] as const) {
        if (key in patch && !patch[key]) delete next[key]
      }
      return { relations: { ...s.relations, [id]: next }, dirty: true }
    }),

  deleteRelation: (id) =>
    set((s) => ({
      ...withoutRelations(s, new Set([id])),
      selection: s.selection?.id === id ? null : s.selection,
      dirty: true
    })),

  removeEdgesFromDiagram: (relationIds) =>
    set((s) => ({
      // Também serve para as ligações visuais (connectors), que só existem no desenho
      ...updateActive(s, (d) => ({
        ...d,
        edges: d.edges.filter((id) => !relationIds.includes(id)),
        ...(d.connectors ? { connectors: d.connectors.filter((c) => !relationIds.includes(c.id)) } : {})
      })),
      selection: null
    })),

  addConnector: (source, target, anchors) => {
    const connector: Connector = {
      id: uid(),
      source,
      target,
      ...(anchors?.source ? { sourceHandle: anchors.source } : {}),
      ...(anchors?.target ? { targetHandle: anchors.target } : {})
    }
    set((s) => ({
      ...updateActive(s, (d) => ({ ...d, connectors: [...(d.connectors ?? []), connector] })),
      selection: { kind: 'connector', id: connector.id }
    }))
    return connector.id
  },

  updateConnector: (id, patch) =>
    set((s) =>
      updateActive(s, (d) => ({
        ...d,
        connectors: (d.connectors ?? []).map((c) => {
          if (c.id !== id) return c
          const next: Connector = { ...c, ...patch }
          // Valores padrão saem do arquivo
          for (const key of ['label', 'arrow', 'dashed', 'color', 'sourceHandle', 'targetHandle'] as const) {
            if (key in patch && (!patch[key] || (key === 'arrow' && patch.arrow === 'end'))) delete next[key]
          }
          return next
        })
      }))
    ),

  reverseConnector: (id) =>
    set((s) =>
      updateActive(s, (d) => ({
        ...d,
        connectors: (d.connectors ?? []).map((c) => {
          if (c.id !== id) return c
          const { sourceHandle, targetHandle, ...rest } = c
          return {
            ...rest,
            source: c.target,
            target: c.source,
            ...(targetHandle ? { sourceHandle: targetHandle } : {}),
            ...(sourceHandle ? { targetHandle: sourceHandle } : {})
          }
        })
      }))
    ),

  addShape: (kind, position) =>
    set((s) => {
      const info = SHAPE_KINDS[kind]
      const shape: Shape = {
        id: uid(),
        kind,
        x: position.x - info.width / 2,
        y: position.y - info.height / 2,
        width: info.width,
        height: info.height,
        text: kind === 'text' ? 'Texto' : kind === 'legend' ? 'Legenda' : '',
        fill: kind === 'text' ? 'transparent' : '#ffffff',
        stroke: kind === 'legend' ? '#cbd5e1' : '#334155',
        strokeStyle: kind === 'text' ? 'none' : 'solid',
        textColor: '#0f172a',
        fontSize: kind === 'text' ? 16 : 14
      }
      return {
        ...updateActive(s, (d) => ({ ...d, shapes: [...d.shapes, { ...shape, z: nextZ(d) }] })),
        selection: { kind: 'shape', id: shape.id }
      }
    }),

  updateShape: (id, patch) =>
    set((s) =>
      updateActive(s, (d) => ({ ...d, shapes: d.shapes.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)) }))
    ),

  duplicateShape: (id) =>
    set((s) => {
      const d = s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined
      const original = d?.shapes.find((sh) => sh.id === id)
      if (!d || !original) return s
      const copy: Shape = { ...original, id: uid(), x: original.x + 24, y: original.y + 24, z: nextZ(d) }
      return {
        ...updateActive(s, (diagram) => ({ ...diagram, shapes: [...diagram.shapes, copy] })),
        selection: { kind: 'shape', id: copy.id }
      }
    }),

  moveItem: (id, x, y) =>
    set((s) =>
      updateActive(s, (d) => ({
        ...d,
        nodes: d.nodes.map((n) => (n.resourceId === id ? { ...n, x, y } : n)),
        shapes: d.shapes.map((sh) => (sh.id === id ? { ...sh, x, y } : sh))
      }))
    ),

  resizeNode: (resourceId, size) =>
    set((s) =>
      updateActive(s, (d) => ({
        ...d,
        nodes: d.nodes.map((n) => {
          if (n.resourceId !== resourceId) return n
          const { width: _w, height: _h, ...rest } = n
          return size ? { ...rest, ...size } : rest
        })
      }))
    ),

  removeFromDiagram: (ids) =>
    set((s) => ({
      ...updateActive(s, (d) => {
        const nodes = d.nodes.filter((n) => !ids.includes(n.resourceId))
        const present = presentIds({ ...d, nodes })
        const edges = d.edges.filter((id) => {
          const r = s.relations[id]
          return r && present.has(r.sourceId) && present.has(r.targetId)
        })
        // Ligações visuais presas a um item removido saem junto
        const connectors = d.connectors?.filter((c) => !ids.includes(c.source) && !ids.includes(c.target))
        return { ...d, nodes, edges, shapes: d.shapes.filter((sh) => !ids.includes(sh.id)), ...(d.connectors ? { connectors } : {}) }
      }),
      selection: null
    })),

  reorder: (id, op) =>
    set((s) =>
      updateActive(s, (d) => {
        // Recursos e formas dividem a mesma pilha
        const stack = [
          ...d.nodes.map((n, i) => ({ id: n.resourceId, z: n.z ?? 0, i })),
          ...d.shapes.map((sh, i) => ({ id: sh.id, z: sh.z ?? 0, i: i + d.nodes.length }))
        ]
          .sort((a, b) => a.z - b.z || a.i - b.i)
          .map((item) => item.id)
        const from = stack.indexOf(id)
        if (from < 0) return d
        const to =
          op === 'front' ? stack.length - 1 : op === 'back' ? 0 : op === 'forward' ? Math.min(from + 1, stack.length - 1) : Math.max(from - 1, 0)
        stack.splice(to, 0, ...stack.splice(from, 1))
        const z = new Map(stack.map((itemId, index) => [itemId, index + 1]))
        return {
          ...d,
          nodes: d.nodes.map((n) => ({ ...n, z: z.get(n.resourceId) })),
          shapes: d.shapes.map((sh) => ({ ...sh, z: z.get(sh.id) }))
        }
      })
    ),

  setNewRelType: (newRelType) => set({ newRelType }),

  setEdgeAnchors: (relationId, anchors) =>
    set((s) => updateActive(s, (d) => ({ ...d, anchors: { ...d.anchors, [relationId]: anchors } }))),

  setTool: (tool) => set({ tool }),

  notify: (text) => set({ notice: { text, at: Date.now() } }),

  setHiddenEdges: (ids) =>
    set((s) => (s.hiddenEdges.length === ids.length && ids.every((id, i) => s.hiddenEdges[i] === id) ? s : { hiddenEdges: ids })),

  select: (selection) => set({ selection, selectedItems: [], selectedEdges: [] }),

  setMultiSelection: (items, edges) =>
    set((s) => {
      if (items.length + edges.length > 1) return { selection: null, selectedItems: items, selectedEdges: edges }
      const d = s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined
      const selection: Selection = edges[0]
        ? { kind: d?.connectors?.some((c) => c.id === edges[0]) ? 'connector' : 'relation', id: edges[0] }
        : items[0]
          ? { kind: d?.shapes.some((sh) => sh.id === items[0]) ? 'shape' : 'resource', id: items[0] }
          : null
      return { selection, selectedItems: [], selectedEdges: [] }
    }),

  setLocked: (ids, locked) =>
    set((s) =>
      updateActive(s, (d) => {
        const apply = <T extends { locked?: boolean }>(item: T): T => {
          const { locked: _old, ...rest } = item
          return (locked ? { ...rest, locked: true } : rest) as T
        }
        return {
          ...d,
          nodes: d.nodes.map((n) => (ids.includes(n.resourceId) ? apply(n) : n)),
          shapes: d.shapes.map((sh) => (ids.includes(sh.id) ? apply(sh) : sh))
        }
      })
    )
}))

// Qualquer ação que define `selection` diretamente (criar, ligar, desfazer…) encerra a seleção múltipla
useModel.subscribe((state, prev) => {
  if (state.selection !== prev.selection && state.selectedItems === prev.selectedItems && state.selectedItems.length) {
    useModel.setState({ selectedItems: [], selectedEdges: [] })
  }
})

/** Ids selecionados no desenho (recursos/formas e ligações), seja seleção simples ou múltipla. */
export function selectedIds(s: Pick<ModelState, 'selection' | 'selectedItems' | 'selectedEdges'>): {
  items: string[]
  edges: string[]
} {
  if (s.selectedItems.length + s.selectedEdges.length > 1) return { items: s.selectedItems, edges: s.selectedEdges }
  const sel = s.selection
  if (sel?.kind === 'relation' || sel?.kind === 'connector') return { items: [], edges: [sel.id] }
  if (sel?.kind === 'resource' || sel?.kind === 'shape') return { items: [sel.id], edges: [] }
  return { items: [], edges: [] }
}

/** Tecnologias ligadas a um recurso, com o id da relação `uses`. */
export function technologiesOf(
  resourceId: string,
  relations: Record<string, Relation>,
  technologies: Record<string, Technology>
): { relationId: string; technology: Technology }[] {
  return Object.values(relations)
    .filter((r) => r.kind === 'uses' && r.sourceId === resourceId && technologies[r.targetId])
    .map((r) => ({ relationId: r.id, technology: technologies[r.targetId] }))
    .sort((a, b) => a.technology.name.localeCompare(b.technology.name, 'pt-BR'))
}

/**
 * Outros recursos com o mesmo nome (sem diferenciar maiúsculas, acentos e
 * pontuação, como no nome do arquivo). Endpoints não entram: o nome deles é calculado.
 */
export function sameNameResources(resource: Resource, resources: Record<string, Resource>): Resource[] {
  if (resource.type === 'endpoint' || !resource.name.trim()) return []
  const slug = slugify(resource.name)
  return Object.values(resources)
    .filter((r) => r.id !== resource.id && r.type !== 'endpoint' && slugify(r.name) === slug)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** Tipos de ligação que dizem "o endpoint é deste recurso". */
const OWNERSHIP: (ArchimateRelType | undefined)[] = ['composition', 'aggregation']

const byRoute = (a: Resource, b: Resource): number =>
  (a.path ?? '').localeCompare(b.path ?? '') || (a.method ?? '').localeCompare(b.method ?? '')

/** Endpoints de um recurso: os ligados a ele por Composição (ou Agregação) saindo do recurso. */
export function endpointsOf(
  resourceId: string,
  resources: Record<string, Resource>,
  relations: Record<string, Relation>
): Resource[] {
  const ids = new Set(
    Object.values(relations)
      .filter((r) => r.kind === 'flow' && r.sourceId === resourceId && OWNERSHIP.includes(r.relType))
      .map((r) => r.targetId)
  )
  return [...ids]
    .map((id) => resources[id])
    .filter((r): r is Resource => r?.type === 'endpoint')
    .sort(byRoute)
}

/** Donos de um endpoint (quem o compõe/agrega), por nome. */
export function ownersOf(
  endpointId: string,
  resources: Record<string, Resource>,
  relations: Record<string, Relation>
): Resource[] {
  return Object.values(relations)
    .filter((r) => r.kind === 'flow' && r.targetId === endpointId && OWNERSHIP.includes(r.relType))
    .map((r) => resources[r.sourceId])
    .filter((r): r is Resource => !!r)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * Rota normalizada de um endpoint, para detectar repetidos: método + caminho sem
 * diferença de maiúsculas, barra final ou nome de parâmetro (`{id}` = `{pedidoId}`).
 */
export function endpointRoute(method: string | undefined, path: string | undefined): string {
  const normalized = ('/' + (path ?? '').trim().replace(/^\/+/, ''))
    .replace(/\{[^}]*\}/g, '{}')
    .replace(/\/+$/, '')
    .toLowerCase()
  return `${method ?? 'GET'} ${normalized || '/'}`
}

/** Ligação `flow` entre dois recursos, em qualquer direção e de qualquer tipo. */
export function relationBetween(relations: Record<string, Relation>, a: string, b: string): Relation | undefined {
  return Object.values(relations).find(
    (r) => r.kind === 'flow' && ((r.sourceId === a && r.targetId === b) || (r.sourceId === b && r.targetId === a))
  )
}

/**
 * Endpoint com a mesma rota já ligado ao recurso (por qualquer ligação, em qualquer direção).
 * É assim que se verifica endpoint repetido: pelas ligações, não por um campo de dono.
 */
export function linkedEndpointWithRoute(
  resources: Record<string, Resource>,
  relations: Record<string, Relation>,
  resourceId: string,
  method: string | undefined,
  path: string | undefined,
  exceptId?: string
): Resource | undefined {
  const route = endpointRoute(method, path)
  for (const r of Object.values(relations)) {
    if (r.kind !== 'flow' || (r.sourceId !== resourceId && r.targetId !== resourceId)) continue
    const other = resources[r.sourceId === resourceId ? r.targetId : r.sourceId]
    if (other?.type === 'endpoint' && other.id !== exceptId && endpointRoute(other.method, other.path) === route) return other
  }
  return undefined
}

/**
 * Mudar a rota de um endpoint repete outro? Procura, entre os recursos ligados a ele, algum
 * que já tenha um endpoint com a rota nova.
 */
export function routeConflict(
  resources: Record<string, Resource>,
  relations: Record<string, Relation>,
  endpointId: string,
  method: string | undefined,
  path: string | undefined
): { resource: Resource; endpoint: Resource } | undefined {
  for (const r of Object.values(relations)) {
    if (r.kind !== 'flow' || (r.sourceId !== endpointId && r.targetId !== endpointId)) continue
    const resource = resources[r.sourceId === endpointId ? r.targetId : r.sourceId]
    if (!resource || resource.type === 'endpoint') continue
    const endpoint = linkedEndpointWithRoute(resources, relations, resource.id, method, path, endpointId)
    if (endpoint) return { resource, endpoint }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Desfazer / refazer
// ---------------------------------------------------------------------------

/** Partes do estado que o desfazer restaura (o conteúdo do repositório, não a interface). */
const TRACKED = [
  'resources',
  'technologies',
  'relations',
  'diagrams',
  'docs',
  'dirs',
  'otherFiles',
  'pendingFiles',
  'paths',
  'snapshot'
] as const
type HistoryEntry = Pick<ModelState, (typeof TRACKED)[number] | 'dirty'>

const HISTORY_LIMIT = 200
/** Mudanças seguidas com menos que isso de intervalo viram um passo só (arrastar, digitar). */
const COALESCE_MS = 600

let past: HistoryEntry[] = []
let future: HistoryEntry[] = []
let lastChangeAt = 0
let recording = true

const entryOf = (s: ModelState): HistoryEntry => {
  const entry = { dirty: s.dirty } as HistoryEntry
  for (const key of TRACKED) (entry as Record<string, unknown>)[key] = s[key]
  return entry
}

function publishHistory(): void {
  const canUndo = past.length > 0
  const canRedo = future.length > 0
  const h = useModel.getState().history
  if (h.canUndo !== canUndo || h.canRedo !== canRedo) withoutHistory(() => useModel.setState({ history: { canUndo, canRedo } }))
}

function withoutHistory(fn: () => void): void {
  const was = recording
  recording = false
  try {
    fn()
  } finally {
    recording = was
  }
}

function resetHistory(): void {
  past = []
  future = []
  lastChangeAt = 0
  publishHistory()
}

// Toda mudança no conteúdo guarda o estado anterior (agrupando mudanças em sequência)
useModel.subscribe((state, prev) => {
  if (!recording || !prev.root || state.root !== prev.root) return
  if (!TRACKED.some((key) => state[key] !== prev[key])) return
  const now = Date.now()
  if (now - lastChangeAt > COALESCE_MS || past.length === 0) {
    past.push(entryOf(prev))
    if (past.length > HISTORY_LIMIT) past.shift()
  }
  lastChangeAt = now
  future = []
  publishHistory()
})

/** Mesmas pastas e mesmos arquivos não reconhecidos (que o app só move/apaga junto com pastas). */
const sameStructure = (a: HistoryEntry, b: HistoryEntry): boolean =>
  [...a.dirs].sort().join('\n') === [...b.dirs].sort().join('\n') &&
  [...a.otherFiles].sort().join('\n') === [...b.otherFiles].sort().join('\n')

/**
 * Depois do Salvar o disco mudou: os passos guardados passam a ser comparados com o
 * disco novo. Desfazer além de uma mudança de pastas já gravada poderia apagar
 * arquivos que o app não conhece, então o histórico para nesse ponto.
 */
function rebaseHistoryAfterSave(): void {
  const current = entryOf(useModel.getState())
  const rebase = (entry: HistoryEntry): HistoryEntry => ({
    ...entry,
    snapshot: current.snapshot,
    paths: { ...entry.paths, ...current.paths },
    dirty: true
  })
  const keptPast: HistoryEntry[] = []
  for (let i = past.length - 1; i >= 0 && sameStructure(past[i], current); i--) keptPast.unshift(rebase(past[i]))
  const keptFuture: HistoryEntry[] = []
  for (let i = future.length - 1; i >= 0 && sameStructure(future[i], current); i--) keptFuture.unshift(rebase(future[i]))
  past = keptPast
  future = keptFuture.length === future.length ? keptFuture : []
  lastChangeAt = 0
  publishHistory()
}

function stepHistory(direction: 'undo' | 'redo'): void {
  const from = direction === 'undo' ? past : future
  const to = direction === 'undo' ? future : past
  const entry = from.pop()
  if (!entry) return
  const state = useModel.getState()
  to.push(entryOf(state))
  lastChangeAt = 0
  withoutHistory(() =>
    useModel.setState(() => {
      // Abas e seleção acompanham o que ainda existe
      const exists = (path: string): boolean => path in entry.diagrams || path in entry.docs
      const openDiagrams = state.openDiagrams.filter(exists)
      const activeDiagram =
        state.activeDiagram && exists(state.activeDiagram) ? state.activeDiagram : (openDiagrams.at(-1) ?? null)
      const sel = state.selection
      const selectionExists =
        !sel ||
        (sel.kind === 'resource' && !!entry.resources[sel.id]) ||
        (sel.kind === 'technology' && !!entry.technologies[sel.id]) ||
        (sel.kind === 'relation' && !!entry.relations[sel.id]) ||
        (sel.kind === 'shape' && !!activeDiagram && !!entry.diagrams[activeDiagram]?.shapes.some((sh) => sh.id === sel.id))
      return { ...entry, openDiagrams, activeDiagram, selection: selectionExists ? sel : null, duplicateCheck: null }
    })
  )
  publishHistory()
}

/** Caminho como está em disco: troca a pasta raiz canônica pelo nome real (ex.: "applications/x.json"). */
export function displayPath(path: string, folderNames: Record<string, string>): string {
  const [top, ...rest] = path.split('/')
  return [folderNames[top] ?? top, ...rest].join('/')
}
