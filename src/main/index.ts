import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile } from 'fs/promises'
import { basename, dirname, join, relative, resolve } from 'path'

/** Pastas que formam um repositório do Modelador (nome canônico, usado pelo app). */
const REPO_FOLDERS = ['aplicações', 'tecnologias', 'relações', 'projetos']

/**
 * Nomes aceitos em disco para cada pasta, em português ou inglês (sem diferenciar maiúsculas e
 * acentos). A pasta fica com o nome que tem; o app só usa o canônico internamente.
 * Repositório novo é criado com o primeiro nome de cada lista.
 */
const FOLDER_ALIASES: Record<string, string[]> = {
  aplicações: ['aplicações', 'applications', 'application'],
  tecnologias: ['tecnologias', 'technologies', 'technology', 'tecnologies'],
  relações: ['relações', 'relacionamentos', 'relationships', 'relations'],
  projetos: ['projetos', 'projects']
}

/** Limite da pasta modelo (tudo é lido para a memória até o Salvar). */
const TEMPLATE_MAX_BYTES = 20 * 1024 * 1024

/** Logo do app (gerada de resources/icon.svg por `npm run icon`). */
const ICON = join(__dirname, '../../resources/icon.png')

// Sem empacotar, o macOS mostraria "Electron" no menu do app
app.setName('Modelador')

/** Imagens que o preview do Markdown pode mostrar (extensão → tipo). */
const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml'
}

/** Arquivos maiores que isso são listados, mas não lidos. */
const MAX_FILE_SIZE = 2 * 1024 * 1024

interface RepoScan {
  root: string
  dirs: string[]
  files: { path: string; content: string }[]
  /** Nome canônico → nome real da pasta em disco (ex.: "aplicações" → "applications"). */
  folders: Record<string, string>
}

interface RepoChanges {
  mkdirs: string[]
  moves: { from: string; to: string }[]
  /** `encoding: 'base64'` para arquivos binários (ex.: copiados de uma pasta modelo). */
  writes: { path: string; content: string; encoding?: 'base64' }[]
  deletes: string[]
  rmdirs: string[]
}

let mainWindow: BrowserWindow | null = null
let isDirty = false

// ---------------------------------------------------------------------------
// Repositório
// ---------------------------------------------------------------------------

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

async function readSettings(): Promise<{ lastRepo?: string }> {
  try {
    return JSON.parse(await readFile(settingsPath(), 'utf-8'))
  } catch {
    return {}
  }
}

async function writeSettings(settings: { lastRepo?: string }): Promise<void> {
  await writeFile(settingsPath(), JSON.stringify(settings, null, 2))
}

const nfc = (name: string): string => name.normalize('NFC')

