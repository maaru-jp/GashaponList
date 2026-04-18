;(() => {
  const C = () => window.GACHA_CONFIG || {}
  const LS = {
    products: "gacha_v1_products",
    orders: "gacha_v1_orders",
  }

  let _sb = null

  function getSb() {
    if (_sb) return _sb
    if (C().mode === "supabase" && C().supabaseUrl && C().supabaseAnonKey && window.supabase?.createClient) {
      _sb = window.supabase.createClient(C().supabaseUrl, C().supabaseAnonKey)
    }
    return _sb
  }

  function readLocal(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null")
    } catch {
      return null
    }
  }

  function writeLocal(key, v) {
    localStorage.setItem(key, JSON.stringify(v))
  }

  function newId() {
    return window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : "id-" + String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8)
  }

  /** 未填 productSource 時：舊版僅設 mode:supabase 仍視為商品在 Supabase */
  function productsFrom() {
    const c = C()
    if (c.productSource) return c.productSource
    return c.mode === "supabase" ? "supabase" : "local"
  }

  async function getProducts() {
    if (productsFrom() === "sheet" && window.GachaSheet) {
      const { products } = await window.GachaSheet.loadAll(false)
      return products || []
    }
    if (productsFrom() === "supabase" && getSb()) {
      const { data, error } = await getSb()
        .from("products")
        .select("id,group_label,title,price,image_url,note,sort_order,created_at")
        .order("sort_order", { ascending: true })
      if (error) throw error
      return (data || []).map(mapProductRow)
    }
    return readLocal(LS.products) || []
  }

  function mapProductRow(p) {
    return {
      id: p.id,
      groupLabel: p.group_label,
      title: p.title,
      price: Number(p.price) || 0,
      imageUrl: p.image_url,
      imageDataUrl: p.imageDataUrl,
      note: p.note || "",
      sort: p.sort_order != null ? p.sort_order : 0,
      createdAt: p.created_at,
    }
  }

  async function saveProduct(product) {
    if (productsFrom() === "sheet") {
      throw new Error("商品由 Google 試算表維護，請改試算表或上傳圖片後貼網址")
    }
    const s = getSb()
    if (productsFrom() === "supabase" && s) {
      const row = {
        id: product.id,
        group_label: product.groupLabel,
        title: product.title,
        price: product.price,
        image_url: product.imageUrl || null,
        note: product.note || "",
        sort_order: product.sort || 0,
      }
      const { error } = await s
        .from("products")
        .upsert(row, { onConflict: "id" })
      if (error) throw error
      return { ...mapProductRow(row), imageDataUrl: null, createdAt: new Date().toISOString() }
    }
    const all = (await getProducts().catch(() => readLocal(LS.products) || [])) || []
    const i = all.findIndex((p) => p.id === product.id)
    if (i >= 0) all[i] = product
    else all.push(product)
    all.sort((a, b) => (a.sort || 0) - (b.sort || 0))
    writeLocal(LS.products, all)
    return product
  }

  async function deleteProduct(id) {
    if (productsFrom() === "sheet") {
      throw new Error("請在試算表刪列")
    }
    const s = getSb()
    if (productsFrom() === "supabase" && s) {
      const { error } = await s.from("products").delete().eq("id", id)
      if (error) throw error
      return
    }
    const all = (await getProducts().catch(() => readLocal(LS.products) || [])) || []
    writeLocal(
      LS.products,
      all.filter((p) => p.id !== id)
    )
  }

  async function getOrders() {
    if (C().mode === "supabase" && getSb()) {
      const s = getSb()
      if (!s || !(await s.auth.getSession())?.data?.session) {
        return { rows: [], isAdmin: false }
      }
      const { data, error } = await s
        .from("orders")
        .select("id,product_id,display_name,qty,created_at")
        .order("created_at", { ascending: false })
      if (error) return { rows: [], isAdmin: true, error: error.message }
      return {
        rows: (data || []).map((r) => ({
          id: r.id,
          productId: r.product_id,
          displayName: r.display_name,
          qty: r.qty,
          createdAt: r.created_at,
        })),
        isAdmin: true,
      }
    }
    return { rows: readLocal(LS.orders) || [], isAdmin: true }
  }

  async function addOrder(o) {
    const row = {
      id: newId(),
      productId: o.productId,
      displayName: o.displayName || "匿名",
      qty: Math.max(1, Math.min(999, Number(o.qty) || 1)),
    }
    if (C().mode === "supabase" && getSb()) {
      const { error } = await getSb().from("orders").insert({
        id: row.id,
        product_id: o.productId,
        display_name: row.displayName,
        qty: row.qty,
      })
      if (error) throw error
      return row
    }
    const orders = readLocal(LS.orders) || []
    orders.push({
      ...row,
      createdAt: new Date().toISOString(),
    })
    writeLocal(LS.orders, orders)
    return { ...row, createdAt: new Date().toISOString() }
  }

  async function getPublicStats() {
    if (C().mode === "supabase" && getSb()) {
      const { data, error } = await getSb().rpc("get_order_stats")
      if (error) {
        console.warn("get_order_stats 失敗（若使用 supabase 請在 SQL 建立此 function）", error)
      } else if (data) {
        const m = new Map()
        for (const r of data) {
          m.set(r.product_id, { totalQty: r.total_qty, orderCount: r.order_count })
        }
        return m
      }
    }
    const orders = readLocal(LS.orders) || []
    const m = new Map()
    for (const o of orders) {
      if (!m.has(o.productId)) m.set(o.productId, { totalQty: 0, orderCount: 0 })
      const x = m.get(o.productId)
      x.totalQty += o.qty
      x.orderCount += 1
    }
    return m
  }

  async function adminLogin(email, password) {
    const s = getSb()
    if (!s) return { error: "supabase 未就緒" }
    return s.auth.signInWithPassword({ email, password })
  }

  async function adminSession() {
    if (C().mode !== "supabase" || !getSb()) return null
    return (await getSb().auth.getSession()).data.session
  }

  async function uploadToStorage(file) {
    const s = getSb()
    if (C().mode !== "supabase" || !s) return null
    const safe = String(file.name).replace(/[^\w.\-]/g, "_") || "file"
    const name = newId() + "-" + safe
    const { data, error } = await s.storage.from("images").upload(name, file, {
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
      upsert: true,
    })
    if (error) throw error
    const { data: pub } = s.storage.from("images").getPublicUrl(data.path)
    return pub?.publicUrl || null
  }

  function exportAllLocal() {
    return JSON.stringify(
      { products: readLocal(LS.products) || [], orders: readLocal(LS.orders) || [] },
      null,
      2
    )
  }

  function importAllLocal(text) {
    const o = JSON.parse(text)
    if (o.products) writeLocal(LS.products, o.products)
    if (o.orders) writeLocal(LS.orders, o.orders)
  }

  function invalidateSheetCache() {
    if (window.GachaSheet) window.GachaSheet.invalidateCache()
  }

  window.GachaData = {
    newId,
    getProducts,
    saveProduct,
    deleteProduct,
    getOrders,
    addOrder,
    getPublicStats,
    getSb: () => getSb(),
    adminLogin,
    adminSession,
    uploadToStorage,
    exportAllLocal,
    importAllLocal,
    invalidateSheetCache,
    productsFrom,
  }
})()
