import { contextBridge, ipcRenderer } from 'electron'

// worker -> main -> preload -> renderer
ipcRenderer.on('', (_, m) => postMessage(m, '*'))

const api = {
  save: (i: unknown) => ipcRenderer.invoke('save', i),
  start: (p: Record<string, TMatcher[]>, k: string, d?: number) => ipcRenderer.invoke('start', p, k, d),
  stop: () => ipcRenderer.invoke('stop')
}

contextBridge.exposeInMainWorld('api', api)

export default api
