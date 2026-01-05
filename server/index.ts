import express from 'express';
import path from 'path';
import fs from 'fs';
import schedule from 'node-schedule';
import { loadFilters, runScraper } from './scraper.js';
import { CarListing, SearchFilters } from '../shared/types.js';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.resolve('data/listings.json');
const CLIENT_PATH = path.resolve('dist/client');

app.use(express.json());
app.use(express.static(CLIENT_PATH));

app.get('/api/listings', (_req, res) => {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    const listings: CarListing[] = JSON.parse(raw);
    res.json(listings);
  } catch (err) {
    console.error('Failed to read listings file', err);
    res.status(500).json({ error: 'Unable to read listings file' });
  }
});

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

async function bootstrap() {
  await runScraper();
  schedule.scheduleJob('0 2 * * *', () => {
    console.log('Running scheduled daily scrape at 02:00');
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
