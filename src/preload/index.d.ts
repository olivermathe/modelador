import type { RepoChanges, RepoScan } from '../renderer/src/model/types'

declare global {
  interface Window {
    api: {
      openRepo: () => Promise<RepoScan | null>
      lastRepo: () => Promise<RepoScan | null>
      scanRepo: (root: string) => Promise<RepoScan>
      writeRepo: (root: string, changes: RepoChanges) => Promise<void>
      exportImage: (dataUrl: string, defaultName: string) => Promise<string | null>
      pickTemplate: () => Promise<string | null>
      readImage: (root: string, path: string) => Promise<string | null>
      readTemplate: (folder: string) => Promise<{ files: { path: string; base64: string }[]; dirs: string[] }>
      setWindowState: (state: { dirty: boolean; root: string | null }) => void
      onMenuAction: (callback: (action: string) => void) => () => void
    }
  }
}

export {}
