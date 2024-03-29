import Jimp from 'jimp'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

type TCVCC = typeof import('@u4/opencv4nodejs')
type TCVJS = typeof import('@techstark/opencv-js')

let cvcc: TCVCC | null = null
let cvjs: TCVJS | null = null

async function initCV() {
  if (cvcc || cvjs) return
  try {
    // throw 'disable native for test'
    cvcc = (await import('@u4/opencv4nodejs')).default
  } catch (e) {
    console.warn('init native cv:', e)
    cvjs = (await import('@techstark/opencv-js')).default
    while (!cvjs.Mat) await new Promise(r => setTimeout(r, 100))
  }
}

export default class Image {
  readonly data: Buffer
  readonly width: number
  readonly height: number

  private matcc: InstanceType<TCVCC['Mat']> | null = null
  private matjs: InstanceType<TCVJS['Mat']> | null = null

  private async initMat() {
    if (this.matcc || this.matjs) return
    await initCV()
    if (cvcc) this.matcc = new cvcc.Mat(this.data, this.height, this.width, cvcc.CV_8UC4)
    if (cvjs) this.matjs = cvjs.matFromImageData(this)
  }

  constructor(rgba: Buffer, w: number, h?: number) {
    this.data = rgba
    this.width = w
    this.height = h ?? rgba.length / w / 4
  }

  static async decode(img: Buffer) {
    const { bitmap } = await Jimp.read(img)
    return new Image(bitmap.data, bitmap.width, bitmap.height)
  }

  async toFileURL() {
    const i = new Jimp(this)
    const { app } = await import('electron')
    const name = `${Date.now()}.${i.getExtension()}`
    const path = join(app.getPath('userData'), 'images', name)
    return await i.writeAsync(path), pathToFileURL(path).href
  }

  async find(tmpl: Image) {
    await this.initMat()
    await tmpl.initMat()
    if (cvcc) {
      const res = await this.matcc!.matchTemplateAsync(tmpl.matcc!, cvcc.TM_CCOEFF_NORMED)
      const { maxLoc, maxVal } = await cvcc.minMaxLocAsync(res)
      return res.release(), { ...maxLoc, v: maxVal }
    } else if (cvjs) {
      const res = new cvjs.Mat()
      cvjs.matchTemplate(this.matjs!, tmpl.matjs!, res, cvjs.TM_CCOEFF_NORMED)
      // @ts-ignore
      const { maxLoc, maxVal } = cvjs.minMaxLoc(res)
      return res.delete(), { ...maxLoc, v: maxVal }
    } else {
      throw 'cv init fail'
    }
  }

  release() {
    this.matcc?.release()
    this.matjs?.delete()
    this.matcc = this.matjs = null
  }
}
