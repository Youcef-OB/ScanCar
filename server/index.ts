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
    res.json(await loadCachedListings());
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

async function loadCachedListings(): Promise<CarListing[]> {
  const raw = await fs.readFile(DATA_PATH, 'utf-8').catch(() => '[]');
  return JSON.parse(raw);
}

async function runInitialScrape(): Promise<void> {
  try {
    await runScraper();
  } catch (err) {
    console.error('Initial scrape failed, falling back to cached listings', err);
    const cached = await loadCachedListings();
    console.log(`Serving ${cached.length} cached listing(s) until the next successful scrape.`);
  }
}

async function bootstrap() {
  await runInitialScrape();
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
