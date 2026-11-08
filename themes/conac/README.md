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

- Perspective: top-down, walls folded slightly outward, the same for every room. 16:9.
- Keep the original PNG. Upscale with Upscayl 2× (4× if the original is small); target at least
  1920×1080, ideally 2560×1440. Export to WebP (quality 85–90) once, from the upscaled PNG.
- The bottom-right corner carries the Gemini logo: no clickable objects there.

## Ids the cases need

`map.json` must contain at least these rooms and objects, with exactly these ids, because
[cases/vornicu_1926.json](../../cases/vornicu_1926.json) puts its clues on them. Display names are
suggestions.

| Room id | Name | Objects with clues |
|---|---|---|
| `hall` | Hall | `hall.mail_tray` (silver mail tray), `hall.victor_coat` (Victor's coat on the coat rack), `hall.doctor_coat` (the doctor's coat on the coat rack), `hall.back_door` (back door, boots beside it), `hall.guest_register` (guest register on the console) |
| `library` | Library | `library.journal` (stack of closed ledgers on the desk), `library.blotter` (blotter), `library.medicine_bottle` (drop bottle with police tag), `library.drawer` (desk drawer, slightly open), `library.armchair` (armchair; the keys lie on the floor under it) |
| `kitchen` | Kitchen | `kitchen.tea_tray` (tea tray), `kitchen.key_board` (key board), `kitchen.gardener_notebook` (gardener's notebook on the windowsill), `kitchen.calendar` (calendar), `kitchen.stove` (stove, cold, door open) |
| `master_bedroom` | Master bedroom | `master_bedroom.desk` (small desk), `master_bedroom.desk_drawer` (desk drawer), `master_bedroom.wedding_photo` (wedding photograph on the wall), `master_bedroom.nightstand` (nightstand) |
| `guest_room` | Guest room | `guest_room.medical_bag` (medical bag, closed), `guest_room.briefcase` (briefcase), `guest_room.nightstand` (nightstand with a small book) |
| `greenhouse` | Greenhouse | `greenhouse.foxglove_pots` (foxglove pots), `greenhouse.empty_pot` (empty pot), `greenhouse.chair` (blanketed chair with lamp and glass of wine) |

The police station is not a room of the house: players go there with a button in the interface,
not through a door in the room images. Room doors in the images are decoration only.

## Objects without clues

Clickable objects that hold no clue, so the search is not too easy. Up to 10–11 clickable objects
in the library, 7–8 in the other rooms. Large furniture and wall decoration that is not listed
here is not clickable. Suggested ids and the text the player sees:

| Object id | Text |
|---|---|
| `library.cabinet` | Six identical heart-drop bottles with white stoppers, sealed and untouched. The box is labeled “Dr. I. Strat.” |
| `library.window` | Rain streaks on the glass. The latch is closed from the inside. |
| `library.telephone` | The line is dead. The storm brought it down. |
| `library.portrait` | “Matei Vornicu, 1920.” A stern gaze, one hand on a ledger. |
| `library.cigar_box` | Cuban cigars. Two are missing, although the doctor had forbidden them. |
| `library.bookshelf` | One ledger sticks out a little from its row. |
| `hall.umbrella_stand` | The umbrellas are dry. Nobody went out through the front door after the storm. |
| `hall.stairs` | From here you can see the whole hall, down to the kitchen door. |
| `hall.bench` | A folded blanket and a pair of men's driving gloves. |
| `kitchen.top_shelf` | A tin of rat poison, full, with undisturbed dust on the lid. |
| `kitchen.bell_board` | The servants' bell board. The library bell did not ring all evening. |
| `kitchen.sink` | The dinner dishes are washed. The only unwashed cup is on the tray. |
| `master_bedroom.photo_frame` | A photograph of a gentle woman: Maria, Matei's first wife. |
| `master_bedroom.bed` | Untouched. Matei never went to bed. |
| `master_bedroom.wardrobe` | Dark suits and a walking stick. Nothing hidden. |
| `guest_room.washbasin` | The basin has been rinsed. The towel is damp. |
| `guest_room.bed` | Made up in a hurry: sheets thrown over a summer bedspread. |
| `guest_room.stove` | Cold and clean. Nothing was burned here. |
| `guest_room.window` | The garden is flooded; the road to Turda is full of puddles. |
| `greenhouse.road_window` | Misted on the inside, no marks on the outside. Nobody came to this window. |
| `greenhouse.workbench` | Gardening gloves, seed packets, a watering can. |
| `greenhouse.ferns` | Wet ferns, flattened by the wind through a cracked roof pane. |

These texts are case-specific. If the theme map schema has no field for an object's text, we
need one (on the object in `map.json`, or a list of “empty object” texts in the case).

## Suspect portraits

Each suspect has an `archetype` that picks the portrait set. The Vornicu case uses:

| Archetype | Suspect |
|---|---|
| `doctor` | Dr. Ilie Strat, 52, the family doctor |
| `housekeeper` | Ana Mureșan, 51, the housekeeper |
| `heir` | Victor Vornicu, 27, the nephew |
| `lady` | Elena Vornicu, 38, the wife |

Each set needs one portrait per emotion: `calm`, `nervous`, `angry`, `sad`, `arrogant`, `broken`.
