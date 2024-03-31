import Jimp from 'jimp'
import { each, random } from 'lodash'
import { fileURLToPath } from 'node:url'
import { parentPort } from 'node:worker_threads'
import { imageToJimp, mouse, screen } from '@nut-tree/nut-js'
import { matchTmpl, releaseMat, resizeOnce } from './image'
import { DEFAULT_DELAY, DEFAULT_THRESHOLD } from '../const'

function send(type: string, value?: unknown) {
  parentPort?.postMessage({ type, value })
}

function trand(min = -1, max = 1) {
  return (random(min, max, true) + random(min, max, true)) / 2
}

let key = ''
let counts: number[] = []
let images: Record<string, Jimp> = {}
let profiles: Record<string, TMatcher[]> = {}
let timer: ReturnType<typeof setTimeout> | null = null

let sr = 1 // screen.width / resized_screenshot.width

async function getImage(f = '') {
  if (images[f]) return images[f]
  return (images[f] = await Jimp.read(fileURLToPath(f)))
}

async function click(x = 0, y = 0, w = 0, h = 0, { ratio = 1, count = 1 }) {
  send('rect', { x, y, w, h })
  x -= (w * (ratio - 1)) / 2
  y -= (h * (ratio - 1)) / 2
  w *= ratio
  h *= ratio
  const cx = trand(x, x + w)
  const cy = trand(y, y + h)
  send('click', { x, y, w, h, cx, cy })
  await mouse.move([{ x: sr * cx, y: sr * cy }])
  while (count--) await mouse.leftClick()
}

async function doMatch() {
  let rr = 1 // resize screenshot scale ratio
  const sc = imageToJimp(await screen.grab())
  while (rr * sc.getWidth() > 1e3) rr /= 2
  resizeOnce(sc, rr * sc.getWidth())
  sr = (await screen.width()) / sc.getWidth()
  send('screen', sc.bitmap)

  let match: TMatcher | undefined
  for (const m of profiles[key]) {
    if (m.max && counts[m.id] >= m.max) continue
    send('check', m)
    const t = await getImage(m.image)
    resizeOnce(t, rr * t.getWidth())
    const r = await matchTmpl(sc, t)
    send('result', { ...m, ...r })
    if (!timer) break
    if (r.v > (m.threshold ?? DEFAULT_THRESHOLD)) {
      match = m
      counts[m.id] = (counts[m.id] ?? 0) + 1
      if (m.max && counts[m.id] >= m.max) send('max', m)
      if (m.action === 'click') await click(r.x, r.y, t.getWidth(), t.getHeight(), m)
      break
    }
  }

  setTimeout(() => releaseMat(sc))
  return match
}

async function loop() {
  try {
    const res = await doMatch()
    if (res?.action === 'stop') return stop()
    await new Promise(r => setTimeout(r, 1e3 * (res?.delay ?? DEFAULT_DELAY)))
    if (!timer) return
    if (res?.action === 'jump') return start(res.to!)
    if (res?.action === 'reset') return start(key)
    timer = setTimeout(loop)
  } catch (e) {
    stop(e)
  }
}

function start(k: string, p = profiles) {
  if (k in p && p[k].length) {
    counts = []
    profiles = p
    send('started', (key = k))
    timer = setTimeout(loop)
  } else {
    stop(`Invalid profile "${k}"`)
  }
}

function stop(err?: unknown) {
  if (timer) clearTimeout(timer), (timer = null)
  each(images, releaseMat)
  send('stopped', err)
}

parentPort?.on('message', m => (m === 'stop' ? stop() : start(...(m as ['']))))
