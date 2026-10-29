/**
 * Gera os ícones do app a partir de `resources/icon.svg`:
 * - `resources/icon.png` (1024 px): janela e Dock, usado pelo processo principal;
 * - `build/icon.icns` (macOS) e `build/icon.ico` (Windows), para empacotar.
 * Rode com `npm run icon` depois de mudar o SVG. Usa o próprio Electron para desenhar o SVG.
 */
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('child_process')
const { mkdirSync, readFileSync, rmSync, writeFileSync } = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SVG = readFileSync(path.join(ROOT, 'resources/icon.svg'), 'utf-8')

/** Desenha o SVG em `size` × `size` com fundo transparente e devolve o PNG. */
async function render(win, size) {
  win.setContentSize(size, size)
  const html = `<html><body style="margin:0;background:transparent">
    <img src="data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}" width="${size}" height="${size}" style="display:block"></body></html>`
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await new Promise((done) => setTimeout(done, 150))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  return image.resize({ width: size, height: size, quality: 'best' }).toPNG()
}

/** ICO com as imagens em PNG (aceito desde o Windows Vista). */
function ico(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = 6 + 16 * pngs.length
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  const png = {}
  for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) png[size] = await render(win, size)

  mkdirSync(path.join(ROOT, 'build'), { recursive: true })
  writeFileSync(path.join(ROOT, 'resources/icon.png'), png[1024])

  // macOS: pasta .iconset → .icns
  const iconset = path.join(ROOT, 'build/icon.iconset')
  rmSync(iconset, { recursive: true, force: true })
  mkdirSync(iconset)
  for (const size of [16, 32, 128, 256, 512]) {
    writeFileSync(path.join(iconset, `icon_${size}x${size}.png`), png[size])
    writeFileSync(path.join(iconset, `icon_${size}x${size}@2x.png`), png[size * 2])
  }
  if (process.platform === 'darwin') {
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(ROOT, 'build/icon.icns')])
  }
  rmSync(iconset, { recursive: true, force: true })

  writeFileSync(
    path.join(ROOT, 'build/icon.ico'),
    ico([16, 32, 48, 64, 128, 256].map((size) => ({ size, data: png[size] })))
  )
  console.log('Ícones gerados: resources/icon.png, build/icon.icns, build/icon.ico')
  app.quit()
})
