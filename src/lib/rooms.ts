import { supabase } from './supabase';

export type Room = {
  id: number;
  room_order: number;
  room_name_en: string;
  room_name_zh: string;
  max_players: number;
  current_player_count: number;
  status: string;
  is_active: boolean;
};

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select(
      'id, room_order, room_name_en, room_name_zh, max_players, current_player_count, status, is_active'
    )
    .order('room_order', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Room[];
}
