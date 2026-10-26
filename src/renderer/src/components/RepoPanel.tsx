import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Cpu,
  FilePen,
  FilePlus,
  PackagePlus,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Workflow,
  type LucideIcon
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ELEMENT_TYPES } from '@/model/elementTypes'
import { fileExt, fileStem, isInside, parentDir } from '@/model/repo'
import { useModel } from '@/model/store'
import { buildTree, countFiles, filterTree, type TreeDir, type TreeFile } from '@/model/tree'
import { REPO_FOLDERS } from '@/model/types'
import { setDragPayload, type DragPayload } from './dnd'
import { RowMenu, type RowMenuItem } from './RowMenu'

type CreateKind = 'diagram' | 'doc' | 'folder' | 'technology'

const CREATE_PLACEHOLDER: Record<CreateKind, string> = {
  diagram: 'Nome do desenho',
  doc: 'Nome do documento',
  folder: 'Nome da pasta',
  technology: 'Nomes, separados por vírgula'
}

/** Nome digitado pelo usuário → nome de arquivo/pasta seguro. */
const sanitize = (name: string): string => name.trim().replace(/[\\/:*?"<>|]+/g, '-')

/** O caminho já está em uso (desenho, pasta ou outro arquivo)? */
function pathTaken(path: string): boolean {
  const s = useModel.getState()
  return path in s.diagrams || path in s.docs || s.dirs.includes(path) || s.otherFiles.includes(path)
}

/** Linha de texto editável usada para criar e renomear itens da árvore. */
function InlineInput({
  defaultValue = '',
  placeholder,
  indent,
  onDone
}: {
  defaultValue?: string
  placeholder?: string
  indent: number
  onDone: (value: string | null) => void
}): JSX.Element {
  return (
    <div className="py-0.5 pr-1" style={{ paddingLeft: indent }}>
      <input
        autoFocus
        defaultValue={defaultValue}
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => onDone(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.currentTarget.value = defaultValue
            e.currentTarget.blur()
          }
        }}
        className="w-full rounded border border-sky-400 px-1.5 py-0.5 text-sm outline-none"
      />
    </div>
  )
}

