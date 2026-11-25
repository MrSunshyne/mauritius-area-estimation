# mauritius-area-estimation

Estimate the area of a plot in Mauritius from your phone, on site: the map finds you, you outline the plot on satellite imagery, and it gives the area (m², perches, arpents, hectares) with an error range, the perimeter and each edge's length. Built first for Pentaforce Movers (backhoe loader) to measure land to be cleared.

Live: https://area.ramgolam.com (open it on the phone and add it to the home screen).

## Using it

1. Open the app and allow location. The map flies to where you are.
2. Pan the map so the white **+** sits on a corner of the plot and press **+ Corner**. Go round the plot. A dashed line shows where the next edge will go.
3. Fix mistakes:
   - **Undo** takes back the last change.
   - Tap a corner to select it. The map centres on it; pan to the right spot and press **Move corner here**, drag it, or delete it.
   - Tap an edge's length label to add a corner in the middle of that edge.
4. **GPS corner** puts a corner where you stand. It averages your phone's position for 10 seconds (press **Use now** to stop sooner). Use it for corners hidden under trees or not on the imagery; phone GPS is only good to a few metres, so on small plots drawing on the imagery is more accurate.
5. The top card shows the area in m², perches, arpents and hectares, its ± range and the perimeter.
6. **Save** keeps the plot on this phone (the bookmark button lists saved plots). **Share** sends the area and a link that reopens the outline.

## How accurate is it?

- The area is computed on the WGS84 ellipsoid with [GeographicLib](https://geographiclib.sourceforge.io/) (`src/lib/area.ts`). Measuring flat on the web map would read about 14% too big at Mauritius' latitude.
- It is the horizontal area, as on title deeds. On a slope the ground surface is larger (+1.5% at 10°, +6% at 20°).
- The ± range combines how precisely the corners were placed (about 0.5 m on the imagery, the GPS accuracy for GPS corners) with half a metre of doubt about where the boundary really is (fence or canopy edge). On a 500 m² plot that is roughly ±6–9%; on a hectare about ±2%.
- Imagery: Esri World Imagery. Over Mauritius it is a Vantor (Maxar) mosaic captured March–June 2025 at about 0.3–0.5 m per pixel. If the plot has changed since, trust what you see on site.

Units, from the French foot in the SI Act 1984: 1 perche = 42.2087 m², 1 arpent = 100 perches = 4,220.87 m², 1 toise² = 3.79878 m².

## Development

```sh
npm install
npm run dev      # http://localhost:5173 (and on the LAN with --host)
npm test         # area and units
npm run build    # typecheck + production build in dist/
```

Location only works over HTTPS (or on localhost), so try it on a phone through the deployed site.

### Deploying

Pushing to `main` builds the app and deploys it to Cloudflare Pages (project `mauritius-area-estimation`, served at https://area.ramgolam.com) with `.github/workflows/deploy.yml`. It needs the repository secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Account > Cloudflare Pages > Edit. `npm run deploy` does the same from a laptop after `npx wrangler login`.

### Imagery key

Without configuration the app uses Esri's public World Imagery tiles, which is fine for trying it. For real business use, create a free [ArcGIS Location Platform](https://location.arcgis.com/) account (2 million basemap tiles a month free), make an API key with basemap access, and build with it:

```sh
echo 'VITE_ARCGIS_API_KEY=…' > .env.local
```

For the deployed site, add the same key as the repository secret `VITE_ARCGIS_API_KEY`; the workflow passes it to the build.

Esri's terms allow tracing features from World Imagery. Google's satellite imagery is not used: its terms forbid tracing from it and showing it with other maps.

### Visit counts and link previews

Visits are counted with [GoatCounter](https://www.goatcounter.com), site `area-mauritius` (https://area-mauritius.goatcounter.com), from the script in `index.html`, and shown on https://stats.ramgolam.com. GoatCounter doesn't see the `#p=…` part of a shared link, so every visit counts as `/`.

`public/og-image.jpg` (1200 × 630) is the link preview: a screenshot of the live app with a plot drawn.

## Stack

Vue 3, Vite, [MapLibre GL JS](https://maplibre.org/) v6 for the map, `geographiclib-geodesic` for areas and lengths, `vite-plugin-pwa` for installing it on the home screen. Drawing is our own code (`src/map/map.ts`): one outline, crosshair placement, tap to select a corner.
