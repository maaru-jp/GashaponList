/**
 * Cloudinary 無簽章上傳（需在 Cloudinary 建立 Upload preset，並允許 folder）
 */
;(() => {
  const C = () => window.GACHA_CONFIG || {}

  async function uploadImage(file) {
    const name = C().cloudinaryCloudName
    const preset = C().cloudinaryUploadPreset
    if (!name || !preset) throw new Error("請在 config.js 設定 cloudinaryCloudName 與 cloudinaryUploadPreset")

    const fd = new FormData()
    fd.append("file", file)
    fd.append("upload_preset", preset)
    const folder = C().cloudinaryFolder
    if (folder) fd.append("folder", folder)

    const url = `https://api.cloudinary.com/v1_1/${name}/image/upload`
    const r = await fetch(url, { method: "POST", body: fd })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = j.error && j.error.message ? j.error.message : r.statusText
      throw new Error(msg || "Cloudinary 上傳失敗")
    }
    return j.secure_url || j.url || ""
  }

  window.GachaCloudinary = { uploadImage }
})()
