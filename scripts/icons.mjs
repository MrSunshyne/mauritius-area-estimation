// Renders the PNG app icons from public/icon.svg (needs ImageMagick's `magick`).
import { execFileSync } from 'node:child_process';

for (const size of [192, 512]) {
  execFileSync('magick', ['-background', 'none', '-density', '384', 'public/icon.svg', '-resize', `${size}x${size}`, `public/icon-${size}.png`]);
}
