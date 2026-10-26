import { supabase } from './supabaseClient'

// Upload pictures to the product-images storage bucket (same bucket the
// grocery admin already uses) and return their public URLs. Pictures are
// stored as URL lists on providers/items (pics text[]), so 1, 3 or more
// pictures per record are all fine.
export async function uploadStorePictures(files) {
  const urls = []
  for (const file of files) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `store/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
    const { error } = await supabase.storage.from('product-images').upload(path, file)
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
