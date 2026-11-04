# Manor theme (conac)

Everything the game needs to draw one theme, the manor:

- `map.json`: rooms, clickable objects and doors, following the theme map schema
  (`shared_schemas.theme_map.ThemeMap`, exported to
  [docs/contracts/theme-map.schema.json](../../docs/contracts/theme-map.schema.json))
- room images and the police station image, at the paths given in `map.json`

Cases built on this theme refer to the room and object ids from `map.json`. Clickable zones are
polygons in percent of the room image (see [docs/contracts](../../docs/contracts/README.md#case-and-map)).

**Status:** not created yet; `map.json` is one of the first tasks. **Owner:** the frontend team,
with Tibi.

## Ids the cases need

`map.json` must contain at least these rooms and objects, with exactly these ids, because
[cases/vornicu_1926.json](../../cases/vornicu_1926.json) puts its clues on them. Display names are
suggestions. Add as many other objects as you like (empty ones make the search feel real; 6–8 per
room), with ids of your choice in the same `<room>.<object>` format.

| Room id | Name | Objects with clues |
|---|---|---|
| `hall` | Hol | `hall.coat_rack` (cuier cu paltoane), `hall.back_door` (ușa din spate), `hall.guest_register` (registrul de oaspeți) |
| `library` | Bibliotecă | `library.journal` (jurnalul), `library.blotter` (sugativa), `library.medicine_bottle` (sticluța cu picături), `library.drawer` (sertarul biroului), `library.armchair` (fotoliul) |
| `kitchen` | Bucătărie | `kitchen.tea_tray` (tava cu ceașca), `kitchen.key_board` (panoul cu chei), `kitchen.gardener_notebook` (carnetul grădinarului), `kitchen.calendar` (calendarul), `kitchen.stove` (soba) |
| `master_bedroom` | Dormitorul stăpânului | `master_bedroom.desk` (biroul mic), `master_bedroom.desk_drawer` (sertarul biroului), `master_bedroom.wedding_photo` (fotografia de nuntă), `master_bedroom.nightstand` (noptiera) |
| `guest_room_2` | Camera de oaspeți 2 | `guest_room_2.medical_bag` (trusa medicală), `guest_room_2.suitcase` (valiza), `guest_room_2.books` (cărțile), `guest_room_2.stove` (soba mică) |
| `greenhouse` | Seră | `greenhouse.foxglove_pots` (ghivecele cu degetel), `greenhouse.empty_pot` (un ghiveci gol), `greenhouse.chair` (scaunul cu pled) |

Every room also needs a door to `station` (the police station).

## Suspect portraits

Each suspect has an `archetype` that picks the portrait set. The Vornicu case uses:

| Archetype | Suspect |
|---|---|
| `doctor` | Dr. Ilie Strat, 52, the family doctor |
| `housekeeper` | Ana Mureșan, 51, the housekeeper |
| `heir` | Victor Vornicu, 27, the nephew |
| `lady` | Elena Vornicu, 38, the wife |

Each set needs one portrait per emotion: `calm`, `nervous`, `angry`, `sad`, `arrogant`, `broken`.
