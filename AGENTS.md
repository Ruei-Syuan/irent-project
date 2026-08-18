---
name: Codex
description: Codex 專案開發規則
---

# Codex 工作規則

## 回覆與修改原則

- 使用繁體中文，回覆保持簡短。
- 修改 HTML、CSS、JavaScript 時，直接修改現有檔案。
- 不要先建立計畫、規格書、README、Markdown 或範例檔案。
- 除非我明確要求，否則不要建立新檔案或更換技術架構。
- 優先修改我指定的檔案；未指定時，先確認相關檔案。
- 保留既有功能、文字與檔案結構，只修改指定部分。
- 樣式修改必須同步檢查桌面版與手機版。
- 程式碼完成後執行格式化：
  - Windows：`Shift + Alt + F`
- 完成後只列出：
  1. 修改檔案
  2. 修改內容
  3. 驗證結果

## 地圖視覺化規範

- 互動式地圖與氣泡圖固定使用 `MapLibre GL JS`。
- 不使用 Leaflet、Google Maps 或 Mapbox GL JS，除非我明確指定。
- 使用 WebGL 圖層繪製資料點，不可為每個點建立 HTML Marker。
- 座標資料統一使用 GeoJSON `FeatureCollection`。
- 氣泡圖使用 MapLibre 的 `circle` layer。
- 氣泡位置使用 `longitude` 與 `latitude`。
- 氣泡大小依 `issueCount`、案件數量或指定數值欄位調整。
- 氣泡顏色依 `healthScore` 或車況狀態決定，並提供圖例。
- 點擊氣泡時，顯示車牌、健康分數、異常數量、車輛狀態與最後更新時間。
- 地圖資料 API 預設為：`GET /api/v1/vehicles/map-summary`。
- 地圖 API 僅回傳必要欄位：`id`、`plateNumber`、`latitude`、`longitude`、`healthScore`、`issueCount`、`status`、`updatedAt`。
- 資料量增加時，保留改用 `deck.gl` 的 `ScatterplotLayer` 與 MapLibre 整合的空間。

# Backend API 開發規範

## 技術堆疊

固定使用：

- Node.js
- JavaScript（ES Modules）
(Fastify 是「API 入口與規則管理者」；Prisma 是「與 SQLite 溝通的資料庫翻譯器」)
- Fastify (Node.js 後端框架，用來建立 API)
- Prisma ORM (負責接收請求、驗證資料、執行程式邏輯、回傳 JSON)
- SQLite
- `@fastify/swagger`
- `@fastify/swagger-ui`
- RESTful API
- API 前綴：`/api/v1`

除非我明確要求，否則不得改用 Express、NestJS、MongoDB、Firebase 或其他資料庫／框架。

## 專案結構

```text
iRent 專案
├─ *.html、css/、js/       前端頁面
├─ data/irent.sqlite      SQLite 正式資料庫
├─ backend/
│  ├─ src/
│  │  ├─ server.js        後端啟動入口
│  │  ├─ app.js           Fastify、Swagger、靜態頁面與路由註冊
│  │  ├─ routes/          各資料表 REST API
│  │  ├─ services/        登入、稽核、資料庫初始化
│  │  ├─ repositories/    Prisma 資料查詢封裝
│  │  ├─ plugins/         Prisma、權限驗證
│  │  └─ schemas/         Fastify 驗證 Schema
│  ├─ prisma/
│  │  ├─ schema.prisma    資料模型
│  │  └─ migrations/      SQLite 建表 Migration
│  └─ test/               API 與資料庫整合測試
└─ package.json           將啟動、測試指令轉交 backend
```

# APP開發
你用 HTML、CSS、JavaScript 做好的網頁，Capacitor 會把它包裝成：
Android App（APK／AAB）
iPhone App（iOS）
仍可保留網頁版
Capacitor 是把你的網頁專案變成手機 App 的工具。

## 驗證規則

- 預設不執行完整測試、建置、端對端測試、視覺測試或效能測試。
- 優先使用靜態檢查、語法檢查或最小必要啟動驗證。
- 僅在我明確要求，或修改內容可能造成資料遺失、資料庫結構異動、登入／權限或付款功能風險時，才執行完整測試。
- 若驗證需要大量時間，先完成程式修改並回報，不要自行等待長時間測試。