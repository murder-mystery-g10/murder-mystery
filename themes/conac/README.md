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
