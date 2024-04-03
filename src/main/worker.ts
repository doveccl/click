import { each } from 'lodash'
import { path } from 'ghost-cursor'
import { parentPort } from 'node:worker_threads'
import { matchWithScale, releaseMat } from './image'
import { DEFAULT_DELAY, DEFAULT_THRESHOLD } from '../const'
import {
  Image,
  Region,
  getActiveWindow,
  imageResource,
  imageToJimp,
  mouse,
  randomPointIn,
  screen
} from '@nut-tree/nut-js'

let key = ''
let profiles: Record<string, TMatcher[]> = {}
let window = true
let fast = 1

let running = false
let counts: number[] = []
let images: Record<string, Image> = {}

function send(type: string, value?: unknown) {
  parentPort?.postMessage({ type, value })
}

async function getImage(f = '') {
  if (images[f]) return images[f]
  return (images[f] = await imageResource(f))
}

function scale(r: Region, s = 1) {
  const x = r.left - (r.width * (s - 1)) / 2
  const y = r.top - (r.height * (s - 1)) / 2
  const [w, h] = [r.width * s, r.height * s]
  return new Region(x, y, w, h)
}

async function randPoint(r: Region, c = 3) {
  let sumx = 0
  let sumy = 0
  for (let i = 0; i < c; i++) {
    const p = await randomPointIn(r)
    sumx += p.x
    sumy += p.y
  }
  return { x: sumx / c, y: sumy / c }
}

async function click({ x = 0, y = 0, w = 0, h = 0, ratio = 1, count = 1 }, d = new Region(0, 0, 0, 0)) {
  const r = scale(new Region(x, y, w, h), ratio)
  const p = await randPoint(r)
  send('click', { ...r, ...p })
  const from = await mouse.getPosition()
  const to = { x: p.x + d.left, y: p.y + d.top }
  await mouse.move(path(from, to, { moveSpeed: 4 }))
  while (count--) await mouse.leftClick()
}

async function doMatch() {
  let win: Region | undefined
  if (window) {
    win = await (await getActiveWindow()).region
    if (!win.width || !win.height) return
  }
  const i = win ? await screen.grabRegion(win) : await screen.grab()
  const { scaleX, scaleY } = i.pixelDensity
  send('screen', imageToJimp(i).resize(i.width / scaleX, i.height / scaleY).bitmap)

  let match: TMatcher | undefined
  for (const m of profiles[key]) {
    if (m.max && counts[m.id] >= m.max) continue
    send('check', m)
    const t = await getImage(m.image)
    const r = await matchWithScale(i, t, fast)
    send('result', { ...m, ...r })
    if (!running) break
    if (r.v > (m.threshold ?? DEFAULT_THRESHOLD)) {
      match = m
      send('rect', r)
      counts[m.id] = (counts[m.id] ?? 0) + 1
      if (m.max && counts[m.id] >= m.max) send('max', m)
      if (m.action === 'click') await click({ ...r, ...m }, win)
      break
    }
  }

  releaseMat(i)
  return match
}

async function loop() {
  try {
    const res = await doMatch()
    if (res?.action === 'stop') return stop()
    await new Promise(r => setTimeout(r, 1e3 * (res?.delay ?? DEFAULT_DELAY)))
    if (!running) return
    if (res?.action === 'jump') return start(res.to!)
    if (res?.action === 'reset') return start(key)
    setTimeout(loop)
  } catch (e) {
    stop(e)
  }
}

function start(k: string, p = profiles, w = window, f = fast) {
  if (k in p && p[k].length) {
    counts = []
    profiles = p
    window = w
    fast = f
    send('started', (key = k))
    running = !!loop() // true
  } else {
    stop(`Invalid profile "${k}"`)
  }
}

function stop(err?: unknown) {
  running = false
  each(images, releaseMat)
  send('stopped', err)
}

parentPort?.on('message', m => {
  if (m === 'stop') stop()
  else if (m.BASE) screen.config.resourceDirectory = m.BASE
  else if (typeof m[0] === 'string') start(...(m as ['']))
})
