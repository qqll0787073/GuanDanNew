import { fetchRooms } from '../lib/rooms';

async function logRooms() {
  try {
    const rooms = await fetchRooms();
    console.log('Fetched Guandan rooms:', rooms);
  } catch (error) {
    console.error('Failed to fetch Guandan rooms:', error);
  }
}

void logRooms();
