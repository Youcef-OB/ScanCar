import React from 'react';
import { CarListing } from '../../shared/types';
import './ListingCard.css';

interface Props {
  listing: CarListing;
}

const ListingCard: React.FC<Props> = ({ listing }) => {
  const scoreColor = listing.score >= 75 ? 'success' : listing.score >= 50 ? 'warning' : 'danger';

  return (
    <div className="card">
      <div className="card-image" style={{ backgroundImage: `url(${listing.image || '/placeholder.svg'})` }} />
      <div className="card-body">
        <div className="card-header">
          <h3>{listing.title}</h3>
          <span className={`badge ${scoreColor}`}>{listing.score}</span>
        </div>
        <p className="price">{listing.price.toLocaleString('fr-FR')} €</p>
        <ul className="meta">
          <li><strong>Année :</strong> {listing.year}</li>
          <li><strong>Kilométrage :</strong> {listing.mileage.toLocaleString('fr-FR')} km</li>
          <li><strong>Localisation :</strong> {listing.location}</li>
          <li><strong>Écart vs marché :</strong> {listing.priceDelta > 0 ? '+' : ''}{listing.priceDelta.toLocaleString('fr-FR')} €</li>
        </ul>
        <a className="cta" href={listing.url} target="_blank" rel="noreferrer">
          Voir sur Leboncoin
        </a>
      </div>
    </div>
  );
};

export default ListingCard;
