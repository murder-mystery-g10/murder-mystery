# Manor theme (conac)

Everything the game needs to draw one theme, the manor:

- `map.json`: rooms, clickable objects and doors, following the theme map schema
  (`shared_schemas.theme_map.ThemeMap`, exported to
  [docs/contracts/theme-map.schema.json](../../docs/contracts/theme-map.schema.json))
- room images and the police station image, at the paths given in `map.json`

Cases built on this theme refer to the room and object ids from `map.json`. Clickable zones are
polygons in percent of the room image (see [docs/contracts](../../docs/contracts/README.md#case-and-map)).
Draw the polygons on the final images only: if an image is regenerated, its polygons must be redone.

**Status:** not created yet; `map.json` is one of the first tasks. **Owner:** the frontend team.

## House layout

```
GROUND FLOOR                              UPPER FLOOR
          FRONT (main door)                          FRONT
┌──────────┬────────┬────────────┐     ┌────────────┬────────┬────────────┐
│          │        │ Kitchen    │     │ Master     │        │ Guest room │
│ Library  │  Hall  ├────────────┤     │ bedroom    │ Landing│ (doctor)   │
│ (long)   │ (long) │ Ana's room │     ├────────────┤        ├────────────┤
│          │ stairs ├────────────┤     │ Elena's    │ stairs │ Victor's   │
│          │        │ Dining room│     │ room       │        │ room       │
└──────────┴────────┴────────────┘     └────────────┴────────┴────────────┘
          BACK (back door → garden → greenhouse, by the road)
```

- Playable rooms: `hall`, `library`, `kitchen`, `master_bedroom`, `guest_room`, `greenhouse`.
- Map only (shown greyed out, “searched – nothing relevant”): dining room, Ana's room, Elena's
  room, Victor's room, landing.
- The library door faces the kitchen door at the front end of the hall. From the kitchen door you
  can see the whole hall: the library door, the stairs at the back of the hall and the back door
  at its far end. The case depends on this.

## Images

- The room images in this folder are the ones used for the MVP; they are not regenerated. The case
  text follows what they show. Romanian text painted in the images (labels, notes) belongs to the
  game world; the player reads the English text of each clue.
- Portraits: in `portraits/`, one folder per suspect and one file per emotion, on a green background.
- The bottom-right corner may carry the Gemini logo: no clickable objects there.

## Clickable objects

`map.json` must contain these rooms and objects, with exactly these ids:
[cases/vornicu_1926.json](../../cases/vornicu_1926.json) puts its clues on them, and its
`object_texts` hold what the player reads on the objects without clues. The list follows what the
current images show (the images are not regenerated).

Positions are approximate, as x, y, width, height in percent of the room image; use them as a
starting point when drawing the polygons.

| Object id | Room | Clue | Position |
|---|---|---|---|
| `library.journal` | `library` | B1 | 37, 30, 11, 13 |
| `library.blotter` | `library` | B2 | 34, 40, 14, 17 |
| `library.medicine_bottle` | `library` | B3 | 30, 35, 4, 14 |
| `library.drawer` | `library` | B4 | 49, 41, 4, 6 |
| `library.armchair` | `library` | B5 | 52, 16, 13, 40 (armchair and the keys below it) |
| `library.cabinet` | `library` | — | 41, 9, 6, 32 |
| `library.cigar_box` | `library` | — | 25, 39, 6, 10 |
| `library.window` | `library` | — | 30, 0, 11, 38 |
| `library.telephone` | `library` | — | 90, 29, 4, 13 |
| `library.clock` | `library` | — | 67, 8, 7, 49 |
| `library.fireplace` | `library` | — | 71, 28, 20, 36 |
| `hall.doctor_coat` | `hall` | H5 | 19, 30, 5, 22 (dark coat on the coat rack) |
| `hall.victor_coat` | `hall` | H2 | 25, 58, 6, 20 (light coat thrown over the bench) |
| `hall.back_door` | `hall` | H3 | 26, 12, 16, 40 (door and boots) |
| `hall.mail_tray` | `hall` | H1 | 72, 39, 5, 9 |
| `hall.guest_register` | `hall` | H4 | 73, 44, 8, 8 |
| `hall.floor` | `hall` | — | 29, 42, 26, 30 |
| `hall.stairs` | `hall` | — | 60, 4, 36, 40 |
| `kitchen.tea_tray` | `kitchen` | K1 | 39, 39, 13, 15 |
| `kitchen.key_board` | `kitchen` | K2 | 10, 29, 14, 26 |
| `kitchen.gardener_notebook` | `kitchen` | K3 | 51, 37, 9, 10 (on the table) |
| `kitchen.calendar` | `kitchen` | K4 | 22, 30, 10, 13 (both calendars) |
| `kitchen.stove` | `kitchen` | K5 | 66, 18, 16, 50 |
| `kitchen.top_shelf` | `kitchen` | — | 8, 12, 12, 17 |
| `kitchen.bell_board` | `kitchen` | — | 47, 14, 8, 14 |
| `kitchen.sink` | `kitchen` | — | 74, 75, 22, 25 |
| `master_bedroom.desk` | `master_bedroom` | D1 | 13, 36, 11, 10 |
| `master_bedroom.desk_drawer` | `master_bedroom` | D2 | 15, 49, 9, 7 |
| `master_bedroom.wedding_photo` | `master_bedroom` | D3 | 10, 18, 9, 20 (with the plate) |
| `master_bedroom.nightstand` | `master_bedroom` | D4 | 55, 27, 9, 12 |
| `master_bedroom.photo_frame` | `master_bedroom` | — | 6, 43, 4, 9 |
| `master_bedroom.bed` | `master_bedroom` | — | 47, 25, 36, 38 |
| `master_bedroom.stove` | `master_bedroom` | — | 22, 0, 20, 55 |
| `master_bedroom.washstand` | `master_bedroom` | — | 80, 63, 17, 23 |
| `guest_room.medical_bag` | `guest_room` | O1 | 36, 37, 16, 27 |
| `guest_room.briefcase` | `guest_room` | O2 | 46, 56, 19, 33 |
| `guest_room.nightstand` | `guest_room` | O3 | 8, 64, 32, 29 (the table with the open book) |
| `guest_room.washbasin` | `guest_room` | — | 71, 64, 22, 30 |
| `guest_room.bed` | `guest_room` | — | 8, 8, 29, 51 |
| `guest_room.stove` | `guest_room` | — | 57, 22, 13, 33 |
| `guest_room.lantern` | `guest_room` | — | 50, 33, 3, 12 |
| `guest_room.window` | `guest_room` | — | 48, 0, 11, 21 |
| `greenhouse.foxglove_pots` | `greenhouse` | S1 | 0, 22, 38, 58 |
| `greenhouse.empty_pot` | `greenhouse` | S2 | 32, 63, 27, 26 (overturned pot and the letters) |
| `greenhouse.chair` | `greenhouse` | S3 | 72, 55, 23, 40 (chair and the side table with the lamp and wine) |
| `greenhouse.workbench` | `greenhouse` | — | 57, 58, 15, 25 |
| `greenhouse.road_window` | `greenhouse` | — | 82, 14, 18, 33 |
| `greenhouse.ferns` | `greenhouse` | — | 43, 21, 22, 39 |
| `greenhouse.stacked_pots` | `greenhouse` | — | 12, 86, 7, 14 |

The police station is not a room of the house: players go there with a button in the interface,
not through a door in the room images. Room doors in the images are decoration only. In the
interrogation room nothing is clickable; the suspect portrait goes over the chair behind the table
(about 54, 42, 7, 19).

## Suspect portraits

Each suspect has an `archetype` that picks the portrait set. The Vornicu case uses:

| Archetype | Suspect |
|---|---|
| `doctor` | Dr. Ilie Strat, 52, the family doctor |
| `housekeeper` | Ana Mureșan, 51, the housekeeper |
| `heir` | Victor Vornicu, 27, the nephew |
| `lady` | Elena Vornicu, 38, the wife |

Each set needs one portrait per emotion: `calm`, `nervous`, `angry`, `sad`, `arrogant`, `broken`.
