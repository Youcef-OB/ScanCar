import React, { useEffect, useMemo, useState } from 'react';
import ListingCard from './components/ListingCard';
import { CarListing, SearchFilters } from '../shared/types';

const App: React.FC = () => {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    brand: '',
    model: '',
    minPrice: 0,
    maxPrice: 0,
    minYear: 0,
    maxMileage: 0,
    region: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const numericFields: (keyof SearchFilters)[] = useMemo(
    () => ['minPrice', 'maxPrice', 'minYear', 'maxMileage'],
    []
  );

  useEffect(() => {
    fetch('/api/filters')
      .then((res) => res.json())
      .then((data: SearchFilters) => {
        setFilters(data);
      })
      .catch((err) => {
        console.error('Failed to load default filters', err);
      });
  }, []);

  useEffect(() => {
    fetch('/api/listings')
      .then((res) => res.json())
      .then((data: CarListing[]) => {
        setListings(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Impossible de charger les annonces');
        setLoading(false);
      });
  }, []);

  const handleInputChange = (field: keyof SearchFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: numericFields.includes(field) ? Number(value) : value
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearching(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(filters)
      });

      if (!response.ok) {
        throw new Error('Recherche indisponible');
      }

      const data = (await response.json()) as CarListing[];
      setListings(data);
    } catch (err) {
      console.error(err);
      setError('La recherche a échoué. Merci de réessayer.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <main className="container">
      <header className="hero">
        <div>
          <p className="eyebrow">ScanCar · Leboncoin</p>
          <h1>Les meilleures offres auto, analysées pour vous</h1>
          <p className="lead">
            La collecte s’exécute au démarrage puis chaque jour automatiquement. Les annonces sont triées selon un
            score combinant prix, kilométrage et année.
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Filtres dynamiques</p>
            <h2>Relancez une recherche sans toucher au config.json</h2>
            <p className="lead">Saisissez vos critères, lancez le scraping et consultez les nouveaux résultats en direct.</p>
          </div>
          <button className="cta" type="submit" form="search-form" disabled={searching}>
            {searching ? 'Recherche en cours…' : 'Lancer la recherche'}
          </button>
        </div>

        <form id="search-form" className="form-grid" onSubmit={handleSubmit}>
          <label>
            Marque
            <input
              type="text"
              value={filters.brand}
              onChange={(e) => handleInputChange('brand', e.target.value)}
              required
            />
          </label>
          <label>
            Modèle
            <input
              type="text"
              value={filters.model}
              onChange={(e) => handleInputChange('model', e.target.value)}
              required
            />
          </label>
          <label>
            Prix min (€)
            <input
              type="number"
              min={0}
              value={filters.minPrice}
              onChange={(e) => handleInputChange('minPrice', e.target.value)}
              required
            />
          </label>
          <label>
            Prix max (€)
            <input
              type="number"
              min={0}
              value={filters.maxPrice}
              onChange={(e) => handleInputChange('maxPrice', e.target.value)}
              required
            />
          </label>
          <label>
            Année min
            <input
              type="number"
              min={1990}
              value={filters.minYear}
              onChange={(e) => handleInputChange('minYear', e.target.value)}
              required
            />
          </label>
          <label>
            Kilométrage max (km)
            <input
              type="number"
              min={0}
              value={filters.maxMileage}
              onChange={(e) => handleInputChange('maxMileage', e.target.value)}
              required
            />
          </label>
          <label>
            Région (code Leboncoin)
            <input
              type="text"
              value={filters.region}
              onChange={(e) => handleInputChange('region', e.target.value)}
              placeholder="ex: 21 pour Grand Est"
              required
            />
          </label>
        </form>
      </section>

      {loading && <p>Chargement des annonces…</p>}
      {error && <p className="error">{error}</p>}

      <section className="grid">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </section>

      {!loading && listings.length === 0 && <p>Aucune annonce ne correspond aux filtres pour le moment.</p>}
    </main>
  );
};

export default App;
