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
| `hall` | Hall | `hall.coat_rack` (coat rack), `hall.back_door` (back door), `hall.guest_register` (guest register) |
| `library` | Library | `library.journal` (journal), `library.blotter` (blotter), `library.medicine_bottle` (drop bottle), `library.drawer` (desk drawer), `library.armchair` (armchair) |
| `kitchen` | Kitchen | `kitchen.tea_tray` (tea tray), `kitchen.key_board` (key board), `kitchen.gardener_notebook` (gardener's notebook), `kitchen.calendar` (calendar), `kitchen.stove` (stove) |
| `master_bedroom` | Master bedroom | `master_bedroom.desk` (small desk), `master_bedroom.desk_drawer` (desk drawer), `master_bedroom.wedding_photo` (wedding photograph), `master_bedroom.nightstand` (nightstand) |
| `guest_room_2` | Guest Room 2 | `guest_room_2.medical_bag` (medical bag), `guest_room_2.suitcase` (suitcase), `guest_room_2.books` (books), `guest_room_2.stove` (small stove) |
| `greenhouse` | Greenhouse | `greenhouse.foxglove_pots` (foxglove pots), `greenhouse.empty_pot` (empty pot), `greenhouse.chair` (blanketed chair) |

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
