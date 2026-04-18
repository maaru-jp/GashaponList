/**
 * 編輯本檔後重新整理頁面
 *
 * productSource:
 *   local — 商品存在瀏覽器
 *   supabase — 商品在 Supabase
 *   sheet — 商品列在 Google 試算表（分頁1：名稱／規格／日幣；分頁2：匯率）
 *
 * 試算表須「知道連結的使用者：檢視者」，若 fetch 被 CORS 擋，可設 sheetCorsProxy 或改用 Apps Script 產出可讀 CSV 網址貼到 sheetCsvUrl*
 *
 * Cloudinary：建立 Unsigned upload preset，並在 preset 允許 folder（與 cloudinaryFolder 一致）
 */
window.GACHA_CONFIG = {
  productSource: "local", // "local" | "supabase" | "sheet"

  mode: "local", // 訂單儲存：local 或 supabase（與 productSource 可並用，例如 sheet + local 喊單）

  localAdminPassword: "gacha2026",

  supabaseUrl: "",
  supabaseAnonKey: "",

  /** 試算表（同一個試算表 ID，兩個分頁用不同 gid） */
  googleSheetId: "",
  /** 第一個分頁（商品） */
  gidProducts: "0",
  /** 第二個分頁（匯率）；請在試算表網址列查看 gid=數字 */
  gidSettings: "",

  /** 若直接貼「可公開下載的 CSV 完整網址」，可覆寫上面 id/gid（例如 Publish 或 Apps Script） */
  sheetCsvUrlProducts: "",
  sheetCsvUrlSettings: "",

  /** 若瀏覽器擋 Google export，可設第三方代理前綴（僅測試用，上線建議用 Apps Script） */
  sheetCorsProxy: "",

  /** 快取秒數（重新整理會強制重抓） */
  sheetCacheTtlSec: 60,

  /**
   * 匯率意義（在試算表第二分頁填一個數字即可，也可用「項目／數值」列：匯率,0.21）
   * per1：台幣 = 日幣 × 匯率（例：匯率 0.21 → 1¥≈0.21 元）
   * per100：台幣 = 日幣 × (匯率÷100)（例：匯率 22 → 100¥=22 元）
   */
  jpyRateMode: "per1",
  twdRound: "round",

  /** Cloudinary：圖片上傳到指定資料夾 */
  cloudinaryCloudName: "",
  cloudinaryUploadPreset: "",
  cloudinaryFolder: "gacha",

  siteTitle: "扭蛋連線 · 團圖",
  defaultGroupLabel: "本團",

  /** 變數：group, idShort, title, spec, priceTwd, priceJpy, price（同 priceTwd）, note, qty, name */
  orderMessageTemplate: `【{{group}} | #{{idShort}}】{{title}}
規格：{{spec}}
台幣約 NT$ {{priceTwd}}（參考 ¥{{priceJpy}}）
數量：{{qty}}
稱呼：{{name}}
備註：

（請完整貼給官方 LINE 建立訂單）`,
}
