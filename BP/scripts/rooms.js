// FNAF 1 room layout. Room id 0 = unassigned.
// Kept small so it fits in block state (max 16 values per state).
export const FNAF1_ROOMS = [
  { id: 1, name: "Show Stage" },
  { id: 2, name: "Dining Area" },
  { id: 3, name: "Pirate Cove" },
  { id: 4, name: "West Hall" },
  { id: 5, name: "W. Hall Corner" },
  { id: 6, name: "Supply Closet" },
  { id: 7, name: "East Hall" },
  { id: 8, name: "E. Hall Corner" },
  { id: 9, name: "Backstage" },
  { id: 10, name: "Kitchen" },
  { id: 11, name: "Restrooms" },
];

export function roomName(id) {
  if (id === 0) return "Unassigned";
  const r = FNAF1_ROOMS.find(r => r.id === id);
  return r ? r.name : `Room ${id}`;
}
