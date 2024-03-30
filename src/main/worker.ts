import Jimp from 'jimp'
import { each, random } from 'lodash'
import { fileURLToPath } from 'node:url'
import { parentPort } from 'node:worker_threads'
import { imageToJimp, mouse, screen } from '@nut-tree/nut-js'
import { matchTmpl, releaseMat, resizeOnce } from './image'

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

async function getImage(f = '') {
  if (images[f]) return images[f]
  return await Jimp.read(fileURLToPath(f))
}

async function click(x = 0, y = 0, w = 0, h = 0, r = 1) {
  send('rect', { x, y, w, h })
  x -= (w * (r - 1)) / 2
  y -= (h * (r - 1)) / 2
  w *= r
  h *= r
  const cx = trand(x, x + w)
  const cy = trand(y, y + h)
  send('click', { x, y, w, h, cx, cy })
  await mouse.move([{ x: cx, y: cy }])
  await mouse.leftClick()
}

async function doMatch() {
  const sw = await screen.width()
  const sc = imageToJimp(await screen.grab())
  const sr = sw / sc.getWidth()
  resizeOnce(sc, sw)
  send('screen', sc.bitmap)

  let match: TMatcher | undefined
  for (const m of profiles[key]) {
    if (m.max && counts[m.id] >= m.max) continue
    send('check', m)
    const t = await getImage(m.image)
    resizeOnce(t, sr * t.getWidth())
    const r = await matchTmpl(sc, t)
    send('result', { ...m, ...r })
    if (r.v > (m.threshold ?? 0.95)) {
      match = m
      counts[m.id] = (counts[m.id] ?? 0) + 1
      if (m.max && counts[m.id] >= m.max) send('max', m)
      if (m.action === 'click') await click(r.x, r.y, t.getWidth(), t.getHeight(), m.ratio)
      break
    }
  }

  return releaseMat(sc), match
}

async function loop() {
  try {
    const res = await doMatch()
    if (res?.action === 'stop') stop()
    else if (res?.action === 'jump') start(res.to!)
    else if (timer) timer = setTimeout(loop, 1e3 * (res?.delay ?? 0.5))
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
