import { once } from 'node:events'
import { saveImage } from './image'
import { Worker } from 'node:worker_threads'
import { app, globalShortcut, ipcMain } from 'electron'
import workerPath from './worker?modulePath'

const worker = new Worker(workerPath)
const waitFor = async (type: unknown) => {
  while (true) {
    const [r] = await once(worker, 'message')
    if (r.type === type) return r.value
  }
}

ipcMain.handle('save', async (_, b: ArrayBuffer, n?: string) => {
  return await saveImage(b, n)
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
