const byId = (id) => document.getElementById(id)
const roomSelect = byId('room-select')
const image = byId('room-image')
const stage = byId('stage')
const overlay = byId('overlay')
const form = byId('zone-form')
const zoneId = byId('zone-id')
const zoneName = byId('zone-name')
const doorTarget = byId('door-target')

let map = createManorMap()
let roomIndex = 0
let dirty = false
let draft = null
let draggedPoint = null
const localPreviews = new Map()

const currentRoom = () => map.rooms[roomIndex]
const collection = (type) => (type === 'object' ? 'objects' : 'doors')

function report(message, error = false) {
  const status = byId('status')
  status.textContent = message
  status.classList.toggle('error', error)
}

function button(text, onClick, className = '') {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = text
  element.className = className
  element.addEventListener('click', onClick)
  return element
}

function svgElement(tag, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
  return element
}

const svgPoints = (points) => points.map(({ x, y }) => `${x},${y}`).join(' ')

function renderOverlay() {
  const room = currentRoom()
  overlay.replaceChildren()
  overlay.classList.toggle('drawing', Boolean(draft))

  for (const type of ['object', 'door']) {
    for (const [index, zone] of (room[collection(type)] ?? []).entries()) {
      if (draft?.type === type && draft.index === index) continue
      const shape = svgElement('polygon', {
        points: svgPoints(zone.zone),
        class: `saved-shape ${type}`,
      })
      shape.addEventListener('click', () => startDraft(type, index))
      shape.append(svgElement('title', {}))
      shape.firstChild.textContent = zone.id
      overlay.append(shape)
    }
  }

  if (!draft) return
  overlay.append(
    svgElement(draft.points.length >= 3 ? 'polygon' : 'polyline', {
      points: svgPoints(draft.points),
      class: 'draft-shape',
    }),
  )
  for (const [index, { x, y }] of draft.points.entries()) {
    overlay.append(
      svgElement('circle', { cx: x, cy: y, r: 0.5, class: 'vertex', 'data-vertex': index }),
    )
  }
}

function requiredObjects(roomId) {
  if (map.theme_id !== 'conac') return []
  const preset = CONAC_ROOMS.find((room) => room.id === roomId)
  return (preset?.objects ?? []).map(([id, name]) => ({ id: `${roomId}.${id}`, name }))
}

function renderZoneLists() {
  const room = currentRoom()
  const zoneList = byId('zone-list')
  zoneList.replaceChildren()
  for (const type of ['object', 'door']) {
    for (const [index, zone] of (room[collection(type)] ?? []).entries()) {
      const item = document.createElement('li')
      const edit = button(zone.id, () => startDraft(type, index), `zone-button ${type}`)
      edit.title = type === 'object' ? zone.name : `Door to ${zone.to}`
      edit.disabled = Boolean(draft) || stage.hidden
      item.append(edit)
      zoneList.append(item)
    }
  }
  const count = zoneList.children.length
  byId('zone-count').textContent = count
  byId('empty-zones').hidden = count > 0

  const required = requiredObjects(room.id)
  const missing = required.filter(({ id }) => !room.objects.some((object) => object.id === id))
  byId('required-objects').hidden = required.length === 0
  byId('required-summary').textContent =
    `Required objects (${required.length - missing.length}/${required.length})`
  const requiredList = byId('required-list')
  requiredList.replaceChildren()
  for (const object of missing) {
    const item = document.createElement('li')
    const add = button(`+ ${object.id}`, () => startDraft('object', null, object), 'suggestion')
    add.title = object.name
    add.disabled = Boolean(draft) || stage.hidden
    item.append(add)
    requiredList.append(item)
  }
}

function updatePoints() {
  const count = draft?.points.length ?? 0
  byId('point-count').textContent =
    `${count} ${count === 1 ? 'point' : 'points'} · at least 3 required`
  byId('undo-point').disabled = count === 0
  byId('redraw').disabled = count === 0
  byId('save-zone').disabled = count < 3
  renderOverlay()
}

function updateControls() {
  form.hidden = draft === null
  byId('zone-actions').hidden = draft !== null
  roomSelect.disabled = Boolean(draft)
  byId('import-map').disabled = Boolean(draft)
  byId('export-map').disabled = Boolean(draft)
  byId('preview-image').disabled = Boolean(draft)
  byId('new-object').disabled = stage.hidden
  byId('new-door').disabled = stage.hidden || map.rooms.length < 2
  byId('drawing-help').textContent = draft
    ? 'Click to place points around the object or door. Drag points to adjust.'
    : 'Choose an object or door to start drawing.'
  renderZoneLists()
  updatePoints()
}

