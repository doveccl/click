import { contextBridge, ipcRenderer } from 'electron'

// worker -> main -> preload -> renderer
ipcRenderer.on('', (_, m) => postMessage(m, '*'))

const api = {
  dev: () => ipcRenderer.invoke('dev'),
  url: () => ipcRenderer.invoke('url'),
  save: (i: unknown, n?: string) => ipcRenderer.invoke('save', i, n),
  start: (k: string, p: Record<string, TMatcher[]>, w = true, f = 1) => ipcRenderer.invoke('start', k, p, w, f),
  stop: () => ipcRenderer.invoke('stop')
}

contextBridge.exposeInMainWorld('api', api)

export default api
