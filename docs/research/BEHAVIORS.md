# Hanakos Music Behavior Notes

## Source
- Target URL: `https://forum.hanakos.cc/music`
- Captured with local Chrome DevTools Protocol at 1440x960.
- Reference screenshots: `docs/design-references/hanakos-music/original-drag-01.png` through `original-drag-10.png`.
- Raw observations: `docs/design-references/hanakos-music/observations.json`.

## Observed Interaction Model
- The page is a fixed full-screen 3D music card wall.
- Dragging pans the whole 3D space; cards recycle/continue through the viewport.
- The scene keeps inertia after pointer release.
- Cards are dense; reference capture consistently saw at least 260 card-like nodes.
- Per-card controls repeat on cards: more, previous, play, next, like.

## Button Styling
- Repeated play control in original:
  - `aria-label`: `play`
  - classes include `grid place-items-center h-7 w-7 rounded-full bg-white/15 hover:bg-white/25`
- Side controls use simple icon buttons with hover white color.
- The original uses lower-case aria labels such as `play`, `prev`, `next`, `like`, `more`.

## Local Adjustments From This Pass
- Local card play button now uses `h-7 w-7`, `bg-white/15`, and lower-case `aria-label`.
- Playing state is keyed directly to `playingTrackId` so the icon changes immediately after clicking.
- The icon component is keyed as `play` / `pause` to force a visible replacement on state change.
