import { join } from 'node:path'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { cp, readdir } from 'node:fs/promises'

const root = import.meta.dirname
const dist = join(root, 'node_modules/@u4/opencv-build/dist')

async function findOpenCV() {
  const list = await readdir(dist, { withFileTypes: true })
  return list.find(d => d.isDirectory() && d.name.startsWith('opencv-'))
}

if (!(await findOpenCV())) {
  const env = { ...process.env }
  if (process.platform === 'darwin') env.CXXFLAGS = '-std=c++17'
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const cp = spawn(npx, ['build-opencv', '--electron', '--nocontrib', 'rebuild'], { env, stdio: 'inherit' })
  await once(cp, 'exit')
}

const opencv = await findOpenCV()
if (opencv) {
  if (process.platform === 'win32') {
    const lib = join(dist, opencv.name, 'build/bin/Release')
    for (const d of await readdir(lib)) if (d.endsWith('.dll')) await cp(join(lib, d), d)
  } else if (process.platform === 'darwin') {
    const lib = join(dist, opencv.name, 'build/lib/Release')
    for (const d of await readdir(lib)) if (d.endsWith('.dylib')) await cp(join(lib, d), d)
  }
}
