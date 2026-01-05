import express from 'express';
import path from 'path';
import fs from 'fs';
import schedule from 'node-schedule';
import { runScraper } from './scraper.js';
import { CarListing } from '../shared/types.js';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.resolve('data/listings.json');
const CLIENT_PATH = path.resolve('dist/client');

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
