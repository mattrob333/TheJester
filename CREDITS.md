# Credits

Asset credits for **The Jester**. Even where licenses (CC0) require no
attribution, we log every asset here for provenance.

## Art / Models / Audio

| Asset | Source | License |
| ----- | ------ | ------- |
| _(none yet — scaffold)_ | — | — |

## Sourcing targets for the first slice

- **[Kenney](https://kenney.nl/)** — CC0 game assets (models, textures, audio).
  No attribution required; logged here anyway.
- **[Quaternius](https://quaternius.com/)** — CC0 low-poly model packs.
  No attribution required; logged here anyway.
- **[Mixamo](https://www.mixamo.com/)** — character animation (rigging +
  animation), added in a later phase.

## Pipeline note

All models enter the project as **glTF/glb** and are loaded through the
`loadGltf` helper (`src/lib/loadGltf.ts`). No FBX/OBJ is committed — convert to
glb first. See the README "Asset pipeline" section.
