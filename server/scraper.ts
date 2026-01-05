import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { SearchFilters, CarListing } from '../shared/types.js';
import { applyScoring } from './scoring.js';
import { loadDefaultFilters } from './config.js';

const DATA_PATH = path.resolve('data/listings.json');

function buildSearchUrl(filters: SearchFilters): string {
  const base = 'https://www.leboncoin.fr/recherche';
  const params = new URLSearchParams({
    category: '2',
    text: `${filters.brand} ${filters.model}`.trim(),
    price: `${filters.minPrice}-${filters.maxPrice}`,
    reg: filters.region,
    mileage: `0-${filters.maxMileage}`,
    year: `${filters.minYear}-`,
    sort: 'date'
  });
  return `${base}?${params.toString()}`;
}

async function extractListings(filters: SearchFilters): Promise<CarListing[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const searchUrl = buildSearchUrl(filters);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('[data-qa-id="aditem_container"]', { timeout: 10000 }).catch(() => undefined);

    const listings = await page.$$eval('[data-qa-id="aditem_container"]', (cards) => {
      return cards.map((card) => {
        const title = (card.querySelector('[data-qa-id="aditem_title"]') as HTMLElement)?.innerText?.trim() || 'Annonce';
        const priceText = (card.querySelector('[data-qa-id="aditem_price"]') as HTMLElement)?.innerText?.replace(/[^0-9]/g, '') || '0';
        const price = Number(priceText);
        const details = Array.from(card.querySelectorAll('[data-qa-id="aditem_features"][data-test-id] li'))
          .map((el) => (el as HTMLElement).innerText.trim());
        const year = Number(details.find((d) => /^\d{4}$/.test(d)) || 0);
        const mileageText = details.find((d) => d.toLowerCase().includes('km')) || '0';
        const mileage = Number(mileageText.replace(/[^0-9]/g, ''));
        const location = (card.querySelector('[data-qa-id="aditem_location"]') as HTMLElement)?.innerText?.trim() || 'Inconnue';
        const image = (card.querySelector('picture img') as HTMLImageElement)?.src || '';
        const url = (card.querySelector('a[data-qa-id="aditem_container"]') as HTMLAnchorElement)?.href || '';

        return {
          id: url || `${title}-${price}`,
          title,
          price,
          year,
          mileage,
          location,
          image,
          url,
          score: 0,
          priceDelta: 0
        } satisfies CarListing;
      });
    });

    return listings.filter((item) => item.price > 0 && item.year >= filters.minYear);
  } finally {
    await browser.close();
  }
}

export async function runScraper(filters?: SearchFilters): Promise<CarListing[]> {
  const activeFilters = filters ?? (await loadDefaultFilters());
  console.log('Running scraper with filters:', activeFilters);
  const rawListings = await extractListings(activeFilters);
  const scored = applyScoring(rawListings);
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(scored, null, 2), 'utf-8');
  console.log(`Saved ${scored.length} listings to ${DATA_PATH}`);
  return scored;
}

if (process.argv[1] && process.argv[1].includes('scraper')) {
  runScraper().catch((err) => {
    console.error('Scraping failed', err);
    process.exit(1);
  });
}
