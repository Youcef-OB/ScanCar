import express, { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import schedule from 'node-schedule';
import { runScraper } from './scraper.js';
import { CarListing } from '../shared/types.js';
import { loadDefaultFilters, validateFilters } from './config.js';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.resolve('data/listings.json');
const CLIENT_PATH = path.resolve('dist/client');
const SCRAPE_CRON = process.env.SCRAPE_SCHEDULE_CRON || '0 2 * * *';

app.use(express.json());
app.use(express.static(CLIENT_PATH));

function asyncHandler<TReq extends Request, TRes extends Response>(
  handler: (req: TReq, res: TRes, next: NextFunction) => Promise<unknown>
) {
  return (req: TReq, res: TRes, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

app.get(
  '/api/listings',
  asyncHandler(async (_req, res) => {
    const raw = await fs.readFile(DATA_PATH, 'utf-8').catch(() => '[]');
    const listings: CarListing[] = JSON.parse(raw);
    res.json(listings);
  })
);

app.get(
  '/api/filters',
  asyncHandler(async (_req, res) => {
    const filters = await loadDefaultFilters();
    res.json(filters);
  })
);

app.post(
  '/api/search',
  asyncHandler(async (req, res) => {
    const filters = validateFilters(req.body);
    const listings = await runScraper(filters);
    res.json(listings);
  })
);

app.get('/api/filters', (_req, res) => {
  try {
    const filters = loadFilters();
    res.json(filters);
  } catch (err) {
    console.error('Failed to read filter config', err);
    res.status(500).json({ error: 'Unable to load default filters' });
  }
});

function coerceFilters(payload: unknown): SearchFilters | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Partial<SearchFilters>;

  const requiredStrings = ['brand', 'model', 'region'] as const;
  if (!requiredStrings.every((key) => typeof candidate[key] === 'string' && candidate[key])) {
    return null;
  }

  const numericFields = ['minPrice', 'maxPrice', 'minYear', 'maxMileage'] as const;
  const coercedNumbers: Record<(typeof numericFields)[number], number> = {
    minPrice: Number(candidate.minPrice),
    maxPrice: Number(candidate.maxPrice),
    minYear: Number(candidate.minYear),
    maxMileage: Number(candidate.maxMileage)
  };

  if (numericFields.some((key) => Number.isNaN(coercedNumbers[key]))) {
    return null;
  }

  return {
    brand: candidate.brand!,
    model: candidate.model!,
    region: candidate.region!,
    minPrice: coercedNumbers.minPrice,
    maxPrice: coercedNumbers.maxPrice,
    minYear: coercedNumbers.minYear,
    maxMileage: coercedNumbers.maxMileage
  } satisfies SearchFilters;
}

app.post('/api/search', async (req, res) => {
  const filters = coerceFilters(req.body);

  if (!filters) {
    return res.status(400).json({ error: 'Filtres invalides fournis' });
  }

  try {
    const listings = await runScraper(filters);
    res.json(listings);
  } catch (err) {
    console.error('Failed to run scraper with provided filters', err);
    res.status(500).json({ error: 'La recherche a échoué' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(CLIENT_PATH, 'index.html'));
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof SyntaxError ? 400 : 500;
  const message = err instanceof Error ? err.message : 'Unexpected error';
  console.error(message, err);
  res.status(status).json({ error: message });
};

app.use(errorHandler);

async function bootstrap() {
  await runScraper();
  schedule.scheduleJob(SCRAPE_CRON, () => {
    console.log(`Running scheduled scrape (${SCRAPE_CRON})`);
    runScraper().catch((err) => console.error('Scheduled scrape failed', err));
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start application', err);
  process.exit(1);
});
