import { computeFiles, diffRepo, sameJson } from './repo'
import { useModel } from './store'

function confirmDiscard(): boolean {
  return !useModel.getState().dirty || confirm('Existem alterações não salvas. Deseja descartá-las?')
}

function reportError(action: string, error: unknown): void {
  alert(`Não foi possível ${action}.\n\n${(error as Error).message}`)
}

export async function openRepo(): Promise<void> {
  if (!confirmDiscard()) return
  try {
    const scan = await window.api.openRepo()
    if (scan) useModel.getState().loadRepo(scan)
  } catch (error) {
    reportError('abrir o repositório', error)
  }
}

export async function openLastRepo(): Promise<void> {
  try {
    const scan = await window.api.lastRepo()
    if (scan) useModel.getState().loadRepo(scan)
  } catch {
    // Sem repositório anterior: o app mostra a tela inicial
  }
}

/** Relê a pasta do disco (ex.: depois de um git pull). */
export async function reloadRepo(): Promise<void> {
  const { root } = useModel.getState()
  if (!root || !confirmDiscard()) return
  const { openDiagrams, activeDiagram } = useModel.getState()
  try {
    useModel.getState().loadRepo(await window.api.scanRepo(root))
    // Mantém as abas que ainda existem
    const { diagrams } = useModel.getState()
    const stillOpen = openDiagrams.filter((p) => p in diagrams)
    if (stillOpen.length) {
      useModel.setState({
        openDiagrams: stillOpen,
        activeDiagram: activeDiagram && activeDiagram in diagrams ? activeDiagram : stillOpen[0]
      })
    }
  } catch (error) {
    reportError('recarregar o repositório', error)
  }
}

/** Único caminho que grava em disco: tudo que mudou desde a última leitura/gravação. */
export async function saveRepo(): Promise<void> {
  const state = useModel.getState()
  if (!state.root) return
  const { files, paths } = computeFiles(state)
  const changes = diffRepo(state.snapshot, files, state.dirs)
  // Desenho copiado do modelo e não editado: grava o texto original (cópia exata, mesma formatação)
  for (const write of changes.writes) {
    const original = state.templateOriginals[write.path]
    if (original !== undefined && sameJson(original, write.content)) write.content = original
  }
  // Cópias de pasta modelo ainda não gravadas: vão como estão (binário em base64)
  for (const [path, base64] of Object.entries(state.pendingFiles)) {
    if (state.otherFiles.includes(path)) changes.writes.push({ path, content: base64, encoding: 'base64' })
  }
  try {
    await window.api.writeRepo(state.root, changes)
    state.markSaved(files, paths)
  } catch (error) {
    reportError('salvar', error)
  }
}