function imageUrl(room) {
  if (localPreviews.has(room.id)) return localPreviews.get(room.id)

  // Map image paths are relative to the theme folder. Preview files stay inside that folder.
  const parts = room.image.replaceAll('\\', '/').split('/')
  if (
    ['.', '..'].includes(map.theme_id) ||
    parts.some((part) => !part || part === '.' || part === '..')
  )
    return null
  const path = parts.map(encodeURIComponent).join('/')
  return `../../themes/${encodeURIComponent(map.theme_id)}/${path}`
}

function showImage() {
  stage.hidden = false
  byId('image-message').hidden = true
  byId('image-info').textContent =
    `${currentRoom().image} · ${image.naturalWidth} × ${image.naturalHeight}`
  updateControls()
}

function showMissingImage() {
  stage.hidden = true
  byId('image-message').hidden = false
  byId('image-message').textContent =
    'Room image unavailable. Use Preview image to open the local file.'
  updateControls()
}

function renderRoom() {
  const room = currentRoom()
  stage.hidden = true
  byId('room-heading').textContent = room.name
  byId('image-info').textContent = room.image
  byId('image-message').hidden = false
  byId('image-message').textContent = 'Loading room image…'
  byId('viewport').scrollTo(0, 0)
  byId('coordinates').textContent = ''
  image.alt = `Room art for ${room.name}`
  const url = imageUrl(room)
  if (url) {
    image.src = url
    if (image.complete && image.naturalWidth) showImage()
  } else {
    image.removeAttribute('src')
    showMissingImage()
  }
  updateControls()
}

function populateRooms() {
  roomSelect.replaceChildren(...map.rooms.map((room, index) => new Option(room.name, index)))
  roomSelect.value = roomIndex
  renderRoom()
}

function startDraft(type, index = null, suggested = null) {
  if (draft || stage.hidden) return
  const room = currentRoom()
  const existing = room[collection(type)]?.[index]
  const isObject = type === 'object'
  draft = { type, index, points: structuredClone(existing?.zone ?? []) }
  byId('form-heading').textContent = `${existing ? 'Edit' : 'New'} ${type} zone`
  zoneId.value = existing?.id ?? suggested?.id ?? `${room.id}.`
  zoneName.value = existing?.name ?? suggested?.name ?? ''
  zoneName.required = isObject
  byId('name-field').hidden = !isObject
  doorTarget.required = !isObject
  byId('target-field').hidden = isObject
  doorTarget.replaceChildren(new Option('Choose a room', ''))
  for (const destination of map.rooms) {
    if (destination.id !== room.id) doorTarget.add(new Option(destination.name, destination.id))
  }
  doorTarget.value = existing?.to ?? ''
  byId('delete-zone').hidden = !existing
  byId('form-error').hidden = true
  updateControls()
  zoneId.focus({ preventScroll: true })
  zoneId.setSelectionRange(zoneId.value.length, zoneId.value.length)
}

function finishDraft() {
  draft = null
  draggedPoint = null
  updateControls()
}

function pointAt(event) {
  const bounds = overlay.getBoundingClientRect()
  const percent = (value, start, size) =>
    Math.round(Math.min(100, Math.max(0, ((value - start) / size) * 100)) * 10000) / 10000
  return {
    x: percent(event.clientX, bounds.left, bounds.width),
    y: percent(event.clientY, bounds.top, bounds.height),
  }
}

function hasArea(points) {
  let doubleArea = 0
  for (const [index, point] of points.entries()) {
    const next = points[(index + 1) % points.length]
    doubleArea += point.x * next.y - next.x * point.y
  }
  return Math.abs(doubleArea) > 0.000001
}

image.addEventListener('load', showImage)
image.addEventListener('error', showMissingImage)
roomSelect.addEventListener('change', () => {
  roomIndex = Number(roomSelect.value)
  renderRoom()
})
byId('zoom').addEventListener('change', (event) => {
  stage.style.width = `${event.target.value}%`
})
byId('brighten').addEventListener('change', (event) => {
  image.classList.toggle('brightened', event.target.checked)
})

byId('new-object').addEventListener('click', () => startDraft('object'))
byId('new-door').addEventListener('click', () => startDraft('door'))
byId('cancel-zone').addEventListener('click', finishDraft)
byId('undo-point').addEventListener('click', () => {
  draft.points.pop()
  updatePoints()
})
byId('redraw').addEventListener('click', () => {
  draft.points = []
  updatePoints()
})

