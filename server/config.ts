import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { SearchFilters } from '../shared/types.js';

const CONFIG_PATH = path.resolve('config.json');

const baseFiltersSchema = z.object({
  brand: z.string().min(1, 'brand is required'),
  model: z.string().min(1, 'model is required'),
  minPrice: z.number().int().nonnegative(),
  maxPrice: z.number().int().positive(),
  minYear: z.number().int().min(1900),
  maxMileage: z.number().int().nonnegative(),
  region: z.string().min(1, 'region is required'),
  city: z.string().trim().default(''),
  radiusKm: z.number().int().positive().max(500).default(30)
});

const searchFiltersSchema = baseFiltersSchema.refine(
  (value) => value.maxPrice >= value.minPrice,
  {
    message: 'maxPrice must be greater than or equal to minPrice',
    path: ['maxPrice']
  }
);

let cachedFilters: SearchFilters | null = null;

export function validateFilters(payload: unknown): SearchFilters {
  return searchFiltersSchema.parse(payload);
}

export async function loadDefaultFilters(): Promise<SearchFilters> {
  if (cachedFilters) return cachedFilters;

  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedFilters = validateFilters(parsed);
    return cachedFilters;
  } catch (error) {
    throw new Error(`Unable to load or validate default filters from ${CONFIG_PATH}: ${String(error)}`);
  }
}
