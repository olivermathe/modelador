import { computePaths, fileStem, type RepoContent } from './repo'
import { REPO_FOLDERS } from './types'

export type FileRef =
  | { kind: 'resource'; id: string }
  | { kind: 'technology'; id: string }
  | { kind: 'relation'; id: string }
  | { kind: 'diagram'; path: string }
  | { kind: 'doc'; path: string }
  | { kind: 'other' }

export interface TreeFile {
  path: string
  name: string
  ref: FileRef
}

export interface TreeDir {
  path: string
  name: string
  dirs: TreeDir[]
  files: TreeFile[]
}

const TOP_ORDER: string[] = [
  REPO_FOLDERS.projects,
  REPO_FOLDERS.resources,
  REPO_FOLDERS.technologies,
  REPO_FOLDERS.relations
]

/** Monta a árvore da pasta aberta, incluindo arquivos ainda não salvos. */
export function buildTree(c: RepoContent): TreeDir[] {
  const paths = computePaths(c)
  const files: TreeFile[] = [
    ...Object.keys(c.resources).map((id) => ({ path: paths[id], ref: { kind: 'resource', id } as FileRef })),
    ...Object.keys(c.technologies).map((id) => ({ path: paths[id], ref: { kind: 'technology', id } as FileRef })),
    ...Object.keys(c.relations).map((id) => ({ path: paths[id], ref: { kind: 'relation', id } as FileRef })),
    ...Object.keys(c.diagrams).map((path) => ({ path, ref: { kind: 'diagram', path } as FileRef })),
    ...Object.keys(c.docs).map((path) => ({ path, ref: { kind: 'doc', path } as FileRef })),
    ...c.otherFiles.map((path) => ({ path, ref: { kind: 'other' } as FileRef }))
  ].map((f) => ({ ...f, name: fileStem(f.path) }))

  const dirs = new Map<string, TreeDir>()
  const ensureDir = (path: string): TreeDir => {
    let dir = dirs.get(path)
    if (dir) return dir
    const parts = path.split('/')
    dir = { path, name: parts.at(-1)!, dirs: [], files: [] }
    dirs.set(path, dir)
    if (parts.length > 1) ensureDir(parts.slice(0, -1).join('/')).dirs.push(dir)
    return dir
  }

  for (const top of TOP_ORDER) ensureDir(top)
  for (const path of c.dirs) ensureDir(path)
  for (const file of files) ensureDir(file.path.split('/').slice(0, -1).join('/')).files.push(file)

  const sortDir = (dir: TreeDir): TreeDir => {
    dir.dirs.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).forEach(sortDir)
    dir.files.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return dir
  }
  return TOP_ORDER.map((top) => sortDir(dirs.get(top)!))
}

/** Filtra a árvore mantendo as pastas que contêm arquivos que casam com a busca. */
export function filterTree(dirs: TreeDir[], match: (f: TreeFile) => boolean): TreeDir[] {
  return dirs
    .map((d) => ({ ...d, dirs: filterTree(d.dirs, match), files: d.files.filter(match) }))
    .filter((d) => d.dirs.length > 0 || d.files.length > 0)
}

export function countFiles(dir: TreeDir): number {
  return dir.files.length + dir.dirs.reduce((sum, d) => sum + countFiles(d), 0)
}
