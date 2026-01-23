import { openDB } from 'idb';
import { ProjectState } from '../types';

const DB_NAME = 'spriteslice-db';
const STORE_NAME = 'project';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME);
  },
});

export const saveProject = async (state: ProjectState) => {
  const db = await dbPromise;
  await db.put(STORE_NAME, state, 'current');
};

export const loadProject = async (): Promise<ProjectState | undefined> => {
  const db = await dbPromise;
  return await db.get(STORE_NAME, 'current');
};

export const clearProject = async () => {
  const db = await dbPromise;
  await db.delete(STORE_NAME, 'current');
};