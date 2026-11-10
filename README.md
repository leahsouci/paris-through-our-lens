# Paris, à pied

Une promenade continue, en une seule page, à travers 22 photos prises dans Paris (projet de classe).
Chaque photo est un chapitre : on marche jusqu'au lieu sur un plan de Paris à l'encre, on remonte le temps
avec une scène écrite à la première personne sur une œuvre d'époque, puis on retrouve la photo d'aujourd'hui.

Stack : React + TypeScript + Vite, MapLibre GL (tuiles OpenFreeMap), GSAP ScrollTrigger, Lenis. Site 100 % statique.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm run preview   # version de production, http://localhost:4173
```

## Données

| Fichier | Rôle |
| --- | --- |
| `photos-raw/` | Photos originales (JPEG/HEIC). |
| `src/data/locations.json` | Titre, coordonnées et ordre de marche (`step`) de chaque photo. |
| `src/data/chapters.json` | Ordre de la promenade, textes (scène d'époque `scene`, texte d'aujourd'hui `text`, note historique), œuvre de fond. |
| `src/data/walk.json` | Trajets à pied entre les étapes (généré). |
| `public/art/` | Œuvres d'époque en WebP (générées depuis Wikimedia Commons, domaine public / CC0 / licences libres). |

## Scripts

```bash
npm run import-photos   # photos-raw -> WebP optimisés + src/data/photos.json (lit le GPS EXIF s'il existe)
npm run walk-route      # recalcule les trajets à pied (OpenStreetMap) et les noms de rues
npm run fetch-art       # télécharge les œuvres de fond listées dans chapters.json + crédits
```

## Localisation des photos

Les photos envoyées par WhatsApp ont perdu leurs données GPS. Six lieux ont été retrouvés à partir de ce que
montrent les images ; les autres sont marqués « lieu encore à retrouver ». Pour en placer une : ajouter `lat`/`lng`
(et éventuellement `step`) dans `src/data/locations.json`, puis relancer `npm run import-photos` et `npm run walk-route`.
Envoyer les originaux (AirDrop, Drive, mail en taille réelle) permet de lire le GPS automatiquement.

## Hébergement

`.github/workflows/deploy.yml` construit le site et le publie sur GitHub Pages à chaque push sur `main`.
