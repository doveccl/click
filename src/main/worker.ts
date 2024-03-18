import cv, { type Mat } from '@u4/opencv4nodejs'
import { isArray, random } from 'lodash'
import { mouse, screen } from '@nut-tree/nut-js'
import { parentPort } from 'node:worker_threads'

const post = (m: unknown) => parentPort?.postMessage(m)

function trand(min = -1, max = 1) {
  return (random(min, max, true) + random(min, max, true)) / 2
}

let matchers: TMatcher[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function matchTemplate(i: Mat, t: Mat) {
  const res = i.matchTemplate(t, cv.TM_CCOEFF_NORMED)
  const loc = cv.minMaxLoc(res)
  return res.release(), loc
}

async function loop() {
  // 屏幕分辨率与截图大小可能不一致
  const sw = await screen.width()
  const sh = await screen.height()
  const img = await screen.grab()
  const _mat = new cv.Mat(img.data, img.height, img.width, cv.CV_8UC4)
  const mat = _mat.cvtColor(cv.COLOR_BGRA2BGR)
  _mat.release()

  let find = false
  for (const m of matchers) {
    if (timer === null) break
    const loc = matchTemplate(mat, m.mat!)
    post({ log: `匹配图像${m.desc ?? ''}相似度: ${loc.maxVal}` })
    if (loc.maxVal > (m.threshold ?? 0.8)) {
      find = true
      let [w, h] = [m.mat!.cols / 2, m.mat!.rows / 2]
      let [x, y] = [loc.maxLoc.x + w, loc.maxLoc.y + h]
      w *= m.ratio ?? 1
      h *= m.ratio ?? 1
      mat.drawRectangle(new cv.Rect(x - w, y - h, 2 * w, 2 * h), new cv.Vec3(255, 0, 0), 5)
      x = trand(x - w, x + w)
      y = trand(y - h, y + h)
      mat.drawCircle(new cv.Point2(x, y), 5, new cv.Vec3(255, 0, 0), -5)
      post({ img: cv.imencode('.jpg', mat) })
      post({ log: `鼠标点击位置 (${x}, ${y})` })
      await mouse.move([{ x: (x * sw) / mat.cols, y: (y * sh) / mat.rows }])
      await mouse.leftClick()
      break
    }
  }

  find || post({ log: '未匹配到相似图像' })
  mat.release()
  if (timer !== null) timer = setTimeout(loop, 500)
}

function stop() {
  if (timer !== null) clearTimeout(timer)
  timer = null
  while (matchers.length) matchers.pop()?.mat?.release()
  post('stopped')
}

function error(err = '未知错误') {
  post({ err })
  stop()
}

async function start(list: TMatcher[]) {
  try {
    for (const m of (matchers = list)) {
      m.img = m.img!.replace(/^[^,]+,/, '')
      m.mat = cv.imdecode(Buffer.from(m.img, 'base64'))
    }
    timer = setTimeout(loop)
    post('started')
  } catch (e) {
    error(`${e}`)
  }
}

parentPort?.on('message', m => {
  if (m === 'stop') stop()
  else if (isArray(m)) start(m)
})