/** Comparação de nomes de pasta: sem diferença de maiúsculas, acentos ou forma Unicode (NFC/NFD). */
const folderKey = (name: string): string =>
  nfc(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/** Para cada pasta do repositório: o nome canônico e o nome real em disco (português ou inglês). */
async function locateFolders(root: string): Promise<{ disk: string; key: string; missing: boolean }[]> {
  let entries: string[] = []
  try {
    entries = (await readdir(root, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    // pasta inexistente: tudo "missing"
  }
  return REPO_FOLDERS.map((folder) => {
    // Na ordem da lista: se existirem "projetos" e "projects", vale "projetos"
    for (const alias of FOLDER_ALIASES[folder]) {
      const disk = entries.find((e) => folderKey(e) === folderKey(alias))
      if (disk) return { disk, key: folder, missing: false }
    }
    return { disk: folder, key: folder, missing: true }
  })
}

/**
 * Resolve um caminho relativo (com a pasta raiz no nome canônico) para o caminho real em disco,
 * garantindo que fique dentro de uma das pastas do repositório.
 */
async function safePath(root: string, relPath: string): Promise<string> {
  const parts = relPath.split('/')
  const top = nfc(parts[0])
  if (!REPO_FOLDERS.map(nfc).includes(top) || parts.length < 2 || parts.includes('..')) {
    throw new Error(`Caminho fora do repositório: ${relPath}`)
  }
  parts[0] = (await locateFolders(root)).find((f) => nfc(f.key) === top)!.disk
  const full = resolve(root, ...parts)
  if (relative(root, full).startsWith('..')) throw new Error(`Caminho fora do repositório: ${relPath}`)
  return full
}

async function scanRepo(root: string): Promise<RepoScan> {
  const dirs: string[] = []
  const files: RepoScan['files'] = []

  // `diskDir`: caminho real; `keyDir`: caminho visto pelo app (pasta raiz com nome canônico)
  async function walk(diskDir: string, keyDir: string): Promise<void> {
    dirs.push(keyDir)
    const entries = await readdir(join(root, diskDir), { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const diskPath = `${diskDir}/${entry.name}`
      const keyPath = `${keyDir}/${entry.name}`
      if (entry.isDirectory()) {
        await walk(diskPath, keyPath)
      } else if (entry.isFile()) {
        const readable = entry.name.endsWith('.json') || entry.name.endsWith('.md')
        const content = readable ? await readFile(join(root, diskPath), 'utf-8') : ''
        files.push({ path: keyPath, content: content.length > MAX_FILE_SIZE ? '' : content })
      }
    }
  }

  const located = await locateFolders(root)
  for (const folder of located) {
    if (!folder.missing) await walk(folder.disk, folder.key)
  }
  return { root, dirs, files, folders: Object.fromEntries(located.map((f) => [f.key, f.disk])) }
}

/** Pasta vazia: pergunta se deve criar a estrutura. Pastas que faltarem são criadas ao salvar. */
async function ensureRepoStructure(root: string): Promise<boolean> {
  const folders = await locateFolders(root)
  if (folders.some((f) => !f.missing) || !mainWindow) return true
  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: 'question',
    buttons: ['Criar estrutura', 'Cancelar'],
    defaultId: 0,
    cancelId: 1,
    message: `"${basename(root)}" ainda não é um repositório do Modelador.`,
    detail: `Criar as pastas ${REPO_FOLDERS.join(', ')}?`
  })
  if (choice === 1) return false
  for (const folder of REPO_FOLDERS) await mkdir(join(root, folder), { recursive: true })
  return true
}

// ---------------------------------------------------------------------------
// Janela e menu
// ---------------------------------------------------------------------------

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Modelador',
    icon: ICON,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Pergunta antes de fechar com alterações não salvas
  mainWindow.on('close', (event) => {
    if (!isDirty || !mainWindow) return
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Descartar alterações', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      message: 'Existem alterações não salvas.',
      detail: 'Se fechar agora, as alterações serão perdidas.'
    })
    if (choice === 1) event.preventDefault()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function sendMenuAction(action: string): void {
  mainWindow?.webContents.send('menu:action', action)
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Abrir repositório…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open') },
        { label: 'Recarregar repositório', click: () => sendMenuAction('reload') },
        { type: 'separator' },
        { label: 'Salvar', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save') },
        { label: 'Exportar desenho como JPEG…', accelerator: 'CmdOrCtrl+E', click: () => sendMenuAction('exportJpeg') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      // Desfazer/Refazer vão para o app: no desenho desfazem o modelo, num campo de texto desfazem a digitação
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', click: () => sendMenuAction('undo') },
        {
          label: 'Refazer',
          accelerator: isMac ? 'Shift+CmdOrCtrl+Z' : 'Ctrl+Y',
          click: () => sendMenuAction('redo')
        },
        // Atalhos alternativos, sem aparecer no menu: Ctrl+Z também no Mac; Ctrl+Shift+Z também no Windows
        ...(isMac
          ? [
              { label: 'Desfazer (Ctrl)', accelerator: 'Ctrl+Z', visible: false, click: () => sendMenuAction('undo') },
              { label: 'Refazer (Ctrl)', accelerator: 'Ctrl+Shift+Z', visible: false, click: () => sendMenuAction('redo') }
            ]
          : [{ label: 'Refazer (Shift)', accelerator: 'Ctrl+Shift+Z', visible: false, click: () => sendMenuAction('redo') }]),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerIpc(): void {
  ipcMain.handle('repo:open', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Abrir repositório',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const root = result.filePaths[0]
    if (!(await ensureRepoStructure(root))) return null
    await writeSettings({ ...(await readSettings()), lastRepo: root })
    return scanRepo(root)
  })

  ipcMain.handle('repo:last', async () => {
    const { lastRepo } = await readSettings()
    if (!lastRepo || !existsSync(lastRepo)) return null
    if ((await locateFolders(lastRepo)).every((f) => f.missing)) return null
    return scanRepo(lastRepo)
  })

  ipcMain.handle('repo:scan', (_event, root: string) => scanRepo(root))

  // Único ponto que grava em disco: chamado só quando o usuário clica em Salvar
  ipcMain.handle('repo:write', async (_event, root: string, changes: RepoChanges) => {
    const ignoreMissing = (error: NodeJS.ErrnoException): void => {
      if (error.code !== 'ENOENT') throw error
    }
    for (const { from, to } of changes.moves) {
      const source = await safePath(root, from)
      const target = await safePath(root, to)
      await mkdir(dirname(target), { recursive: true })
      await rename(source, target)
    }
    for (const path of changes.mkdirs) {
      await mkdir(await safePath(root, path), { recursive: true })
    }
    for (const { path, content, encoding } of changes.writes) {
      const full = await safePath(root, path)
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, encoding === 'base64' ? Buffer.from(content, 'base64') : content, encoding ? undefined : 'utf-8')
    }
    for (const path of changes.deletes) {
      await unlink(await safePath(root, path)).catch(ignoreMissing)
    }
    // Mais profundas primeiro
    for (const path of [...changes.rmdirs].sort((a, b) => b.length - a.length)) {
      await rm(await safePath(root, path), { recursive: true }).catch(ignoreMissing)
    }
  })

  // Exportar é uma ação explícita do usuário: grava onde ele escolher, fora do repositório se quiser
  // Pasta modelo da "Nova feature": escolher e ler (só leitura; a cópia é gravada no Salvar)
  ipcMain.handle('template:pick', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Escolher pasta modelo',
      properties: ['openDirectory']
    })
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  // Imagem referenciada num Markdown (só leitura, só imagens, só dentro do repositório)
  ipcMain.handle('repo:readImage', async (_event, root: string, relPath: string) => {
    const type = IMAGE_TYPES[relPath.split('.').pop()?.toLowerCase() ?? '']
    if (!type) return null
    try {
      const data = await readFile(await safePath(root, relPath))
      if (data.length > TEMPLATE_MAX_BYTES) return null
      return `data:${type};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('template:read', async (_event, folder: string) => {
    const files: { path: string; base64: string }[] = []
    const dirs: string[] = []
    let total = 0
    async function walk(rel: string): Promise<void> {
      const entries = await readdir(join(folder, rel), { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === '.DS_Store') continue
        const relPath = rel ? `${rel}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          dirs.push(relPath)
          await walk(relPath)
        } else if (entry.isFile()) {
          const data = await readFile(join(folder, relPath))
          total += data.length
          if (total > TEMPLATE_MAX_BYTES) throw new Error('A pasta modelo passa de 20 MB.')
          files.push({ path: relPath, base64: data.toString('base64') })
        }
      }
    }
    await walk('')
    return { files, dirs }
  })

  ipcMain.handle('export:image', async (_event, dataUrl: string, defaultName: string) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar desenho',
      defaultPath: defaultName,
      filters: [{ name: 'Imagem JPEG', extensions: ['jpg', 'jpeg'] }]
    })
    if (result.canceled || !result.filePath) return null
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    await writeFile(result.filePath, Buffer.from(base64, 'base64'))
    return result.filePath
  })

  ipcMain.on('window:state', (_event, state: { dirty: boolean; root: string | null }) => {
    isDirty = state.dirty
    if (!mainWindow) return
    const name = state.root ? basename(state.root) : 'Nenhum repositório'
    mainWindow.setTitle(`${state.dirty ? '• ' : ''}${name} — Modelador`)
    mainWindow.setDocumentEdited(state.dirty)
    if (state.root) mainWindow.setRepresentedFilename(state.root)
  })
}

app.whenReady().then(() => {
  // Ícone do Dock (empacotado, vem do .icns; aqui substitui o do Electron em desenvolvimento)
  if (process.platform === 'darwin') app.dock?.setIcon(ICON)
  buildMenu()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