overlay.addEventListener('pointerdown', (event) => {
  if (!draft || event.button !== 0 || !event.isPrimary) return
  const vertex = event.target.dataset.vertex
  if (vertex !== undefined) {
    draggedPoint = Number(vertex)
    overlay.setPointerCapture(event.pointerId)
  } else {
    draft.points.push(pointAt(event))
    updatePoints()
  }
})
overlay.addEventListener('pointermove', (event) => {
  const point = pointAt(event)
  byId('coordinates').textContent = `${point.x.toFixed(2)}%, ${point.y.toFixed(2)}%`
  if (draft && draggedPoint !== null && overlay.hasPointerCapture(event.pointerId)) {
    draft.points[draggedPoint] = point
    renderOverlay()
  }
})
overlay.addEventListener('lostpointercapture', () => {
  draggedPoint = null
})
overlay.addEventListener('pointerleave', () => {
  byId('coordinates').textContent = ''
})

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const id = zoneId.value.trim()
  const name = zoneName.value.trim()
  const { points, type, index } = draft
  const error = byId('form-error')
  try {
    requireMap(
      points.length >= 3 && hasArea(points),
      'Draw a polygon with at least three points and an area.',
    )
    requireMap(type !== 'object' || name, 'Enter a display name for the object.')
    const prefix = `${currentRoom().id}.`
    const previous = currentRoom()[collection(type)]?.[index]
    requireMap(id !== prefix, `Enter a zone ID after ${prefix}`)
    requireMap(
      type !== 'object' || id === previous?.id || id.startsWith(prefix),
      `Object IDs must start with ${prefix}`,
    )

    const next = structuredClone(map)
    const room = next.rooms[roomIndex]
    const zones = (room[collection(type)] ??= [])
    const zone =
      type === 'object' ? { id, name, zone: points } : { id, to: doorTarget.value, zone: points }
    if (index === null) zones.push(zone)
    else zones[index] = zone
    validateThemeMap(next)
    map = next
    dirty = true
    finishDraft()
    report(`Saved ${id}. Download map.json to keep your changes.`)
  } catch (problem) {
    error.textContent = problem.message
    error.hidden = false
  }
})

byId('delete-zone').addEventListener('click', () => {
  if (!draft || draft.index === null) return
  const zones = currentRoom()[collection(draft.type)]
  const { id } = zones[draft.index]
  if (!window.confirm(`Delete the zone ${id}?`)) return
  zones.splice(draft.index, 1)
  dirty = true
  finishDraft()
  report(`Deleted ${id}. Download map.json to keep your changes.`)
})

const imageFile = byId('image-file')
byId('preview-image').addEventListener('click', () => imageFile.click())
imageFile.addEventListener('change', async () => {
  const [file] = imageFile.files
  imageFile.value = ''
  if (!file) return
  const room = currentRoom()
  const filename = room.image.split(/[/\\]/).at(-1)
  if (file.name !== filename) {
    report(`Choose ${filename}, the image named in this room's map entry.`, true)
    return
  }

  const url = URL.createObjectURL(file)
  const preview = new Image()
  preview.src = url
  try {
    await preview.decode()
    if (currentRoom() !== room || draft) {
      URL.revokeObjectURL(url)
      return
    }
    const previous = localPreviews.get(room.id)
    if (previous) URL.revokeObjectURL(previous)
    localPreviews.set(room.id, url)
    renderRoom()
    report(`Previewing ${file.name} from your computer.`)
  } catch {
    URL.revokeObjectURL(url)
    report('This file could not be opened as an image.', true)
  }
})

const mapFile = byId('map-file')
byId('import-map').addEventListener('click', () => mapFile.click())
mapFile.addEventListener('change', async () => {
  const [file] = mapFile.files
  mapFile.value = ''
  if (!file) return
  try {
    const imported = JSON.parse(await file.text())
    validateThemeMap(imported)
    if (draft || (dirty && !window.confirm('Replace changes that have not been downloaded?')))
      return
    for (const url of localPreviews.values()) URL.revokeObjectURL(url)
    localPreviews.clear()
    map = imported
    roomIndex = 0
    dirty = false
    populateRooms()
    report(`Imported ${file.name}.`)
  } catch (error) {
    report(`Could not import map: ${error.message}`, true)
  }
})

byId('export-map').addEventListener('click', () => {
  validateThemeMap(map)
  const json = `${JSON.stringify(map, null, 2)}\n`
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'map.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  dirty = false

  const missing = CONAC_ROOMS.flatMap(({ id }) => requiredObjects(id)).filter(
    ({ id }) => !map.rooms.some((room) => room.objects.some((object) => object.id === id)),
  ).length
  const progress = missing ? ` ${missing} required manor objects still need zones.` : ''
  report(`Downloaded map.json. Save it in themes/${map.theme_id}/.${progress}`)
})

window.addEventListener('beforeunload', (event) => {
  if (!dirty && !draft) return
  event.preventDefault()
  event.returnValue = true
})

populateRooms()