export function RepoPanel(): JSX.Element {
  const root = useModel((s) => s.root)
  const resources = useModel((s) => s.resources)
  const technologies = useModel((s) => s.technologies)
  const relations = useModel((s) => s.relations)
  const paths = useModel((s) => s.paths)
  const otherFiles = useModel((s) => s.otherFiles)
  const dirs = useModel((s) => s.dirs)
  // A árvore só depende de quais desenhos existem, não do conteúdo deles
  const diagramPaths = useModel((s) => Object.keys(s.diagrams).join('\n'))
  const docPaths = useModel((s) => Object.keys(s.docs).join('\n'))
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set([REPO_FOLDERS.relations]))
  const [creating, setCreating] = useState<{ dir: string; kind: CreateKind } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  const tree = useMemo(() => {
    const diagrams = Object.fromEntries(
      diagramPaths
        .split('\n')
        .filter(Boolean)
        .map((p) => [p, { nodes: [], edges: [], shapes: [] }])
    )
    const docs = Object.fromEntries(docPaths.split('\n').filter(Boolean).map((p) => [p, '']))
    return buildTree({ resources, technologies, relations, diagrams, docs, paths, otherFiles, pendingFiles: {}, dirs })
  }, [resources, technologies, relations, diagramPaths, docPaths, paths, otherFiles, dirs])

  const visibleTree = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tree
    return filterTree(tree, (f) => {
      const entityName =
        f.ref.kind === 'resource'
          ? resources[f.ref.id]?.name
          : f.ref.kind === 'technology'
            ? technologies[f.ref.id]?.name
            : ''
      return [f.name, entityName ?? ''].some((v) => v.toLowerCase().includes(q))
    })
  }, [tree, query, resources, technologies])

  const toggle = (path: string): void =>
    setCollapsed((c) => {
      const next = new Set(c)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const expand = (dir: string): void =>
    setCollapsed((c) => {
      const next = new Set(c)
      next.delete(dir)
      return next
    })

  const actions: TreeActions = {
    startCreating: (dir, kind) => {
      expand(dir)
      setRenaming(null)
      setCreating({ dir, kind })
    },
    finishCreating: (value) => {
      const target = creating
      setCreating(null)
      if (!target || !value?.trim()) return
      const { createDir, createDiagram, createDoc, createTechnology } = useModel.getState()
      if (target.kind === 'technology') {
        // Aceita várias de uma vez: "Java, Spring Boot, Redis"
        const names = value.split(',').map((n) => n.trim()).filter(Boolean)
        names.forEach((name, i) => createTechnology(name, i === names.length - 1))
        return
      }
      const name = sanitize(value)
      const ext = target.kind === 'folder' ? '' : target.kind === 'doc' ? '.md' : '.json'
      const path = `${target.dir}/${name.replace(/\.md$/i, '')}${ext}`
      if (pathTaken(path)) return alert(`Já existe "${name}" nesta pasta.`)
      if (target.kind === 'folder') createDir(path)
      else if (target.kind === 'doc') createDoc(path)
      else createDiagram(path)
    },
    startRenaming: (path) => {
      setCreating(null)
      setRenaming(path)
    },
    finishRenaming: (path, value) => {
      setRenaming(null)
      const name = value ? sanitize(value) : ''
      if (!name) return
      const ext = fileExt(path)
      const to = `${parentDir(path)}/${name.replace(/\.(json|md)$/i, '')}${ext}`
      if (to === path) return
      if (pathTaken(to)) return alert(`Já existe "${name}" nesta pasta.`)
      useModel.getState().renamePath(path, to)
    },
    deletePath: (path, isDir) => {
      const s = useModel.getState()
      const count = Object.keys(s.diagrams).filter((p) => isInside(p, path)).length
      const docs = Object.keys(s.docs).filter((p) => isInside(p, path)).length
      const others = s.otherFiles.filter((p) => isInside(p, path)).length
      const message = isDir
        ? `Excluir a pasta "${fileStem(path)}"?\n\n${count} desenho(s), ${docs} documento(s)${others ? ` e ${others} outro(s) arquivo(s)` : ''} serão apagados ao salvar.`
        : fileExt(path) === '.md'
          ? `Excluir o documento "${fileStem(path)}"?`
          : `Excluir o desenho "${fileStem(path)}"? Os recursos continuam em aplicações/.`
      if (confirm(message)) s.deletePath(path)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <section className="flex min-h-0 flex-1 flex-col pt-3">
        <h2
          className="mb-2 truncate pl-3 pr-9 text-xs font-semibold uppercase tracking-wide text-slate-500"
          title={root ?? ''}
        >
          {root?.split(/[\\/]/).pop()}
        </h2>
        <label className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 focus-within:border-sky-400">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar arquivos…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-3 text-sm">
          {visibleTree.map((dir) => (
            <DirRow
              key={dir.path}
              dir={dir}
              depth={0}
              collapsed={query ? new Set() : collapsed}
              onToggle={toggle}
              creating={creating}
              renaming={renaming}
              actions={actions}
            />
          ))}
          {query && visibleTree.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-slate-400">Nenhum arquivo encontrado.</p>
          )}
        </div>
      </section>
    </div>
  )
}

interface TreeActions {
  startCreating: (dir: string, kind: CreateKind) => void
  finishCreating: (value: string | null) => void
  startRenaming: (path: string) => void
  finishRenaming: (path: string, value: string | null) => void
  deletePath: (path: string, isDir: boolean) => void
}

interface DirRowProps {
  dir: TreeDir
  depth: number
  collapsed: Set<string>
  onToggle: (path: string) => void
  creating: { dir: string; kind: CreateKind } | null
  renaming: string | null
  actions: TreeActions
}

const indentOf = (depth: number): number => depth * 12 + 22

function DirRow(props: DirRowProps): JSX.Element {
  const { dir, depth, collapsed, onToggle, creating, renaming, actions } = props
  const isOpen = !collapsed.has(dir.path)
  const top = dir.path.split('/')[0]
  const editable = top === REPO_FOLDERS.projects && depth > 0
  // Pastas raiz: o nome real em disco (português ou inglês)
  const rootName = useModel((s) => s.folderNames[dir.path])
  const label = depth === 0 ? (rootName ?? dir.name) : dir.name

  return (
    <div>
      {renaming === dir.path ? (
        <InlineInput
          defaultValue={dir.name}
          indent={depth * 12 + 4}
          onDone={(value) => actions.finishRenaming(dir.path, value)}
        />
      ) : (
        <div
          onClick={() => onToggle(dir.path)}
          onDoubleClick={editable ? () => actions.startRenaming(dir.path) : undefined}
          title={`${dir.path} · ${countFiles(dir)} arquivo(s)`}
          className="group relative flex cursor-pointer items-center gap-1 rounded py-1 pr-1 text-slate-700 hover:bg-slate-50"
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
          <Folder className="h-4 w-4 shrink-0 text-sky-500" />
          <span className={`min-w-0 flex-1 truncate ${depth === 0 ? 'font-medium' : ''}`}>{label}</span>
          <RowMenu label={`Ações da pasta ${label}`} items={dirMenu(dir.path, top, depth, actions)} />
        </div>
      )}

      {isOpen && (
        <div>
          {creating?.dir === dir.path && (
            <InlineInput
              placeholder={CREATE_PLACEHOLDER[creating.kind]}
              indent={indentOf(depth + 1)}
              onDone={actions.finishCreating}
            />
          )}
          {dir.dirs.map((child) => (
            <DirRow key={child.path} {...props} dir={child} depth={depth + 1} />
          ))}
          {dir.files.map((file) =>
            renaming === file.path ? (
              <InlineInput
                key={file.path}
                defaultValue={file.name}
                indent={indentOf(depth + 1)}
                onDone={(value) => actions.finishRenaming(file.path, value)}
              />
            ) : (
              <FileRow key={file.path} file={file} depth={depth + 1} actions={actions} />
            )
          )}
          {dir.dirs.length === 0 && dir.files.length === 0 && creating?.dir !== dir.path && (
            <div className="py-0.5 text-xs text-slate-400" style={{ paddingLeft: indentOf(depth + 1) }}>
              vazia
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Ações disponíveis no menu ⋯ de uma pasta. */
function dirMenu(path: string, top: string, depth: number, actions: TreeActions): RowMenuItem[] {
  if (top === REPO_FOLDERS.technologies && depth === 0) {
    return [{ label: 'Novas tecnologias', icon: Plus, onClick: () => actions.startCreating(path, 'technology') }]
  }
  if (top !== REPO_FOLDERS.projects) return []
  const items: RowMenuItem[] = [
    { label: 'Novo desenho', icon: FilePlus, onClick: () => actions.startCreating(path, 'diagram') },
    { label: 'Novo documento', icon: FilePen, onClick: () => actions.startCreating(path, 'doc') },
    { label: 'Nova feature aqui', icon: PackagePlus, onClick: () => useModel.getState().openFeatureDialog(path) },
    { label: 'Nova pasta', icon: FolderPlus, onClick: () => actions.startCreating(path, 'folder') }
  ]
  // Subpastas de projetos/ são livres; as 4 pastas raiz são fixas
  if (depth > 0) {
    items.push(
      { label: 'Renomear pasta', icon: Pencil, separated: true, onClick: () => actions.startRenaming(path) },
      { label: 'Excluir pasta', icon: Trash2, danger: true, onClick: () => actions.deletePath(path, true) }
    )
  }
  return items
}

function FileRow({ file, depth, actions }: { file: TreeFile; depth: number; actions: TreeActions }): JSX.Element {
  const resource = useModel((s) => (file.ref.kind === 'resource' ? s.resources[file.ref.id] : undefined))
  const technology = useModel((s) => (file.ref.kind === 'technology' ? s.technologies[file.ref.id] : undefined))
  const selection = useModel((s) => s.selection)
  const activeDiagram = useModel((s) => s.activeDiagram)
  const inActiveDiagram = useModel(
    (s) =>
      file.ref.kind === 'resource' &&
      !!s.activeDiagram &&
      !!s.diagrams[s.activeDiagram]?.nodes.some((n) => n.resourceId === (file.ref as { id: string }).id)
  )
  const { select, openDiagram } = useModel.getState()
  const { ref } = file

  let Icon: LucideIcon = FileText
  let iconClass = 'text-slate-300'
  let title = file.path
  let drag: DragPayload | null = null
  let onClick: (() => void) | undefined
  let isSelected = false

  if (ref.kind === 'resource' && resource) {
    Icon = ELEMENT_TYPES[resource.type].icon
    iconClass = 'text-slate-500'
    title = `${resource.name} — arraste para o desenho`
    drag = { kind: 'resource', id: ref.id }
    onClick = () => select({ kind: 'resource', id: ref.id })
    isSelected = selection?.kind === 'resource' && selection.id === ref.id
  } else if (ref.kind === 'technology' && technology) {
    Icon = Cpu
    iconClass = 'text-violet-500'
    title = `${technology.name} — arraste sobre um recurso para ligar`
    drag = { kind: 'technology', id: ref.id }
    onClick = () => select({ kind: 'technology', id: ref.id })
    isSelected = selection?.kind === 'technology' && selection.id === ref.id
  } else if (ref.kind === 'relation') {
    Icon = ArrowRight
    iconClass = 'text-slate-400'
    onClick = () => select({ kind: 'relation', id: ref.id })
    isSelected = selection?.kind === 'relation' && selection.id === ref.id
  } else if (ref.kind === 'diagram' || ref.kind === 'doc') {
    Icon = ref.kind === 'diagram' ? Workflow : FileText
    iconClass = ref.kind === 'diagram' ? 'text-teal-600' : 'text-sky-600'
    onClick = () => openDiagram(ref.path)
    isSelected = activeDiagram === ref.path
  }
  const isOpenable = ref.kind === 'diagram' || ref.kind === 'doc'
  const kindLabel = ref.kind === 'doc' ? 'documento' : 'desenho'

  return (
    <div
      draggable={!!drag}
      onDragStart={drag ? (e) => setDragPayload(e, drag) : undefined}
      onClick={onClick}
      onDoubleClick={isOpenable ? () => actions.startRenaming((ref as { path: string }).path) : undefined}
      title={title}
      className={`group relative flex items-center gap-1.5 rounded py-1 pr-1 ${
        isSelected ? 'bg-sky-50 text-sky-900' : ref.kind === 'other' ? 'text-slate-400' : 'text-slate-700 hover:bg-slate-50'
      } ${drag ? 'cursor-grab active:cursor-grabbing' : onClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ paddingLeft: indentOf(depth) }}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
      <span className="min-w-0 flex-1 truncate">{file.name}</span>
      {inActiveDiagram && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" title="Está no desenho aberto" />}
      {isOpenable && (
        <RowMenu
          label={`Ações do ${kindLabel} ${file.name}`}
          items={[
            { label: `Renomear ${kindLabel}`, icon: Pencil, onClick: () => actions.startRenaming(file.path) },
            { label: `Excluir ${kindLabel}`, icon: Trash2, danger: true, onClick: () => actions.deletePath(file.path, false) }
          ]}
        />
      )}
    </div>
  )
}
