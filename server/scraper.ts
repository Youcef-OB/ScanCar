import fs from 'fs/promises';
import path from 'path';
import { chromium, devices } from 'playwright';
import { SearchFilters, CarListing } from '../shared/types.js';
import { applyScoring } from './scoring.js';
import { loadDefaultFilters } from './config.js';

const DATA_PATH = path.resolve('data/listings.json');
const USER_AGENTS = [
  devices['Desktop Chrome']?.userAgent,
  devices['Desktop Edge']?.userAgent,
  devices['Desktop Safari']?.userAgent
].filter(Boolean) as string[];

function sanitizeRadius(radiusKm: number): number {
  const safeRadius = Number.isFinite(radiusKm) ? radiusKm : 30;
  return Math.min(Math.max(safeRadius, 5), 500);
}

function buildLocation(filters: SearchFilters): string | undefined {
  const city = filters.city?.trim();
  if (!city) return undefined;

  const radiusMeters = sanitizeRadius(filters.radiusKm) * 1000;
  const locations = [
    {
      locationType: 'city',
      city,
      geoRadius: radiusMeters
    }
  ];

  return JSON.stringify(locations);
}

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

  const locations = buildLocation(filters);
  if (locations) {
    params.set('search_in', 'around');
    params.set('locations', locations);
  }

  return `${base}?${params.toString()}`;
}

async function extractListings(filters: SearchFilters): Promise<CarListing[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? devices['Desktop Chrome'].userAgent,
    viewport: { width: 1366, height: 768 },
    locale: 'fr-FR'
  });
  const page = await context.newPage();

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fr-FR,fr;q=0.9'
  });

  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type)) return route.abort();
    return route.continue();
  });

  try {
    const searchUrl = buildSearchUrl(filters);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200 + Math.random() * 1000);
    await page.waitForSelector('[data-qa-id="aditem_container"]', { timeout: 12000 }).catch(() => undefined);

    const htmlSnapshot = await page.content();
    if (/captcha/i.test(htmlSnapshot) || /trop de demandes/i.test(htmlSnapshot)) {
      throw new Error('Accès restreint par Leboncoin : captcha ou limitation détectée');
    }

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
    await page.waitForTimeout(500 + Math.random() * 800);
    await context.close();
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
