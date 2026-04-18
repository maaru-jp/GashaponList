/**
 * Google 試算表：以「匯出 CSV」讀取（須將試算表設為知道連結者可檢視，或改用 Apps Script / CORS Proxy）
 * 分頁1：商品名稱、規格、日幣金額、圖片網址（選填）
 * 分頁2：設定匯率（見 parseRateFromSettings）
 */
;(() => {
  const C = () => window.GACHA_CONFIG || {}

  let _cache = { products: null, rate: null, at: 0 }

  function ttlMs() {
    const n = Number(C().sheetCacheTtlSec)
    return (Number.isFinite(n) && n > 0 ? n : 60) * 1000
  }

  function buildUrlFromIdGid(sheetId, gid) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  }

  function resolveUrl(kind) {
    const cfg = C()
    if (kind === "products" && cfg.sheetCsvUrlProducts) return cfg.sheetCsvUrlProducts
    if (kind === "settings" && cfg.sheetCsvUrlSettings) return cfg.sheetCsvUrlSettings
    const id = cfg.googleSheetId
    if (!id) return ""
    if (kind === "products") return buildUrlFromIdGid(id, cfg.gidProducts || "0")
    if (kind === "settings") {
      const g = cfg.gidSettings
      if (g === "" || g == null) return ""
      return buildUrlFromIdGid(id, g)
    }
    return ""
  }

  function withProxy(url) {
    const p = C().sheetCorsProxy
    if (!p || !url) return url
    return p + encodeURIComponent(url)
  }

  async function fetchText(url) {
    if (!url) throw new Error("缺少試算表網址或 googleSheetId / gid")
    const u = withProxy(url)
    const r = await fetch(u, { credentials: "omit" })
    if (!r.ok) throw new Error("讀取失敗 HTTP " + r.status)
    return await r.text()
  }

  /** 簡易 CSV 解析（支援引號與逗號） */
  function parseCsv(text) {
    const rows = []
    let i = 0
    let cur = ""
    let row = []
    let inQ = false
    const s = text.replace(/^\uFEFF/, "")
    while (i < s.length) {
      const c = s[i]
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') {
            cur += '"'
            i += 2
            continue
          }
          inQ = false
          i++
          continue
        }
        cur += c
        i++
        continue
      }
      if (c === '"') {
        inQ = true
        i++
        continue
      }
      if (c === ",") {
        row.push(cur)
        cur = ""
        i++
        continue
      }
      if (c === "\r") {
        i++
        continue
      }
      if (c === "\n") {
        row.push(cur)
        rows.push(row)
        row = []
        cur = ""
        i++
        continue
      }
      cur += c
      i++
    }
    row.push(cur)
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row)
    return rows
  }

  function norm(s) {
    return String(s || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
  }

  function findColIndex(headers, candidates) {
    const h = headers.map((x) => norm(x))
    for (let i = 0; i < h.length; i++) {
      for (const c of candidates) {
        if (h[i] === norm(c) || h[i].includes(norm(c))) return i
      }
    }
    return -1
  }

  function parseNum(v) {
    const n = parseFloat(String(v).replace(/[,，]/g, "").replace(/[^\d.\-]/g, ""))
    return Number.isFinite(n) ? n : 0
  }

  /** 第二分頁：支援 (項目,數值) 列中「匯率」；或第一列即 key,value */
  function parseRateFromSettings(rows) {
    if (!rows || !rows.length) return 0.21
    const header = rows[0].map(norm)
    let keyIdx = header.findIndex((x) => x.includes("項目") || x.includes("key") || x === "設定")
    let valIdx = header.findIndex((x) => x.includes("數值") || x.includes("value") || x.includes("內容"))
    if (keyIdx < 0) keyIdx = 0
    if (valIdx < 0) valIdx = 1
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      const k = norm(row[keyIdx] || "")
      const v = row[valIdx]
      if (k.includes("匯率") || k === "rate" || k.includes("rate")) {
        const n = parseNum(v)
        if (n > 0) return n
      }
    }
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < (rows[r].length || 0) - 1; c++) {
        const k = norm(rows[r][c] || "")
        if (k.includes("匯率")) {
          const n = parseNum(rows[r][c + 1])
          if (n > 0) return n
        }
      }
    }
    const fallback = parseNum(rows[0][1] != null ? rows[0][1] : rows[0][0])
    return fallback > 0 ? fallback : 0.21
  }

  function jpyToTwd(jpy, rate) {
    const mode = C().jpyRateMode || "per1"
    let raw
    if (mode === "per100") raw = jpy * (rate / 100)
    else raw = jpy * rate
    const rm = C().twdRound || "round"
    if (rm === "ceil") return Math.ceil(raw)
    if (rm === "floor") return Math.floor(raw)
    return Math.round(raw)
  }

  function rowsToProducts(rows, rate) {
    if (!rows || rows.length < 2) return []
    const headers = rows[0]
    const iName = findColIndex(headers, ["商品名稱", "品名", "name", "title"])
    const iSpec = findColIndex(headers, ["規格", "spec"])
    const iJpy = findColIndex(headers, ["日幣金額", "日幣", "jpy", "price_jpy", "円"])
    const iImg = findColIndex(headers, ["圖片網址", "圖片", "image", "url", "照片"])
    const iGroup = findColIndex(headers, ["團次", "group"])
    const iNote = findColIndex(headers, ["備註", "note"])
    if (iName < 0 || iJpy < 0) {
      console.warn("試算表需至少包含「商品名稱」與「日幣金額」欄")
    }
    const out = []
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      if (!row || !row.length) continue
      const title = String(row[iName >= 0 ? iName : 0] || "").trim()
      if (!title) continue
      const spec = iSpec >= 0 ? String(row[iSpec] || "").trim() : ""
      const jpy = parseNum(row[iJpy >= 0 ? iJpy : 1])
      const imageUrl = iImg >= 0 ? String(row[iImg] || "").trim() : ""
      const groupLabel =
        iGroup >= 0 ? String(row[iGroup] || "").trim() : C().defaultGroupLabel || "本團"
      const extra = iNote >= 0 ? String(row[iNote] || "").trim() : ""
      const noteParts = []
      if (spec) noteParts.push(spec)
      noteParts.push("¥" + (Number.isFinite(jpy) ? jpy : 0))
      if (extra) noteParts.push(extra)
      const note = noteParts.join(" · ")
      const twd = jpyToTwd(jpy, rate)
      out.push({
        id: "s-" + r,
        groupLabel: groupLabel || C().defaultGroupLabel || "本團",
        title,
        spec,
        priceJpy: jpy,
        price: twd,
        imageUrl: imageUrl || null,
        imageDataUrl: null,
        note,
        sort: r,
        createdAt: null,
        source: "sheet",
      })
    }
    return out
  }

  async function loadAll(force) {
    const now = Date.now()
    if (!force && _cache.products && now - _cache.at < ttlMs()) {
      return { products: _cache.products, rate: _cache.rate }
    }
    const uP = resolveUrl("products")
    const uS = resolveUrl("settings")
    let rate = 0.21
    if (uS) {
      try {
        const txtS = await fetchText(uS)
        const rowsS = parseCsv(txtS)
        rate = parseRateFromSettings(rowsS)
      } catch (e) {
        console.warn("讀取匯率分頁失敗，使用預設 0.21", e)
      }
    } else {
      console.warn("未設定匯率分頁（gidSettings 或 sheetCsvUrlSettings），台幣以預設匯率 0.21 試算")
    }

    let products = []
    if (uP) {
      const txtP = await fetchText(uP)
      const rowsP = parseCsv(txtP)
      products = rowsToProducts(rowsP, rate)
    } else {
      console.warn("未設定 googleSheetId / gidProducts 或 sheetCsvUrlProducts，商品清單為空")
    }

    _cache = { products, rate, at: now }
    return { products, rate }
  }

  function invalidateCache() {
    _cache = { products: null, rate: null, at: 0 }
  }

  window.GachaSheet = {
    loadAll,
    invalidateCache,
    getCachedRate: () => _cache.rate,
  }
})()
