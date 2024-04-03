import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'

export const BASE = join(app.getPath('userData'), 'images')

const server = createServer((req, res) => {
  const s = createReadStream(join(BASE, decodeURI(req.url!)))
  s.on('error', e => (res.writeHead(404), res.end(e.message)))
  s.pipe(res)
}).listen(0, '127.0.0.1')

ipcMain.handle('url', _ => {
  const addr = server.address()
  if (addr && typeof addr === 'object') return `http://127.0.0.1:${addr.port}`
  return pathToFileURL(BASE)
})

ipcMain.handle('save', async (_, ab: ArrayBuffer, name = `${Date.now()}`) => {
  const buf = Buffer.from(ab)
  if ((await stat(join(BASE, name)).catch(() => null))?.isFile())
    if (buf.compare(await readFile(join(BASE, name)))) name = `${Date.now()}-${name}`
  await mkdir(BASE, { recursive: true })
  await writeFile(join(BASE, name), buf)
  return name
})
