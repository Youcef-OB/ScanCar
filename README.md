# ScanCar

Application locale (React + Node) qui scanne Leboncoin, analyse les annonces auto et les classe par pertinence.

## Prérequis
- Node.js 18+ (Playwright télécharge automatiquement Chromium lors de l'installation).

## Installation et démarrage
```bash
npm install
npm run start
```
Le script `start` construit le front, lance le serveur Node (port 3000) et exécute automatiquement un scraping initial. Une tâche planifiée relance le scraping chaque jour à 02:00.

## Structure
- `config.json` : filtres de recherche (marque, modèle, prix, année, kilométrage, région).
- `server/` : serveur Express, planificateur et scraper Playwright.
- `shared/` : types TypeScript partagés front/back.
- `data/listings.json` : stockage local des annonces scorées.
- `src/` : interface React (Vite) affichant les cartes d'annonces.

## Configuration des filtres
Modifiez `config.json` :
```json
{
  "brand": "Renault",
  "model": "Clio",
  "minPrice": 2000,
  "maxPrice": 12000,
  "minYear": 2012,
  "maxMileage": 150000,
  "region": "ile_de_france"
}
```
Les valeurs alimentent l'URL de recherche Leboncoin et filtrent les résultats côté analyse.

## Fonctionnement
1. **Scraping** : Playwright (Chromium headless) ouvre l'URL de recherche Leboncoin construite à partir des filtres, extrait les cartes (titre, prix, année, kilométrage, localisation, image, lien).
2. **Analyse marché** : calcul du prix moyen de toutes les annonces collectées.
3. **Scoring** : chaque annonce reçoit un score 0–100 pondérant prix (50%), kilométrage (25%), année (25%). Moins cher que la moyenne = meilleur score. L'écart de prix vs. moyenne est conservé.
4. **Tri & stockage** : classement décroissant par score puis sauvegarde dans `data/listings.json`.
5. **API locale** : `GET /api/listings` renvoie les données stockées.
6. **UI** : React affiche des cartes avec photo, prix, badge de score coloré, specs clés et bouton vers Leboncoin.

## Scripts utiles
- `npm run dev` : lancer uniquement le front Vite (port 5173).
- `npm run scrape` : exécuter manuellement le scraping sans démarrer le serveur.
- `npm run build` : construire le front et compiler le back.

## Notes
- Le scraping nécessite un accès réseau à Leboncoin et peut varier si le site change de structure.
- Toutes les données restent en local (JSON), aucune API externe n'est utilisée.
