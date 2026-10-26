import { ReactFlowProvider } from '@xyflow/react'
import { useEffect } from 'react'
import { ArchimateMarkers } from './components/ArchimateMarkers'
import { Canvas } from './components/Canvas'
import { DuplicateResourceDialog } from './components/DuplicateResourceDialog'
import { ChoiceDialog } from './components/ChoiceDialog'
import { FeatureDialog } from './components/FeatureDialog'
import { Notice } from './components/Notice'
import { MarkdownEditor } from './components/MarkdownEditor'
import { SidePanel } from './components/SidePanel'
import { RepoPanel } from './components/RepoPanel'
import { ResizablePanel } from './components/ResizablePanel'
import { DiagramTabs, Toolbar, Welcome } from './components/Toolbar'
import { openLastRepo } from './model/fileActions'
import { useModel } from './model/store'

export function App(): JSX.Element {
  const dirty = useModel((s) => s.dirty)
  const root = useModel((s) => s.root)
  const activeDoc = useModel((s) => (s.activeDiagram && s.activeDiagram in s.docs ? s.activeDiagram : null))

  // Reabre o último repositório usado
  useEffect(() => {
    openLastRepo()
  }, [])

  // Título da janela e aviso de alterações não salvas ao fechar
  useEffect(() => window.api.setWindowState({ dirty, root }), [dirty, root])

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
        <ArchimateMarkers />
        <Toolbar />
        {root ? (
          <div className="flex min-h-0 flex-1">
            <ResizablePanel side="left" title="Arquivos" storageKey="painel-esquerdo" defaultWidth={288}>
              <RepoPanel />
            </ResizablePanel>
            <main className="flex min-w-0 flex-1 flex-col">
              <DiagramTabs />
              <div className="min-h-0 flex-1">
                {activeDoc ? <MarkdownEditor path={activeDoc} /> : <Canvas />}
              </div>
            </main>
            {!activeDoc && (
              <ResizablePanel side="right" title="Paleta e propriedades" storageKey="painel-direito" defaultWidth={320} minWidth={260}>
                <SidePanel />
              </ResizablePanel>
            )}
          </div>
        ) : (
          <Welcome />
        )}
        <DuplicateResourceDialog />
        <FeatureDialog />
        <ChoiceDialog />
        <Notice />
      </div>
    </ReactFlowProvider>
  )
}
