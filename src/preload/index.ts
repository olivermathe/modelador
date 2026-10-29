import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

interface RepoScan {
  root: string
  dirs: string[]
  files: { path: string; content: string }[]
  folders: Record<string, string>
}

const api = {
  openRepo: (): Promise<RepoScan | null> => ipcRenderer.invoke('repo:open'),
  lastRepo: (): Promise<RepoScan | null> => ipcRenderer.invoke('repo:last'),
  scanRepo: (root: string): Promise<RepoScan> => ipcRenderer.invoke('repo:scan', root),
  writeRepo: (root: string, changes: unknown): Promise<void> => ipcRenderer.invoke('repo:write', root, changes),
  exportImage: (dataUrl: string, defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('export:image', dataUrl, defaultName),
  readImage: (root: string, path: string): Promise<string | null> => ipcRenderer.invoke('repo:readImage', root, path),
  pickTemplate: (): Promise<string | null> => ipcRenderer.invoke('template:pick'),
  readTemplate: (folder: string): Promise<{ files: { path: string; base64: string }[]; dirs: string[] }> =>
    ipcRenderer.invoke('template:read', folder),
  setWindowState: (state: { dirty: boolean; root: string | null }): void => ipcRenderer.send('window:state', state),
  onMenuAction: (callback: (action: string) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, action: string): void => callback(action)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
