import { FolderOpen, ImageDown, PackagePlus, Redo2, RefreshCw, Save, Undo2, X } from 'lucide-react'
import { useEffect } from 'react'
import { openRepo, reloadRepo, saveRepo } from '@/model/fileActions'
import { fileStem } from '@/model/repo'
import { useModel } from '@/model/store'
import { useExportJpeg } from './exportImage'

function ToolbarButton({
  onClick,
  title,
  children
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
    >
      {children}
    </button>
  )
}

/** Num campo de texto, desfaz a digitação (comportamento normal do campo); fora dele, desfaz o modelo. */
function undoOrRedo(action: 'undo' | 'redo'): void {
  const el = document.activeElement as HTMLElement | null
  const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  if (typing) document.execCommand(action)
  else useModel.getState()[action]()
}

function IconButton({
  onClick,
  title,
  disabled,
  children
}: {
  onClick: () => void
  title: string
  disabled: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="shrink-0 rounded-md p-1.5 text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

export function Toolbar(): JSX.Element {
  const root = useModel((s) => s.root)
  const dirty = useModel((s) => s.dirty)
  const diagramOpen = useModel((s) => !!s.activeDiagram && s.activeDiagram in s.diagrams)
  const exportJpeg = useExportJpeg()
  const { canUndo, canRedo } = useModel((s) => s.history)
  const isMac = navigator.platform.toLowerCase().includes('mac')

  // Atalhos do menu nativo (⌘O, ⌘S, ⌘E)
  useEffect(
    () =>
      window.api.onMenuAction((action) => {
        if (action === 'open') openRepo()
        else if (action === 'reload') reloadRepo()
        else if (action === 'save') saveRepo()
        else if (action === 'exportJpeg') exportJpeg()
        else if (action === 'undo' || action === 'redo') undoOrRedo(action)
      }),
    [exportJpeg]
  )

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3">
      <span className="mr-3 text-sm font-semibold text-slate-900">Modelador</span>
      <ToolbarButton onClick={openRepo} title="Abrir repositório (⌘O)">
        <FolderOpen className="h-4 w-4" /> Abrir pasta
      </ToolbarButton>
      {root && (
        <>
          <ToolbarButton onClick={saveRepo} title="Salvar alterações na pasta (⌘S)">
            <Save className="h-4 w-4" /> Salvar
          </ToolbarButton>
          <IconButton onClick={() => useModel.getState().undo()} disabled={!canUndo} title={`Desfazer (${isMac ? '⌘Z' : 'Ctrl+Z'})`}>
            <Undo2 className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={() => useModel.getState().redo()} disabled={!canRedo} title={`Refazer (${isMac ? '⇧⌘Z' : 'Ctrl+Y'})`}>
            <Redo2 className="h-4 w-4" />
          </IconButton>
          <ToolbarButton onClick={() => useModel.getState().openFeatureDialog()} title="Criar pasta de feature com diagrama, processo e documento">
            <PackagePlus className="h-4 w-4" /> Nova feature
          </ToolbarButton>
          <ToolbarButton onClick={reloadRepo} title="Reler a pasta do disco (ex.: depois de um git pull)">
            <RefreshCw className="h-4 w-4" /> Recarregar
          </ToolbarButton>
          {diagramOpen && (
            <ToolbarButton onClick={exportJpeg} title="Exportar o desenho aberto como JPEG (⌘E)">
              <ImageDown className="h-4 w-4" /> Exportar JPEG
            </ToolbarButton>
          )}
        </>
      )}
      <span className="ml-auto min-w-0 truncate pl-3 text-xs text-slate-500" title={root ?? ''}>
        {root}
        {dirty && <span className="ml-1 text-amber-600">• não salvo</span>}
      </span>
    </header>
  )
}

export function DiagramTabs(): JSX.Element {
  const openDiagrams = useModel((s) => s.openDiagrams)
  const activeDiagram = useModel((s) => s.activeDiagram)
  const { openDiagram, closeDiagram } = useModel.getState()

  return (
    <nav className="flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2">
      {openDiagrams.map((path) => {
        const active = path === activeDiagram
        return (
          <div
            key={path}
            onClick={() => openDiagram(path)}
            title={path}
            className={`group flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-t-md border border-b-0 px-3 text-sm ${
              active ? 'border-slate-200 bg-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="max-w-48 truncate">{fileStem(path)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeDiagram(path)
              }}
              className="rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
              title="Fechar aba"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </nav>
  )
}

export function Welcome(): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">Abra um repositório</h1>
        <p className="mt-2 text-sm text-slate-500">
          Escolha a pasta do repositório de arquitetura. Ela deve conter <code>aplicações/</code>,{' '}
          <code>tecnologias/</code>, <code>relações/</code> e <code>projetos/</code>. Se a pasta estiver vazia, a
          estrutura é criada.
        </p>
        <button
          onClick={openRepo}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          <FolderOpen className="h-4 w-4" /> Abrir pasta
        </button>
      </div>
    </div>
  )
}
