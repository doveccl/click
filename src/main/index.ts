import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { app, BrowserWindow, globalShortcut, ipcMain, WebContents } from 'electron'
import workerPath from './worker?modulePath'

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    const ext = await import('electron-devtools-assembler')
    await ext.default(ext.VUEJS_DEVTOOLS)
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let sender: WebContents | undefined
const worker = new Worker(workerPath).on('message', d => sender?.send('', d))

app.whenReady().then(() => {
  createWindow()
  ipcMain.on('', (e, d) => ((sender = e.sender), worker.postMessage(d)))
  globalShortcut.register('Alt+CommandOrControl+T', () => worker.postMessage('stop'))
  app.on('activate', () => BrowserWindow.getAllWindows().length || createWindow())
  app.on('window-all-closed', () => process.platform === 'darwin' || app.quit())
})
