import { useState } from 'react'
import { uploadStorePictures, removeStorePictureUrl } from '../../lib/storeUpload'

// Shared bits for the store admin forms: a popup shell and a
// multi-picture uploader (1, 3 or more pictures per record).
export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function PicField({ pics, setPics }) {
  const [uploading, setUploading] = useState(false)
  const upload = async (e) => {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await uploadStorePictures(files)
      setPics([...pics, ...urls])
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(false)
  }
  return (
    <div>
      <label className="upload-btn">
        {uploading ? 'Uploading...' : '📷 Upload pictures'}
        <input type="file" accept="image/*" multiple hidden onChange={upload} disabled={uploading} />
      </label>
      {pics.length > 0 && (
        <div className="pic-list">
          {pics.map((u, i) => (
            <span key={i}>{u.split('/').pop()}
              <button type="button" className="btn-mini" onClick={() => { removeStorePictureUrl(u); setPics(pics.filter((_, j) => j !== i)) }}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
