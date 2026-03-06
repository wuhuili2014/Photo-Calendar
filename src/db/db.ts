import Dexie, { type EntityTable } from 'dexie';

interface Photo {
  date: string; // Format: YYYY-MM-DD
  data: Blob;
  mimeType: string;
}

const db = new Dexie('PhotoCalendarDB') as Dexie & {
  photos: EntityTable<Photo, 'date'>;
};

db.version(1).stores({
  photos: 'date' // Primary key is date
});

export { db };
export type { Photo };
