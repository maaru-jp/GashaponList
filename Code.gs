/**
 * 扭蛋目錄用 — Google Apps Script
 *
 * 用途：以「網路應用程式」網址提供試算表 CSV，方便前端 fetch（避開部分環境對 docs.google.com/export 的 CORS 限制）。
 *
 * 【部署步驟】
 * 1. 開啟你的 Google 試算表 → 擴充功能 → Apps Script
 * 2. 貼上本檔全部內容，存檔
 * 3. 右上角「部署」→「新增部署作業」→ 類型選「網路應用程式」
 * 4. 說明：任意；執行身分：我；具有存取權的使用者：任何人（含匿名）
 * 5. 部署 → 複製「網路應用程式」網址（長得像 https://script.google.com/macros/s/.../exec）
 * 6. 把網址貼到 gacha-catalog 的 config.js：
 *    sheetCsvUrlProducts = "該網址?type=products"
 *    sheetCsvUrlSettings = "該網址?type=settings"
 *
 * 【選填：指令碼屬性】專案設定 → 指令碼屬性（不設則用「第一個分頁=商品、第二個=匯率」）
 *   SPREADSHEET_ID — 僅當腳本未綁在試算表時必填
 *   GID_PRODUCTS  — 商品分頁的 gid（網址列 gid=數字）
 *   GID_SETTINGS — 匯率分頁的 gid
 */

function doGet (e) {
  var p = (e && e.parameter) || {}
  var type = String(p.type || p.t || 'products').toLowerCase()
  var isSettings =
    type === 'settings' || type === 'rate' || type === '匯率'

  var ss = getSpreadsheet_()
  var sheet = getSheetForRequest_(ss, isSettings)
  var csv = sheetToCsv_(sheet)

  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV)
}

/** 腳本「綁在試算表裡」時用使用中試算表；否則需在指令碼屬性設 SPREADSHEET_ID */
function getSpreadsheet_ () {
  try {
    return SpreadsheetApp.getActiveSpreadsheet()
  } catch (err) {
    var id = getProp_('SPREADSHEET_ID')
    if (!id) {
      throw new Error('請將此專案綁定在試算表，或在指令碼屬性設定 SPREADSHEET_ID')
    }
    return SpreadsheetApp.openById(id)
  }
}

function getProp_ (key) {
  return PropertiesService.getScriptProperties().getProperty(key) || ''
}

/**
 * 商品：優先 GID_PRODUCTS，否則第一個分頁。
 * 匯率：優先 GID_SETTINGS，否則第二個分頁（只有一個分頁時用第一個）。
 */
function getSheetForRequest_ (ss, isSettings) {
  var sheets = ss.getSheets()
  if (isSettings) {
    var gidS = getProp_('GID_SETTINGS')
    if (gidS) {
      return getSheetByGid_(ss, gidS)
    }
    return sheets.length > 1 ? sheets[1] : sheets[0]
  }
  var gidP = getProp_('GID_PRODUCTS')
  if (gidP) {
    return getSheetByGid_(ss, gidP)
  }
  return sheets[0]
}

function getSheetByGid_ (ss, gidStr) {
  var target = parseInt(String(gidStr), 10)
  var sheets = ss.getSheets()
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === target) {
      return sheets[i]
    }
  }
  return sheets[0]
}

function sheetToCsv_ (sheet) {
  var range = sheet.getDataRange()
  var values = range.getDisplayValues()
  var lines = []
  for (var r = 0; r < values.length; r++) {
    var row = values[r]
    var cells = []
    for (var c = 0; c < row.length; c++) {
      cells.push(escapeCsvField_(String(row[c])))
    }
    lines.push(cells.join(','))
  }
  return lines.join('\n')
}

function escapeCsvField_ (s) {
  if (s.indexOf('"') !== -1 || s.indexOf(',') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/** 手動測試：選函式 testOutput → 執行 */
function testOutput () {
  var out = doGet({ parameter: { type: 'products' } })
  Logger.log(out.getContent().substring(0, 500))
}
