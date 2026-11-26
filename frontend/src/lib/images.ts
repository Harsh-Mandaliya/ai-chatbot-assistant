/** Shrink a screenshot or photo before upload, so it's quick to send and easy for the model to read. */
const MAX_SIDE = 1800
const QUALITY = 0.88

export async function toDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} isn't an image.`)
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`Couldn't read ${file.name}.`))
      el.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser blocked image processing.')
    // White behind transparent PNGs, otherwise they turn black as JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', QUALITY)
  } finally {
    URL.revokeObjectURL(url)
  }
}
