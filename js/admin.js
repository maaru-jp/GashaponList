;(() => {
  const C = () => window.GACHA_CONFIG || {}
  const $ = (s, r) => (r || document).querySelector(s)

  function toast(msg) {
    const el = document.getElementById("atoast")
    if (!el) return
    el.textContent = msg
    el.classList.add("show")
    clearTimeout(el._t)
    el._t = setTimeout(() => el.classList.remove("show"), 2200)
  }

  function isSupa() {
    return C().mode === "supabase" && C().supabaseUrl && C().supabaseAnonKey
  }

  function isSheetMode() {
    return GachaData.productsFrom && GachaData.productsFrom() === "sheet"
  }

  function useCloudinary() {
    const c = C()
    return !!(c.cloudinaryCloudName && c.cloudinaryUploadPreset)
  }

  function localOk() {
    return sessionStorage.getItem("gacha_admin") === "1"
  }

  function setLocalOk() {
    sessionStorage.setItem("gacha_admin", "1")
  }

  function compressFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        try {
          const maxW = 1200
          let w = img.naturalWidth
          let h = img.naturalHeight
          if (w > maxW) {
            h = Math.round((h * maxW) / w)
            w = maxW
          }
          const c = document.createElement("canvas")
          c.width = w
          c.height = h
          const ctx = c.getContext("2d")
          if (!ctx) {
            URL.revokeObjectURL(url)
            reject(new Error("canvas"))
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = c.toDataURL("image/jpeg", 0.86)
          URL.revokeObjectURL(url)
          resolve(dataUrl)
        } catch (e) {
          URL.revokeObjectURL(url)
          reject(e)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error("load"))
      }
      img.src = url
    })
  }

  async function nextSort() {
    const list = await GachaData.getProducts()
    let m = 0
    for (const p of list) m = Math.max(m, p.sort || 0)
    return m + 1
  }

  function showApp() {
    document.getElementById("gate")?.setAttribute("hidden", "")
    document.getElementById("gateSba")?.setAttribute("hidden", "")
    const app = document.getElementById("app")
    if (app) app.removeAttribute("hidden")
  }

  function showGateLocal() {
    document.getElementById("gate")?.removeAttribute("hidden")
    document.getElementById("gateSba")?.setAttribute("hidden", "")
    document.getElementById("app")?.setAttribute("hidden", "")
  }

  function showGateSba() {
    document.getElementById("gateSba")?.removeAttribute("hidden")
    document.getElementById("gate")?.setAttribute("hidden", "")
    document.getElementById("app")?.setAttribute("hidden", "")
  }

  async function tryEnter() {
    if (isSupa()) {
      const em = /** @type {HTMLInputElement} */ (document.getElementById("inEmail"))
      const pw = /** @type {HTMLInputElement} */ (document.getElementById("inSbaPw"))
      const msg = document.getElementById("sbaMsg")
      if (msg) msg.textContent = "登入中…"
      const r = await GachaData.adminLogin((em && em.value) || "", (pw && pw.value) || "")
      if (r.error) {
        if (msg) msg.textContent = r.error.message || "登入失敗"
        return
      }
      if (msg) msg.textContent = ""
      showApp()
      await refreshAll()
      return
    }
    const pw = /** @type {HTMLInputElement} */ (document.getElementById("inPw"))
    if ((pw && pw.value) === (C().localAdminPassword || "gacha2026")) {
      setLocalOk()
      showApp()
      await refreshAll()
    } else {
      toast("密碼錯誤")
    }
  }

  function productTitleMap(list) {
    const m = new Map()
    for (const p of list) m.set(p.id, p.title)
    return m
  }

  function groupMap(list) {
    const m = new Map()
    for (const p of list) m.set(p.id, p.groupLabel)
    return m
  }

  async function refreshAll() {
    const prods = await GachaData.getProducts()
    const pm = productTitleMap(prods)
    const gm = groupMap(prods)
    const ord = await GachaData.getOrders()
    renderProds(prods)
    renderOrds(ord.rows || [], pm, gm, prods)
  }

  function renderProds(prods) {
    const w = document.getElementById("prodWrap")
    if (!w) return
    if (!prods.length) {
      w.innerHTML =
        '<p class="muted">' +
        (isSheetMode()
          ? "試算表目前沒有資料列，或尚未讀取成功。請檢查 config 的 googleSheetId / gid、分享權限。"
          : "尚無品項，請上傳圖片或手動新增。") +
        "</p>"
      return
    }
    if (isSheetMode()) {
      w.innerHTML = `<p class="muted" style="margin:0 0 8px 0">以下由試算表唯讀同步（刪改請在試算表操作）。</p>
      <table><thead><tr><th></th><th>團次</th><th>品名</th><th>規格</th><th>日幣</th><th>台幣(估)</th><th>備註</th></tr></thead><tbody>
      ${prods
        .map((p) => {
          const src = p.imageDataUrl || p.imageUrl || ""
          const jpy = p.priceJpy != null ? p.priceJpy : "—"
          return `<tr>
          <td>${src ? `<img class="thumb" src="${escAttr(src)}" alt="">` : "—"}</td>
          <td>${escHtml(p.groupLabel || "")}</td>
          <td>${escHtml(p.title || "")}</td>
          <td>${escHtml(p.spec || "")}</td>
          <td>${escHtml(String(jpy))}</td>
          <td>${escHtml(String(p.price ?? 0))}</td>
          <td>${escHtml(p.note || "")}</td>
        </tr>`
        })
        .join("")}
    </tbody></table>`
      return
    }
    w.innerHTML = `<table><thead><tr><th></th><th>團次</th><th>品名</th><th>單價</th><th>備註</th><th></th></tr></thead><tbody>
      ${prods
        .map((p) => {
          const src = p.imageDataUrl || p.imageUrl || ""
          return `<tr>
          <td>${src ? `<img class="thumb" src="${escAttr(src)}" alt="">` : "—"}</td>
          <td>${escHtml(p.groupLabel || "")}</td>
          <td>${escHtml(p.title || "")}</td>
          <td>${escHtml(String(p.price ?? 0))}</td>
          <td>${escHtml(p.note || "")}</td>
          <td><button type="button" class="btn btn-ghost js-del" data-id="${escAttr(p.id)}">刪除</button></td>
        </tr>`
        })
        .join("")}
    </tbody></table>`
    for (const b of w.querySelectorAll(".js-del")) {
      b.addEventListener("click", async () => {
        const id = b.getAttribute("data-id")
        if (!id || !confirm("確定刪除此品項？")) return
        await GachaData.deleteProduct(id)
        toast("已刪除")
        await refreshAll()
      })
    }
  }

  function renderOrds(rows, titleMap, groupMap, prods) {
    const w = document.getElementById("ordWrap")
    if (!w) return
    if (!rows || !rows.length) {
      w.innerHTML = '<p class="muted">尚無 +1 記錄。</p>'
      return
    }
    const summary = new Map()
    for (const o of rows) {
      const tid = o.productId
      if (!summary.has(tid)) summary.set(tid, { qty: 0, people: 0 })
      const s = summary.get(tid)
      s.qty += o.qty
      s.people += 1
    }
    const sumLines = [...summary.entries()]
      .map(([pid, s]) => {
        const t = titleMap.get(pid) || pid
        return `<div class="stat-pill" style="margin-bottom: 6px"><span>${escHtml(t)}</span><b>共 ${s.qty} 件 · ${s.people} 筆</b></div>`
      })
      .join("")
    w.innerHTML = `<div style="margin-bottom:10px">${sumLines}</div>
    <table><thead><tr><th>時間</th><th>團</th><th>品名</th><th>稱呼</th><th>數量</th></tr></thead><tbody>
    ${rows
      .map((o) => {
        const t = titleMap.get(o.productId) || o.productId
        const g = groupMap.get(o.productId) || ""
        const time = o.createdAt ? String(o.createdAt).replace("T", " ").slice(0, 19) : "—"
        return `<tr>
        <td>${escHtml(time)}</td>
        <td>${escHtml(g)}</td>
        <td>${escHtml(t)}</td>
        <td>${escHtml(o.displayName || "")}</td>
        <td>${escHtml(String(o.qty))}</td>
      </tr>`
      })
      .join("")}
    </tbody></table>`
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }
  function escAttr(s) {
    return escHtml(s).replace(/"/g, "&quot;")
  }

  function downloadCsv(rows, titleMap, groupMap) {
    const head = ["時間", "團", "品名", "稱呼", "數量", "品項ID"]
    const lines = [head.join(",")]
    for (const o of rows) {
      const t = titleMap.get(o.productId) || o.productId
      const g = groupMap.get(o.productId) || ""
      const time = o.createdAt || ""
      const line = [time, g, t, o.displayName || "", o.qty, o.productId].map((x) => {
        const c = String(x).replace(/"/g, '""')
        return /[",\n]/.test(c) ? `"${c}"` : c
      })
      lines.push(line.join(","))
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "gacha-orders-" + new Date().toISOString().slice(0, 10) + ".csv"
    a.click()
    URL.revokeObjectURL(a.href)
    toast("已下載 CSV")
  }

  async function addBatchFromFiles(files) {
    const box = document.getElementById("uploadResults")

    if (isSheetMode()) {
      if (!useCloudinary() || !window.GachaCloudinary) {
        if (box) box.innerHTML = '<span class="pill-ok" style="color:#c55">請在 config.js 填寫 cloudinaryCloudName、cloudinaryUploadPreset</span>'
        toast("請先設定 Cloudinary")
        return
      }
      if (box) box.innerHTML = "上傳中…"
      const lines = []
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (!f.type.startsWith("image/")) continue
        try {
          const url = await GachaCloudinary.uploadImage(f)
          lines.push(url)
        } catch (e) {
          console.error(e)
          lines.push("失敗：" + (e && e.message ? e.message : String(e)))
        }
      }
      if (box) {
        box.textContent = ""
        const lead = document.createElement("strong")
        lead.textContent = "請將下列網址貼到試算表「圖片網址」欄："
        box.appendChild(lead)
        lines.forEach((url) => {
          const row = document.createElement("div")
          row.style.margin = "8px 0"
          const code = document.createElement("code")
          code.textContent = url
          code.style.display = "block"
          code.style.wordBreak = "break-all"
          code.style.fontSize = "0.82rem"
          const btn = document.createElement("button")
          btn.type = "button"
          btn.className = "btn btn-ghost"
          btn.textContent = "複製"
          btn.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(url)
              toast("已複製網址")
            } catch {
              toast("無法複製，請手動選取網址")
            }
          })
          row.appendChild(code)
          row.appendChild(btn)
          box.appendChild(row)
        })
      }
      toast("上傳完成，請貼回試算表後按前台「重新整理」")
      if (GachaData.invalidateSheetCache) GachaData.invalidateSheetCache()
      await refreshAll()
      return
    }

    const g = ($("#defGroup") && $("#defGroup").value) || C().defaultGroupLabel || "本團"
    const titleBase = ($("#fTitle") && $("#fTitle").value) || "品項"
    const price = Number($("#fPrice") && $("#fPrice").value) || 0
    const note = ($("#fNote") && $("#fNote").value) || ""
    let n = 0
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (!f.type.startsWith("image/")) continue
      const dataUrl = await compressFile(f)
      let imageUrl = null
      if (useCloudinary() && window.GachaCloudinary) {
        try {
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], f.name || "upload.jpg", { type: "image/jpeg" })
          imageUrl = await GachaCloudinary.uploadImage(file)
        } catch (e) {
          console.error(e)
          toast("Cloudinary 失敗，改試其他方式")
        }
      }
      if (!imageUrl && isSupa() && GachaData.uploadToStorage) {
        try {
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], f.name || "upload.jpg", { type: "image/jpeg" })
          imageUrl = await GachaData.uploadToStorage(file)
        } catch (e) {
          console.error(e)
          toast("雲端上傳失敗，改存本機圖")
        }
      }
      const title = files.length > 1 ? `${titleBase} ${i + 1}` : titleBase
      const id = GachaData.newId()
      const sort = await nextSort()
      await GachaData.saveProduct({
        id,
        groupLabel: g,
        title,
        price,
        note,
        sort,
        imageDataUrl: imageUrl ? null : dataUrl,
        imageUrl: imageUrl || null,
        createdAt: new Date().toISOString(),
      })
      n++
    }
    if (n) toast("已新增 " + n + " 筆品項")
    await refreshAll()
  }

  async function addManual() {
    const g = ($("#defGroup") && $("#defGroup").value) || C().defaultGroupLabel || "本團"
    const title = ($("#fTitle") && $("#fTitle").value) || "品項"
    const price = Number($("#fPrice") && $("#fPrice").value) || 0
    const note = ($("#fNote") && $("#fNote").value) || ""
    const id = GachaData.newId()
    const sort = await nextSort()
    await GachaData.saveProduct({
      id,
      groupLabel: g,
      title,
      price,
      note,
      sort,
      imageDataUrl: null,
      imageUrl: null,
      createdAt: new Date().toISOString(),
    })
    toast("已新增一筆")
    await refreshAll()
  }

  async function boot() {
    const c = C()
    const h1 = document.getElementById("adminH1")
    const am = document.getElementById("adminMode")
    const panelBak = document.getElementById("panelBak")
    const defGroup = document.getElementById("defGroup")

    if (defGroup) {
      defGroup.value = localStorage.getItem("gacha_def_group") || c.defaultGroupLabel || "本團"
      defGroup.addEventListener("input", () => {
        localStorage.setItem("gacha_def_group", defGroup.value)
      })
    }

    if (isSupa()) {
      if (am) am.textContent = "雲端（Supabase）· 登入後可管理圖片與訂單"
      if (panelBak) panelBak.setAttribute("hidden", "")
      const sess = await GachaData.adminSession()
      if (sess) {
        showApp()
        await refreshAll()
      } else {
        showGateSba()
      }
    } else {
      if (am) am.textContent = "本機模式 · 資料只存在此瀏覽器，建議定期下載備份"
      if (panelBak) panelBak.removeAttribute("hidden")
      if (localOk()) {
        showApp()
        await refreshAll()
      } else {
        showGateLocal()
      }
    }

    if (h1) h1.textContent = c.siteTitle ? c.siteTitle + " · 後台" : "團圖 · 後台"

    const sheetHelp = document.getElementById("sheetHelp")
    const manualBlock = document.getElementById("manualBlock")
    const panelH2 = document.querySelector("#panelAdd h2")
    if (isSheetMode()) {
      if (am)
        am.textContent =
          "Google 試算表商品 · 圖片上傳至 Cloudinary 後貼回「圖片網址」欄；喊單資料仍依 mode（本機或 Supabase）"
      if (sheetHelp) sheetHelp.style.display = "block"
      if (manualBlock) manualBlock.style.display = "none"
      if (panelH2) panelH2.textContent = "上傳圖片到 Cloudinary"
      const dzLead = document.getElementById("dzLead")
      const dzSub = document.getElementById("dzSub")
      if (dzLead) dzLead.textContent = "點此上傳（送到 Cloudinary 指定資料夾），再把網址貼回試算表「圖片網址」欄"
      if (dzSub) dzSub.textContent = "試算表更新後，到前台按「重新整理」即可同步"
    } else {
      if (sheetHelp) sheetHelp.style.display = "none"
      if (manualBlock) manualBlock.style.display = ""
      if (panelH2) panelH2.textContent = "新增團內品項"
      const dzLead = document.getElementById("dzLead")
      const dzSub = document.getElementById("dzSub")
      if (dzLead)
        dzLead.textContent = "點此或把照片拖入框內，可一次上傳多張（在東京手機上也可操作）"
      if (dzSub) dzSub.textContent = "圖片會自動壓小以節省空間"
    }

    document.getElementById("btnGate")?.addEventListener("click", () => void tryEnter())
    document.getElementById("btnSba")?.addEventListener("click", () => void tryEnter())
    document.getElementById("inPw")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void tryEnter()
    })

    const dz = document.getElementById("dz")
    const fin = /** @type {HTMLInputElement} */ (document.getElementById("files"))
    if (dz && fin) {
      dz.addEventListener("click", () => fin.click())
      dz.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          fin.click()
        }
      })
      fin.addEventListener("change", () => {
        if (fin.files && fin.files.length) void addBatchFromFiles(fin.files)
        fin.value = ""
      })
    }

    document.getElementById("btnAdd")?.addEventListener("click", () => void addManual())

    document.getElementById("btnCsv")?.addEventListener("click", async () => {
      const prods = await GachaData.getProducts()
      const pm = productTitleMap(prods)
      const gm = groupMap(prods)
      const ord = await GachaData.getOrders()
      downloadCsv(ord.rows || [], pm, gm)
    })

    document.getElementById("btnExportBak")?.addEventListener("click", () => {
      const t = GachaData.exportAllLocal()
      const blob = new Blob([t], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "gacha-backup-" + new Date().toISOString().slice(0, 10) + ".json"
      a.click()
      URL.revokeObjectURL(a.href)
      toast("已下載備份")
    })

    document.getElementById("importBak2")?.addEventListener("change", (e) => {
      const t = /** @type {HTMLInputElement} */ (e.target)
      const f = t.files && t.files[0]
      if (!f) return
      const r = new FileReader()
      r.onload = () => {
        try {
          GachaData.importAllLocal(String(r.result))
          toast("已還原備份")
          void refreshAll()
        } catch (err) {
          console.error(err)
          toast("檔案格式錯誤")
        }
        t.value = ""
      }
      r.readAsText(f, "utf-8")
    })
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void boot())
  else void boot()
})()
