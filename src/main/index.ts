import bridge from './bridge'
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'

app.on('window-all-closed', app.quit)
app.whenReady().then(async () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    Menu.setApplicationMenu(null)
  }
  bridge.on('message', m => mainWindow.webContents.send('', m))
  ipcMain.handle('dev', () => mainWindow.webContents.openDevTools())
})
