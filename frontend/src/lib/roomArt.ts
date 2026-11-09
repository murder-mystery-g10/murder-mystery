const images = import.meta.glob<string>('../../../themes/*/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})

const names: Partial<Record<string, string>> = {
  hall: 'Hall',
  library: 'Library',
  kitchen: 'Kitchen',
  master_bedroom: 'Master bedroom',
  guest_room: 'Guest room',
  greenhouse: 'Greenhouse',
  station: 'Police station',
}

export function roomName(room: string): string {
  return names[room] ?? room.replaceAll('_', ' ')
}

export function roomImage(theme: string, room: string, imagePath?: string): string | undefined {
  const file = room === 'station' ? 'interrogation_room' : room
  return images[`../../../themes/${theme}/${imagePath ?? `${file}.webp`}`]
}
