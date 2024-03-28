import Image from './image'
import workerPath from './worker?modulePath'
import { once } from 'node:events'
import { Worker } from 'node:worker_threads'
import { app, globalShortcut, ipcMain } from 'electron'

const worker = new Worker(workerPath)
const waitFor = async (type: unknown) => {
  while (true) {
    const [r] = await once(worker, 'message')
    if (r.type === type) return r.value
  }
}

ipcMain.handle('save', async (_, buf: Buffer) => {
  return await (await Image.decode(buf)).toFileURL()
})

ipcMain.handle('start', async (_, ...args) => {
  worker.postMessage(args)
  return await waitFor('started')
})

ipcMain.handle('stop', async () => {
  worker.postMessage('stop')
  return await waitFor('stopped')
})

app.whenReady().then(() => {
  globalShortcut.register('Alt+CommandOrControl+T', () => worker.postMessage('stop'))
})

export default worker
