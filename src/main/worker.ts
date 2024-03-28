import Image from './image'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { parentPort } from 'node:worker_threads'
import { mouse, screen } from '@nut-tree/nut-js'
import { each, random } from 'lodash'

function send(type: string, value?: unknown) {
  parentPort?.postMessage({ type, value })
}

function trand(min = -1, max = 1) {
  return (random(min, max, true) + random(min, max, true)) / 2
}

let key = ''
let delay = 500
let counts: number[] = []
let images: Record<string, Image> = {}
let profiles: Record<string, TMatcher[]> = {}
let timer: ReturnType<typeof setTimeout> | null = null

async function getImage(f = '') {
  if (images[f]) return images[f]
  const buf = await readFile(fileURLToPath(f))
  return (images[f] = await Image.decode(buf))
}

async function doMatch() {
  const sw = await screen.width()
  const sh = await screen.height()
  const { data, width } = await (await screen.grab()).toRGB()
  const sc = new Image(data, width)
  send('screen', sc)

  let ok = false
  let m: TMatcher = { id: 0 }
  for (m of profiles[key]) {
    if (m.max && counts[m.id] >= m.max) continue
    send('check', m)
    const t = await getImage(m.image)
    const r = await sc.find(t)
    send('result', { ...m, ...r })
    if (r.v > (m.threshold ?? 0.9)) {
      ok = true
      counts[m.id] = (counts[m.id] ?? 0) + 1
      if (m.max && counts[m.id] >= m.max) send('max', m)
      if (m.action && m.action !== 'click') break
      let [w, h] = [t.width / 2, t.height / 2]
      let [x, y] = [r.x + w, r.y + h]
      w *= m.ratio ?? 1
      h *= m.ratio ?? 1
      send('rect', { x, y, w, h })
      x = trand(x - w, x + w)
      y = trand(y - h, y + h)
      if (!timer) break
      send('click', { x, y })
      await mouse.move([{ x: (x * sw) / sc.width, y: (y * sh) / sc.height }])
      await mouse.leftClick()
      break
    }
  }

  sc.release()
  if (ok && m.action === 'stop') return stop(), false
  if (ok && m.action === 'jump') return start(profiles, m.to!), false
  return true
}

async function loop() {
  try {
    const next = await doMatch()
    if (timer && next) timer = setTimeout(loop, delay)
  } catch (e) {
    stop(e)
  }
}

async function start(p: typeof profiles, k: string, d = delay) {
  if (k in p && p[k].length) {
    counts = []
    profiles = p
    send('started', (key = k))
    timer = setTimeout(loop, (delay = d))
  } else {
    stop(`Invalid profile "${k}"`)
  }
}

function stop(err?: unknown) {
  if (timer) clearTimeout(timer), (timer = null)
  each(images, i => i.release())
  send('stopped', err)
}

parentPort?.on('message', m => (m === 'stop' ? stop() : start(...(m as [{}, '']))))
