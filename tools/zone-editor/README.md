# Clickable-zone editor

Open [index.html](index.html) in a browser from your checkout. The editor runs locally with the
six manor WebP backgrounds from `themes/conac/`. It uses the interrogation room image for the
station entry in the export. A running game, Docker and additional packages are unnecessary.

1. Select a room. Zoom and brighten the preview when tracing small or dark details. Both controls
   affect only the editor preview.
2. Pick an ID under **Required objects** to prefill it and its display name, or choose **New object**
   to enter an ID such as `hall.umbrella_stand`. Use the exact IDs in the
   [manor guide](../../themes/conac/README.md).
3. Click around the outline to place at least three points. Drag a point to adjust it or undo the
   last point. Select **Save zone** to close and save the polygon. Click an existing outline or its
   ID to edit it. Coordinates are percentages of the full image at every zoom level.
4. If needed, use **New door** to draw a door and choose another manor room as its destination.
   Players reach the police station through the game interface.
5. Select **Download map.json** to save the whole map, including the other rooms. Use **Import map**
   to resume from an existing file. Keep working copies until the room zones are ready to share.

The initial template has empty zone lists. The required-object checklist tracks the objects
the Vornicu case expects. Draw the final polygons on the final artwork and place the finished
`map.json` in `themes/conac/` for the manor map task.

The editor loads an imported room's image relative to `themes/<theme_id>/`. **Preview image** can
open a local copy with the same filename. When sharing the map, include the matching image at the
path specified in the map. Use the same artwork and crop so the polygons line up.

The export follows the [theme map contract](../../docs/contracts/theme-map.schema.json). Import and
save validate the shape, IDs, and door references before applying changes.
