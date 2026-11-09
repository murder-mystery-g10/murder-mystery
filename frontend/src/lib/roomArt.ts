const images = import.meta.glob<string>('../../../themes/*/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})

const names: Partial<Record<string, string>> = {
  hall: 'Hol',
  library: 'Bibliotecă',
  kitchen: 'Bucătărie',
  master_bedroom: 'Dormitorul principal',
  guest_room: 'Camera de oaspeți',
  greenhouse: 'Seră',
  station: 'Secția de poliție',
}

export function roomName(room: string): string {
  return names[room] ?? room.replaceAll('_', ' ')
}

export function roomImage(theme: string, room: string): string | undefined {
  const file = room === 'station' ? 'interrogation_room' : room
  return images[`../../../themes/${theme}/${file}.webp`]
}
