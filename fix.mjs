import { stat, symlink } from 'node:fs/promises'

if (process.platform === 'darwin') {
  // fix *.dylib not found on macOS
  const path = 'node_modules/@u4/opencv-build/opencv'
  await stat(path).catch(() => symlink('dist/latest', path))
}
