import { contextBridge, ipcRenderer } from 'electron'

// worker -> main -> preload -> renderer
ipcRenderer.on('', (_, m) => postMessage(m, '*'))

export const send = (m: unknown) => ipcRenderer.postMessage('', m)

// renderer -> preload -> main -> worker
contextBridge.exposeInMainWorld('send', send)
