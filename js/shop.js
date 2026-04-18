;(() => {
  const C = () => window.GACHA_CONFIG || {}
  const $ = (s, r) => (r || document).querySelector(s)
  const $$ = (s, r) => [...(r || document).querySelectorAll(s))]

  function idShort(id) {
    if (!id) return "----"
    return String(id).replace(/-/g, "").slice(0, 4)
  }

  function fillTemplate(t, vars) {
    let s = t
    for (const [k, v] of Object.entries(vars)) {
      s = s.split("{{" + k + "}}").join(String(v))
    }
    return s
  }

  function toast(msg) {
    const el = $("#toast")
    if (!el) return
    el.textContent = msg
    el.classList.add("show")
    clearTimeout(el._t)
    el._t = setTimeout(() => el.classList.remove("show"), 2000)
  }

  function imgSrc(p) {
    if (p.imageDataUrl) return p.imageDataUrl
    if (p.imageUrl) return p.imageUrl
    return ""
  }

  let state = { products: [], stats: new Map(), filter: "" }

  async function refresh() {
    const prods = await GachaData.getProducts()
    const stats = await GachaData.getPublicStats()
    state.products = prods
    state.stats = stats
    render()
  }

  function filterList() {
    const q = (state.filter || "").trim().toLowerCase()
    if (!q) return state.products
    return state.products.filter(
      (p) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.groupLabel || "").toLowerCase().includes(q) ||
        (p.note || "").toLowerCase().includes(q) ||
        String(p.spec || "")
          .toLowerCase()
          .includes(q)
    )
  }

  function render() {
    const set = C()
    document.title = set.siteTitle || "團圖"
    const h1 = $("#pageTitle")
    if (h1) h1.textContent = set.siteTitle || "團圖"
    const sub = $("#subTitle")
    if (sub) {
      let extra = ""
      if (
        GachaData.productsFrom &&
        GachaData.productsFrom() === "sheet" &&
        window.GachaSheet &&
        typeof GachaSheet.getCachedRate === "function"
      ) {
        const r = GachaSheet.getCachedRate()
        if (r != null) extra = ` · 目前匯率參考：${r}（${C().jpyRateMode === "per100" ? "每百冊" : "每 1¥"}）`
      }
      sub.textContent =
        "一鍵複製喊單文字，貼上官方 LINE 即完成；本頁彙整已喊總量（待採購參考）" + extra
    }
    const search = $("#search")
    if (search && search.value !== state.filter) search.value = state.filter

    const list = $("#list")
    if (!list) return
    const items = filterList()
    if (!items.length) {
      list.innerHTML = `<p class="empty">目前沒有品項。請到「後台」上傳圖片與價格。</p>`
    } else {
      list.innerHTML = items
        .map((p) => {
          const st = state.stats.get(p.id) || { totalQty: 0, orderCount: 0 }
          const src = imgSrc(p)
          return `
<article class="card" data-id="${p.id}">
  <div class="card-fig">
    <span class="badge">${esc(p.groupLabel || "團")}</span>
    ${src ? `<img src="${esc(src)}" alt="" loading="lazy" width="400" height="400">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.8rem">無圖</div>`}
  </div>
  <div class="card-body">
    <h2 class="card-title">${esc(p.title || "品項")}</h2>
    <div class="card-meta">
      <span class="card-price">NT$ ${esc(String(p.price ?? 0))}</span>
      <span class="card-stat">已喊 ${st.totalQty} 件 · ${st.orderCount} 筆</span>
    </div>
    ${
      p.priceJpy != null
        ? `<p class="card-note" style="color:#c25a5a;font-weight:600">參考 ¥${esc(String(p.priceJpy))}</p>`
        : ""
    }
    ${p.note ? `<p class="card-note">${esc(p.note)}</p>` : ""}
    <div class="card-actions">
      <button type="button" class="btn btn-primary js-copy" data-id="${p.id}">一鍵複製喊單內容</button>
      <button type="button" class="btn btn-accent js-order" data-id="${p.id}">+1 喊單</button>
    </div>
  </div>
</article>`
        })
        .join("")
    }

    const statGrid = $("#statGrid")
    if (statGrid) {
      const prods = state.products
      if (!prods.length) {
        statGrid.parentElement.classList.add("js-hide")
      } else {
        statGrid.parentElement.classList.remove("js-hide")
        statGrid.innerHTML = prods
          .map((p) => {
            const st = state.stats.get(p.id) || { totalQty: 0, orderCount: 0 }
            return `<div class="stat-pill"><span>${esc(p.title)}</span><b>${st.totalQty} 件</b></div>`
          })
          .join("")
      }
    }

    for (const b of $$(".js-copy", list)) {
      b.addEventListener("click", (e) => onCopy(/** @type {HTMLElement} */ (e.currentTarget).dataset.id))
    }
    for (const b of $$(".js-order", list)) {
      b.addEventListener("click", (e) => onOpenOrder(/** @type {HTMLElement} */ (e.currentTarget).dataset.id))
    }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function productById(id) {
    return state.products.find((p) => p.id === id)
  }

  async function onCopy(id) {
    const p = productById(id)
    if (!p) return
    const t = { qty: 1, name: "（於 LINE 內自填稱呼）" }
    const set = C()
    const twd = p.price != null ? p.price : 0
    const jpy = p.priceJpy != null ? p.priceJpy : ""
    const spec = p.spec != null ? p.spec : ""
    const text = fillTemplate(set.orderMessageTemplate, {
      group: p.groupLabel || set.defaultGroupLabel || "本團",
      idShort: idShort(p.id),
      title: p.title,
      spec,
      price: twd,
      priceTwd: twd,
      priceJpy: jpy,
      note: p.note || "",
      qty: t.qty,
      name: t.name,
    })
    try {
      await navigator.clipboard.writeText(text)
      toast("已複製到剪貼簿，貼上官方 LINE 即送出")
    } catch {
      toast("此瀏覽器無法自動複製，請長按內文手動複製")
    }
  }

  let currentProductId = ""
  const modal = {
    get root() {
      return $("#orderModal")
    },
    get q() {
      return document.querySelector("#oQty")
    },
    get n() {
      return document.querySelector("#oName")
    },
    get preview() {
      return document.querySelector("#orderPreview")
    },
    show(id) {
      const m = this.root
      if (!m) return
      currentProductId = id
      m.hidden = false
      const p = productById(id)
      this.q.value = 1
      this.n.value = ""
      m.querySelector("#orderTitle")?.replaceChildren(document.createTextNode(p?.title || ""))
      this._updPreview()
    },
    hide() {
      const m = this.root
      if (m) m.hidden = true
      currentProductId = ""
    },
    _updPreview() {
      const p = productById(currentProductId)
      if (!p) return
      const set = C()
      const twd = p.price != null ? p.price : 0
      const jpy = p.priceJpy != null ? p.priceJpy : ""
      const spec = p.spec != null ? p.spec : ""
      const text = fillTemplate(set.orderMessageTemplate, {
        group: p.groupLabel || set.defaultGroupLabel || "本團",
        idShort: idShort(p.id),
        title: p.title,
        spec,
        price: twd,
        priceTwd: twd,
        priceJpy: jpy,
        note: p.note || "",
        qty: this.q.value || 1,
        name: (this.n.value && this.n.value.trim()) || "（自填稱呼）",
      })
      this.preview.value = text
    },
  }

  async function submitOrder() {
    if (!currentProductId) return
    const p = productById(currentProductId)
    if (!p) return
    const name = (modal.n.value && modal.n.value.trim()) || "未留名"
    const qty = Math.max(1, Math.min(999, Number(modal.q.value) || 1))
    try {
      await GachaData.addOrder({ productId: p.id, displayName: name, qty })
      toast("已登記 +1，統計已更新")
      modal.hide()
      await refresh()
    } catch (e) {
      console.error(e)
      toast("送出失敗，請稍後再試")
    }
  }

  function onOpenOrder(id) {
    modal.show(id)
  }

  function bind() {
    $("#search")?.addEventListener("input", (e) => {
      const t = e.target
      if (t && "value" in t) state.filter = String(/** @type {HTMLInputElement} */ (t).value)
      render()
    })
    $("#btnRefresh")?.addEventListener("click", () => {
      if (GachaData.invalidateSheetCache) GachaData.invalidateSheetCache()
      void refresh()
    })
    $("#orderCancel")?.addEventListener("click", () => modal.hide())
    $("#orderSubmit")?.addEventListener("click", () => void submitOrder())
    modal.q?.addEventListener("input", () => modal._updPreview())
    modal.n?.addEventListener("input", () => modal._updPreview())
    $("#orderModal")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) modal.hide()
    })
    const cp = document.querySelector("#orderCopy")
    if (cp) {
      cp.addEventListener("click", async () => {
        const el = /** @type {HTMLTextAreaElement} */ (modal.preview)
        const text = el && "value" in el ? el.value : ""
        if (!text) return
        try {
          await navigator.clipboard.writeText(text)
          toast("已複製，可再貼到官方 LINE")
        } catch {
          toast("無法複製，請在下方長按內文")
        }
      })
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bind()
      void refresh()
    })
  } else {
    bind()
    void refresh()
  }
})()
