const statusElement = document.getElementById('rooms-console-status');

function setStatus(message: string) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

async function logRooms() {
  try {
    const { fetchRooms } = await import('../lib/rooms');
    const rooms = await fetchRooms();
    setStatus(`Loaded ${rooms.length} rooms`);
    console.log('Fetched Guandan rooms:', rooms);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(message);
    console.error('Failed to fetch Guandan rooms:', error);
  }
}

void logRooms();
