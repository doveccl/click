import { Image } from '@nut-tree/nut-js'
import { CV_8UC4, Mat, TM_CCOEFF_NORMED, minMaxLocAsync } from '@u4/opencv4nodejs'

const mats = new WeakMap<Image, Mat>()
const sclaes = new WeakMap<Image, string>()

export function releaseMat(i: Image) {
  mats.get(i)?.release()
  mats.delete(i)
  sclaes.delete(i)
}

async function initMat(i: Image, sx = 1, sy = 1) {
  const sxy = [sx, sy].join(',')
  if (sclaes.get(i) === sxy) return
  releaseMat(i)
  sclaes.set(i, sxy)
  const [dw, dh] = [i.width / sx, i.height / sy].map(Math.round)
  const m = new Mat(i.data, i.height, i.width, CV_8UC4)
  mats.set(i, await m.resizeAsync(dh, dw))
  m.release()
}

export async function matchWithScale(i: Image, t: Image, fast = 1) {
  const { scaleX, scaleY } = i.pixelDensity
  await initMat(i, scaleX * fast, scaleY * fast)
  await initMat(t, scaleX * fast, scaleY * fast)
  const [w, h] = [t.width / scaleX, t.height / scaleY]
  const res = await mats.get(i)!.matchTemplateAsync(mats.get(t)!, TM_CCOEFF_NORMED)
  const { maxLoc, maxVal } = await minMaxLocAsync(res)
  return res.release(), { w, h, v: maxVal, ...maxLoc.mul(fast) }
}
