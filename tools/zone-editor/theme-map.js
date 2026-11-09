// Required object IDs from themes/conac/README.md. This is a blank template for tracing.
const CONAC_ROOMS = [
  {
    id: 'hall',
    name: 'Hall',
    objects: [
      ['mail_tray', 'Mail tray'],
      ['victor_coat', 'Victor\'s coat'],
      ['doctor_coat', 'The doctor\'s coat'],
      ['back_door', 'Back door'],
      ['guest_register', 'Guest register'],
    ],
  },
  {
    id: 'library',
    name: 'Library',
    objects: [
      ['journal', 'Ledgers on the desk'],
      ['blotter', 'Blotter'],
      ['medicine_bottle', 'Medicine bottle'],
      ['drawer', 'Desk drawer'],
      ['armchair', 'Armchair'],
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    objects: [
      ['tea_tray', 'Tea tray'],
      ['key_board', 'Key board'],
      ['gardener_notebook', 'Gardener\'s notebook'],
      ['calendar', 'Calendar'],
      ['stove', 'Stove'],
    ],
  },
  {
    id: 'master_bedroom',
    name: 'Master bedroom',
    objects: [
      ['desk', 'Desk'],
      ['desk_drawer', 'Desk drawer'],
      ['wedding_photo', 'Wedding photo'],
      ['nightstand', 'Nightstand'],
    ],
  },
  {
    id: 'guest_room',
    name: 'Guest room',
    objects: [
      ['medical_bag', 'Medical bag'],
      ['briefcase', 'Briefcase'],
      ['nightstand', 'Nightstand'],
    ],
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    objects: [
      ['foxglove_pots', 'Foxglove pots'],
      ['empty_pot', 'Empty pot'],
      ['chair', 'Greenhouse armchair'],
    ],
  },
]

function createManorMap() {
  return {
    schema_version: 1,
    theme_id: 'conac',
    name: 'The Manor',
    station_image: 'interrogation_room.webp',
    rooms: CONAC_ROOMS.map(({ id, name }) => ({ id, name, image: `${id}.webp`, objects: [] })),
  }
}

const validId = /^[A-Za-z0-9_.-]{1,64}$/

function requireMap(condition, message) {
  if (!condition) throw new Error(message)
}

function requireFields(value, required, optional, label) {
  requireMap(
    value && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object.`,
  )
  for (const key of required) {
    requireMap(Object.hasOwn(value, key), `${label} is missing ${key}.`)
  }
  for (const key of Object.keys(value)) {
    requireMap(
      required.includes(key) || optional.includes(key),
      `${label} has an unknown field: ${key}.`,
    )
  }
}

function requireId(id, label) {
  requireMap(
    typeof id === 'string' && validId.test(id),
    `${label} must be 1–64 letters, digits, dots, underscores or hyphens.`,
  )
}

function requireUniqueId(id, ids, label) {
  requireId(id, `${label} ID`)
  requireMap(!ids.has(id), `Duplicate ${label} ID: ${id}.`)
  ids.add(id)
}

function requirePolygon(points, label) {
  requireMap(Array.isArray(points) && points.length >= 3, `${label} needs at least three points.`)
  for (const point of points) {
    requireFields(point, ['x', 'y'], [], `${label} point`)
    for (const coordinate of [point.x, point.y]) {
      requireMap(
        Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 100,
        `${label} coordinates must be between 0 and 100.`,
      )
    }
  }
}

// Mirror the checked-in ThemeMap contract and its cross-room reference rules.
function validateThemeMap(map) {
  requireFields(
    map,
    ['theme_id', 'name', 'station_image', 'rooms'],
    ['schema_version'],
    'Theme map',
  )
  requireMap(
    !Object.hasOwn(map, 'schema_version') || map.schema_version === 1,
    'Only schema version 1 is supported.',
  )
  requireId(map.theme_id, 'Theme ID')
  requireMap(
    typeof map.name === 'string' && typeof map.station_image === 'string',
    'Theme name and station image must be text.',
  )
  requireMap(Array.isArray(map.rooms) && map.rooms.length > 0, 'The map needs at least one room.')

  const roomIds = new Set()
  const objectIds = new Set()
  const doorIds = new Set()
  for (const room of map.rooms) {
    requireFields(room, ['id', 'name', 'image', 'objects'], ['doors'], 'Room')
    requireUniqueId(room.id, roomIds, 'room')
    requireMap(
      room.id !== 'station',
      'The station is a separate location, so it cannot be a map room.',
    )
    requireMap(
      typeof room.name === 'string' && typeof room.image === 'string',
      `${room.id}: room name and image path must be text.`,
    )
    requireMap(Array.isArray(room.objects), `${room.id}: objects must be a list.`)
    requireMap(
      !Object.hasOwn(room, 'doors') || Array.isArray(room.doors),
      `${room.id}: doors must be a list.`,
    )
  }

  for (const room of map.rooms) {
    for (const object of room.objects) {
      requireFields(object, ['id', 'name', 'zone'], [], 'Object')
      requireUniqueId(object.id, objectIds, 'object')
      requireMap(typeof object.name === 'string', `${object.id}: display name must be text.`)
      requirePolygon(object.zone, object.id)
    }
    for (const door of room.doors ?? []) {
      requireFields(door, ['id', 'to', 'zone'], [], 'Door')
      requireUniqueId(door.id, doorIds, 'door')
      requireMap(
        roomIds.has(door.to) && door.to !== room.id,
        `${door.id}: choose another room in the map as the destination.`,
      )
      requirePolygon(door.zone, door.id)
    }
  }
}
