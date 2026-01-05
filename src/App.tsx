import React, { useEffect, useState } from 'react';
import ListingCard from './components/ListingCard';
import { CarListing } from '../shared/types';

const App: React.FC = () => {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
