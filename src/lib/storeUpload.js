import { supabase } from './supabaseClient'

// Shrink a picture in the browser before it is stored: a phone photo
// of 4000px+ becomes at most 1600px on its long edge, which keeps the
// slideshow sharp while cutting a multi-megabyte file down to a few
// hundred kilobytes. Photos become JPEG (quality 0.85); PNGs stay PNG
// (so screenshots and logos keep working). Pictures already small
// enough are left completely untouched, and anything that fails
// shrinks nothing — the original file is uploaded instead, so an
// upload can never break because of resizing. This runs on every
// future upload, in both admin upload paths.
export async function shrinkImage(file, maxEdge = 1600) {
  try {
    const img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const image = new Image()
      image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
      image.onerror = (err) => { URL.revokeObjectURL(url); reject(err) }
      image.src = url
    })
    const w0 = img.naturalWidth, h0 = img.naturalHeight
    if (!w0 || !h0 || Math.max(w0, h0) <= maxEdge) return file
    const scale = maxEdge / Math.max(w0, h0)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w0 * scale)
    canvas.height = Math.round(h0 * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise(res => canvas.toBlob(res, outType, 0.85))
    if (!blob) return file
    const name = outType === 'image/jpeg'
      ? file.name.replace(/\.[^.]+$/, '') + '.jpg'
      : file.name
    return new File([blob], name, { type: outType })
  } catch {
    return file
  }
}

// Upload pictures to the product-images storage bucket (same bucket the
// grocery admin already uses) and return their public URLs. Pictures are
// stored as URL lists on providers/items (pics text[]), so 1, 3 or more
// pictures per record are all fine.
export async function uploadStorePictures(files) {
  const urls = []
  for (const file of files) {
    const up = await shrinkImage(file)
    const safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `store/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
    const { error } = await supabase.storage.from('product-images').upload(path, up)
    if (error) throw error
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

export function removeStorePictureUrl(url) {
  const marker = '/storage/v1/object/public/product-images/'
  const i = url.indexOf(marker)
  if (i === -1) return
  const path = url.slice(i + marker.length)
  supabase.storage.from('product-images').remove([path]).catch(() => {})
}
