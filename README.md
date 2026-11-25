# mauritius-area-estimation

Estimate the area of a plot in Mauritius from your phone, on site: the map finds you, you outline the plot on satellite imagery, and it gives the area (m², perches, arpents, hectares) with an error range, plus a clearing quote in hours, days and rupees. Built first for Pentaforce Movers (backhoe loader) to price land clearing on the spot.

## Using it

1. Open the app and allow location. The map flies to where you are.
2. Pan the map so the white **+** sits on a corner of the plot and press **+ Corner**. Go round the plot. A dashed line shows where the next edge will go.
3. Fix mistakes:
   - **Undo** takes back the last change.
   - Tap a corner to select it. The map centres on it; pan to the right spot and press **Move corner here**, drag it, or delete it.
   - Tap an edge's length label to add a corner in the middle of that edge.
4. **GPS corner** puts a corner where you stand. It averages your phone's position for 10 seconds (press **Use now** to stop sooner). Use it for corners hidden under trees or not on the imagery; phone GPS is only good to a few metres, so on small plots drawing on the imagery is more accurate.
5. The top card shows the area. Tap it, or the green button, for the quote: say what is on the plot (grass, bush, trees, rocks), the slope, access, and distance from base. **Rates** holds the hourly rate and hours per arpent for each kind of cover; change them to match real jobs.
6. **Save** keeps the plot on this phone (the bookmark button lists saved plots). **Share** sends the area, the estimate and a link that reopens the outline.

## How accurate is it?

- The area is computed on the WGS84 ellipsoid with [GeographicLib](https://geographiclib.sourceforge.io/) (`src/lib/area.ts`). Measuring flat on the web map would read about 14% too big at Mauritius' latitude.
- It is the horizontal area, as on title deeds. On a slope the ground surface is larger (+1.5% at 10°, +6% at 20°); the quote's slope setting covers the extra work.
- The ± range combines how precisely the corners were placed (about 0.5 m on the imagery, the GPS accuracy for GPS corners) with half a metre of doubt about where the boundary really is (fence or canopy edge). On a 500 m² plot that is roughly ±6–9%; on a hectare about ±2%.
- Imagery: Esri World Imagery. Over Mauritius it is a Vantor (Maxar) mosaic captured March–June 2025 at about 0.3–0.5 m per pixel. If the plot has changed since, trust what you see on site.

Units, from the French foot in the SI Act 1984: 1 perche = 42.2087 m², 1 arpent = 100 perches = 4,220.87 m², 1 toise² = 3.79878 m².

## Quote model

`src/lib/pricing.ts`. Hours = area in arpents × (hours per arpent, mixed by cover) × slope × access × wet ground × loading debris (× 1.2 under 10 perches). Price = the larger of hours × Rs per hour and the minimum charge, plus travel, plus contingency, rounded to Rs 500, with optional VAT. Days = hours ÷ working hours per day, rounded up to half days.

The starting rates (grass 3, bush 10, small trees 20, rocks 35, levelling 15 hours per arpent; Rs 1,500 per hour; Rs 5,000 minimum) are guesses from equipment handbooks and local adverts, not measured on Pentaforce jobs. Calibrate them.

## Development

```sh
npm install
npm run dev      # http://localhost:5173 (and on the LAN with --host)
npm test         # area, units and pricing
npm run build    # typecheck + production build in dist/
```

Location only works over HTTPS (or on localhost), so to try it on a phone, serve `dist/` through an HTTPS tunnel (`ngrok http …`, `tailscale serve …`) or deploy it.

### Imagery key

Without configuration the app uses Esri's public World Imagery tiles, which is fine for trying it. For real business use, create a free [ArcGIS Location Platform](https://location.arcgis.com/) account (2 million basemap tiles a month free), make an API key with basemap access, and build with it:

```sh
echo 'VITE_ARCGIS_API_KEY=…' > .env.local
```

Esri's terms allow tracing features from World Imagery. Google's satellite imagery is not used: its terms forbid tracing from it and showing it with other maps.

## Stack

Vue 3, Vite, [MapLibre GL JS](https://maplibre.org/) v6 for the map, `geographiclib-geodesic` for areas and lengths, `vite-plugin-pwa` for installing it on the home screen. Drawing is our own code (`src/map/map.ts`): one outline, crosshair placement, tap to select a corner.
