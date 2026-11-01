/* eslint-disable */
/** Generated from docs/contracts by scripts/gen-contracts.mjs. Do not edit by hand. */

export type SchemaVersion = 1
export type ThemeId = string
export type Name = string
/**
 * Police station image, relative to the theme folder
 */
export type StationImage = string
/**
 * @minItems 1
 */
export type Rooms = [MapRoom, ...MapRoom[]]
export type Id = string
/**
 * Display name shown to players (Romanian)
 */
export type Name1 = string
/**
 * Background image path, relative to the theme folder
 */
export type Image = string
/**
 * Unique in the whole map, by convention '<room>.<object>'
 */
export type Id1 = string
export type Name2 = string
/**
 * @minItems 3
 */
export type Zone = [Point, Point, Point, ...Point[]]
/**
 * Percent of the image width
 */
export type X = number
/**
 * Percent of the image height
 */
export type Y = number
export type Objects = MapObject[]
export type Id2 = string
/**
 * Target room id, or 'station' for the police station
 */
export type To = string
/**
 * @minItems 3
 */
export type Zone1 = [Point, Point, Point, ...Point[]]
export type Doors = Door[]

export interface ThemeMap {
  schema_version?: SchemaVersion
  theme_id: ThemeId
  name: Name
  station_image: StationImage
  rooms: Rooms
}
/**
 * This interface was referenced by `ThemeMap`'s JSON-Schema
 * via the `definition` "MapRoom".
 */
export interface MapRoom {
  id: Id
  name: Name1
  image: Image
  objects: Objects
  doors: Doors
}
/**
 * This interface was referenced by `ThemeMap`'s JSON-Schema
 * via the `definition` "MapObject".
 */
export interface MapObject {
  id: Id1
  name: Name2
  zone: Zone
}
/**
 * This interface was referenced by `ThemeMap`'s JSON-Schema
 * via the `definition` "Point".
 */
export interface Point {
  x: X
  y: Y
}
/**
 * This interface was referenced by `ThemeMap`'s JSON-Schema
 * via the `definition` "Door".
 */
export interface Door {
  id: Id2
  to: To
  zone: Zone1
}
