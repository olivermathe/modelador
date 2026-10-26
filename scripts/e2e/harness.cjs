/**
 * Harness de teste end-to-end: roda o app real (out/main) no Electron, sem
 * mostrar janela, sobre uma CÓPIA temporária de exemplo-repositorio/.
 *
 * Uso (depois de `npm run build`):
 *   electron scripts/e2e/<teste>.cjs
 *
 * Cada teste chama `run(async (t) => { ... })` e usa os helpers de `t`.
 * O processo sai com código 1 se algum `t.assert` falhar ou houver erro no console.
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, utimesSync } = require('fs')
const { tmpdir } = require('os')
const path = require('path')

const PROJECT = path.resolve(__dirname, '../..')
const WORK = mkdtempSync(path.join(tmpdir(), 'modelador-e2e-'))
const REPO = path.join(WORK, 'repo')
const SHOTS = path.join(WORK, 'shots')

// Repositório de teste + app abrindo nele (via "último repositório usado")
cpSync(path.join(PROJECT, 'exemplo-repositorio'), REPO, { recursive: true })
mkdirSync(SHOTS)
app.setPath('userData', path.join(WORK, 'userData'))
mkdirSync(app.getPath('userData'), { recursive: true })
writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify({ lastRepo: REPO }))

/** Data antiga em todos os arquivos, para detectar o que foi regravado. */
const OLD = new Date('2020-01-01T00:00:00Z')
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}
function markAllOld() {
  for (const file of walk(REPO)) utimesSync(file, OLD, OLD)
}

require(path.join(PROJECT, 'out/main/index.js'))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Cópia do repositório usada no teste (dá para mexer nela antes do app abrir). */
module.exports.REPO = REPO

module.exports.run = (test) => {
  const failures = []
  setTimeout(() => {
    console.error('TIMEOUT')
    app.exit(1)
  }, 90_000)

  app.whenReady().then(async () => {
    await wait(2500)
    const win = BrowserWindow.getAllWindows()[0]
    const consoleErrors = []
    win.webContents.on('console-message', (_e, level, msg) => {
      if (level >= 2) consoleErrors.push(msg)
    })

    // Exportar imagem sem abrir diálogo: grava em SHOTS/export.jpg
    ipcMain.removeHandler('export:image')
    ipcMain.handle('export:image', (_e, dataUrl) => {
      const file = path.join(SHOTS, 'export.jpg')
      writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
      return file
    })

    const js = (code) => win.webContents.executeJavaScript(code)
    // alert/confirm do renderer não podem bloquear o teste: confirm sempre "sim"
    await js(`
      window.__dialogs = [];
      window.alert = (m) => window.__dialogs.push(String(m));
      window.confirm = (m) => { window.__dialogs.push('confirm: ' + m); return true };
      window.$type = (el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      window.$blur = (el) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      window.$row = (text) => [...document.querySelectorAll('aside span')].find((s) => s.textContent === text);
      window.$save = () => document.querySelector('[title^="Salvar alterações"]').click();
      0`)

    const t = {
      repo: REPO,
      shots: SHOTS,
      js,
      wait,
      step: (label) => console.log(`> ${label}`),
      assert: (ok, message) => {
        console.log(`  ${ok ? 'ok ' : 'FALHOU'} ${message}`)
        if (!ok) failures.push(message)
      },
      shot: async (name) => {
        const file = path.join(SHOTS, name)
        writeFileSync(file, (await win.webContents.capturePage()).toPNG())
        return file
      },
      markAllOld,
      /** Arquivos do repositório alterados desde o último markAllOld(). */
      changedFiles: () =>
        walk(REPO)
          .filter((f) => statSync(f).mtimeMs > OLD.getTime())
          .map((f) => path.relative(REPO, f)),
      files: () => walk(REPO).map((f) => path.relative(REPO, f)).sort(),
      /** Dispara um item do menu nativo (open, save, undo, redo…), como o atalho faria. */
      menu: (action) => win.webContents.send('menu:action', action),
      /** Atalhos registrados no menu Editar. */
      editAccelerators: () =>
        require('electron')
          .Menu.getApplicationMenu()
          .items.find((i) => i.label === 'Editar')
          .submenu.items.map((i) => i.accelerator)
          .filter(Boolean),
      read: (rel) => readFileSync(path.join(REPO, rel), 'utf-8'),
      exists: (rel) => existsSync(path.join(REPO, rel))
    }

    try {
      await test(t)
    } catch (error) {
      failures.push(String(error && error.message))
      console.error('ERRO', error)
    }
    if (consoleErrors.length) failures.push(`erros no console: ${JSON.stringify(consoleErrors)}`)
    console.log(`\nArquivos do teste: ${WORK}`)
    console.log(failures.length ? `\n${failures.length} falha(s)` : '\nTudo certo')
    app.exit(failures.length ? 1 : 0)
  })
}
