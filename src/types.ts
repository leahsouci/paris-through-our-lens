export type Photo = {
  id: string;
  file: string;
  mid: string;
  thumb: string;
  lat: number;
  lng: number;
  takenAt: string | null;
  arrondissement: number | null;
  precision: 'gps' | 'exact' | 'approx' | null;
  place: string | null;
  quartier: string | null;
  clue: string | null;
  width: number;
  height: number;
  color: string;
  title: string;
  author: string;
  html: string;
  readMinutes: number;
  number: number;
};

export type PendingPhoto = Omit<Photo, 'lat' | 'lng'>;
