<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Online rooms use a realtime broadcast channel per room code; the host browser runs the authoritative game engine (timer, bots, validation) and broadcasts full state, guests only send join/guess. Why: no server-side state needed on stateless workers.
- Spain modes (communities/provinces) render `src/components/game/SpainMap.tsx`: conic conformal projection fitted to the mainland, with the Canary Islands in a corner inset placed over empty ocean. `src/components/game/WorldMap.tsx` stays for the world and continent modes. Zoom/pan lives in `src/components/game/useMapView.ts`, shared by both.
- Conquest mode (`src/lib/game/conquest.ts`) restricts guesses to territories bordering what you already own, falling back to the nearest free ones when you have no border left. Borders come from `src/lib/geo/adjacency.ts`: shared arcs in the world-atlas TopoJSON, shared border coordinates for the Spain datasets, plus a documented list of borders the 110m map doesn't draw (ES–MA). Island-only regions rely on the nearest-neighbour fallback.
- GitHub Pages serves a static build (`npm run build:pages` → `dist-pages/`, no SSR) from `vite.pages.config.ts` with `base=/globalwarfare/`. `src/pages-router.ts` strips that base before matching routes and drops the document `shellComponent` (there is no server rendering the document). Deployed by `.github/workflows/deploy-pages.yml`.
