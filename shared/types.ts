export interface SearchFilters {
  brand: string;
  model: string;
  minPrice: number;
  maxPrice: number;
  minYear: number;
  maxMileage: number;
  region: string;
  city: string;
  radiusKm: number;
}

export interface CarListing {
  id: string;
  title: string;
  price: number;
  year: number;
  mileage: number;
  location: string;
  image: string;
  url: string;
  score: number;
  priceDelta: number;
}
