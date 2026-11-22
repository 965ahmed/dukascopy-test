import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHistoricalRates } from 'dukascopy-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// max range allowed (days) — M15 = 96 candles/day, 60 days ≈ 5760 candles
const MAX_DAYS = 60;

// simple in-memory cache: key -> { expires, payload }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

// CORS مفتوح عمدًا: واجهة Perchance تعمل من دومين مختلف (perchance.org)
// والسيرفر سيكون على دومين آخر (مثل xxx.onrender.com)، لذلك يجب
// السماح بطلبات cross-origin — لا تقيّد origin إلا إذا عرفت دومين الواجهة.
app.use(cors());
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, 'public')));

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// GET /api/gold?from=2026-11-18&to=2026-11-21
// NOTE: `to` is exclusive (same convention as dukascopy-node dates.to)
app.get('/api/gold', async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;

    if (!isValidDateStr(from) || !isValidDateStr(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dates. Use format YYYY-MM-DD, e.g. /api/gold?from=2026-11-18&to=2026-11-21'
      });
    }

    const fromDate = new Date(from + 'T00:00:00Z');
    const toDate = new Date(to + 'T00:00:00Z');

    if (fromDate >= toDate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid range: `from` must be before `to` (`to` is exclusive).'
      });
    }

    const days = (toDate - fromDate) / (24 * 3600 * 1000);
    if (days > MAX_DAYS) {
      return res.status(400).json({
        success: false,
        error: `Range too large (${days} days). Max allowed is ${MAX_DAYS} days for M15. Split into smaller requests.`
      });
    }

    const cacheKey = `${from}_${to}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return res.json({ ...cached.payload, cached: true });
    }

    // Dukascopy historical M15 candles for Gold
    const raw = await getHistoricalRates({
      instrument: 'xauusd',
      dates: { from: fromDate, to: toDate },
      timeframe: 'm15',
      format: 'json'
    });

    const rows = Array.isArray(raw) ? raw : [];
    // normalize + sort ascending by timestamp
    const data = rows
      .map((c) => ({
        timestamp: Number(c.timestamp),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: c.volume !== undefined ? Number(c.volume) : undefined
      }))
      .filter((c) => Number.isFinite(c.timestamp) && Number.isFinite(c.close))
      .sort((a, b) => a.timestamp - b.timestamp);

    console.log({
      requestedFrom: from,
      requestedTo: to,
      count: data.length,
      first: data[0],
      last: data[data.length - 1]
    });

    const payload = {
      success: true,
      instrument: 'XAU/USD',
      timeframe: 'M15',
      from,
      to,
      count: data.length,
      data
    };

    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, payload });
    // keep cache small
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    res.json(payload);
  } catch (error) {
    console.error('[api/gold]', error);
    const msg =
      error?.code === 'DUKASCOPY_ACCESS_DENIED'
        ? 'Dukascopy denied the request (HTTP 403 / WAF). Try again later, or run `npx dukascopy-node --install-browser` if it persists.'
        : error?.message || 'Failed to fetch data from Dukascopy';
    res.status(500).json({ success: false, error: msg });
  }
});

// fallback to index.html for "/"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Dukascopy Gold Tester running at http://localhost:${PORT}`);
  console.log(`   API example: http://localhost:${PORT}/api/gold?from=2026-11-18&to=2026-11-21`);
});
