# Dukascopy Gold Tester 🥇

XAU/USD · 15 Minutes · Historical Data — تطبيق Node.js + Express + واجهة عربية.

## هيكل المشروع

```
dukascopy-test/
├── server.js
└── public/
    └── index.html
```

(داخل هذا المولّد الملفات موجودة تحت `src/` بنفس الهيكل:
`src/server.js` + `src/public/index.html`)

## التشغيل (3 أوامر فقط)

```bash
npm install
npm start
```

ثم افتح في المتصفح:

```
http://localhost:3000
```

مثال API مباشر:

```
http://localhost:3000/api/gold?from=2026-11-18&to=2026-11-21
```

> ملاحظة: `to` غير شامل (exclusive) — نفس convention مكتبة dukascopy-node.

## المتطلبات

- Node.js 20 أو أحدث (`node -v`)
- إنترنت (السيرفر يجلب البيانات من Dukascopy)

## كيف يعمل؟

`server.js` يستخدم مكتبة `dukascopy-node`:

```js
import { getHistoricalRates } from 'dukascopy-node';

const data = await getHistoricalRates({
  instrument: 'xauusd',
  dates: { from: new Date('2026-11-18'), to: new Date('2026-11-21') },
  timeframe: 'm15',
  format: 'json'
});
// => [{ timestamp, open, high, low, close, volume }, ...]
```

والواجهة `public/index.html` تنادي:

```
GET /api/gold?from=YYYY-MM-DD&to=YYYY-MM-DD
```

## حدود

- أقصى مدة لكل طلب: **60 يوم** (M15 ≈ 96 شمعة/يوم). قسّم الفترات الأكبر لطلبات متعددة.
- يوجد cache في الذاكرة لمدة 5 دقائق لنفس الفترة.
- إذا ظهر خطأ `403 / DUKASCOPY_ACCESS_DENIED` فهذا حجب WAF من Dukascopy — انتظر قليلاً وحاول مجدداً.

## أوامر مفيدة

```bash
npm run dev     # تشغيل مع auto-reload (node --watch)
```

## نشر

- `PORT` يؤخذ من البيئة تلقائياً (`process.env.PORT || 3000`) — يعمل على Render / Railway / VPS بدون تعديل.
- لا حاجة لبناء (build) — ملف واحد + مجلد public.
- **لواجهة Perchance:** اتبع خطوات `DEPLOY.md` (النشر على Render)، ثم ضع رابط
  السيرفر في الثابت `API_BASE_URL` أعلى وسم `<script>` في كود Perchance.
