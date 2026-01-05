import { CarListing } from '../shared/types.js';

export interface ScoredListing extends CarListing {}

export function computeAveragePrice(listings: CarListing[]): number {
  if (listings.length === 0) return 0;
  const total = listings.reduce((sum, item) => sum + item.price, 0);
  return Math.round(total / listings.length);
}

export function scoreListing(listing: CarListing, averagePrice: number): number {
  const priceWeight = 0.5;
  const mileageWeight = 0.25;
  const yearWeight = 0.25;

  const priceScore = averagePrice
    ? Math.max(0, Math.min(100, 50 + ((averagePrice - listing.price) / averagePrice) * 100))
    : 50;

  const mileageScore = listing.mileage > 0 ? Math.max(0, Math.min(100, 100 - (listing.mileage / 300000) * 100)) : 50;
  const yearScore = listing.year ? Math.max(0, Math.min(100, ((listing.year - 1995) / 30) * 100)) : 50;

  const combined = priceScore * priceWeight + mileageScore * mileageWeight + yearScore * yearWeight;
  return Math.round(combined);
}

export function applyScoring(listings: CarListing[]): CarListing[] {
  const averagePrice = computeAveragePrice(listings);
  return listings
    .map((listing) => ({
      ...listing,
      priceDelta: averagePrice ? listing.price - averagePrice : 0,
      score: scoreListing(listing, averagePrice)
    }))
    .sort((a, b) => b.score - a.score);
}
