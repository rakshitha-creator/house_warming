# శుభ గృహప్రవేశం — Sita & Ram

An immersive Gruhapravesam invitation website. It is a static site with no build step, so any static host can serve it.

## Edit the event details

Open `js/config.js` and replace the placeholders:

| Field | What to put |
|---|---|
| `date` | e.g. `"Sunday, 15 November 2026"` |
| `time` | e.g. `"7:30 AM onwards (Muhurtham 8:12 AM)"` |
| `venue` | full house address when ready |
| `mapsQuery` / `mapsUrl` | exact address, or a Google Maps share link (`mapsUrl` wins) |
| `whatsappNumber` | number that receives RSVPs, e.g. `"919876543210"` (empty = guest picks the contact) |

All dates, times, map buttons and the RSVP message update automatically.

## Preview locally

The site must be served over http (opening `index.html` directly will block the 3D module):

```
cd house_warming
python -m http.server 8000
```
Then open http://localhost:8000. Or use VS Code's "Live Server".

## Share on WhatsApp

Upload the whole folder to any static host, for example **Netlify Drop** (drag the folder onto app.netlify.com/drop), GitHub Pages or Vercel, then share the link.

## The experience

1. **Loader:** the kolam from pin 8 turns slowly.
2. **Opening:** the sunlit temple hall (pin 4) is split into three depth layers that move with the pointer, with floating gold dust and the "Enter Our New Home" button.
3. **Door portal:** the first 8.6 s of the door video (pin 2): the marigold curtain parts and the doors open into light. Music starts here (it is optional, with a mute button).
4. **Hero:** the toran invitation frame (pin 1) as a 3D diorama. The mango-leaf toran and the banana leaves float in front of the paper and tilt with the pointer.
5. **3D walk-through (Three.js, scroll-driven):**
   - A: the carved door (pin 3). Its two leaves are cut from the photo and swing open on hinges, and the camera walks through.
   - B: the marigold and banana-leaf frame (pin 6), with the Telugu welcome.
   - C: the temple bells video (pin 5), played as a live texture.
   - D: the main invitation on the brass frame (pin 7), with the event details and View Location.
   - E: the illustrated doorway with the couple (pin 9), the final blessing, View Location and RSVP.
6. **Gatefold card:** the kolam card (pin 8) opens in 3D from a kumkum seal, and it can be closed again.
7. **RSVP:** sends a pre-filled WhatsApp message.

Reduced-motion users and devices without WebGL get a stacked, still version of the same scenes.

## Asset inventory (only the supplied Pinterest pins are used)

| Pin | Source | Original file | Used as | Where |
|---|---|---|---|---|
| 1 | in.pinterest.com/pin/13299761397281095 | `assets/src/hw_p1-toran-frame.jpg` (736×1104) | `p1-toran-frame.webp` | Hero diorama |
| 2 | in.pinterest.com/pin/49328558414385621 (video, MAV Invites) | `assets/src/hw_p2-door-video.mp4` (36 s, 720×1280) | `door-entrance.mp4` (0–8.6 s), posters, `blessing-music.m4a` (its soundtrack, 0–25 s) | Door portal, background music |
| 3 | in.pinterest.com/pin/1035827983073090650 | `assets/src/hw_p3-carved-door.jpg` | `p3-carved-door.webp` | Scene A, 3D opening doors |
| 4 | in.pinterest.com/pin/1062145893388930030 | `assets/src/hw_p4-temple-hall.jpg` | `p4-temple-hall.webp` | Opening screen |
| 5 | in.pinterest.com/pin/1030761433489279639 (video) | `assets/src/hw_p5-bells-video.mp4` (5 s loop) | `temple-bells.mp4`, poster | Scene C |
| 6 | in.pinterest.com/pin/722968546475900736 | `assets/src/hw_p6-marigold-frame.jpg` | `p6-marigold-frame.webp` | Scene B |
| 7 | in.pinterest.com/pin/1034702083159598086 | `assets/src/hw_p7-brass-frame.jpg` | `p7-brass-frame.webp` | Scene D |
| 8 | in.pinterest.com/pin/788200372330667185 | `assets/src/hw_p8-kolam.jpg` | `p8-kolam.webp` | Loader, gatefold card |
| 9 | in.pinterest.com/pin/1034139133210153672 | `assets/src/hw_p9-doorway-couple.jpg` | `p9-doorway-couple.webp` | Scene E |

No AI-generated, stock or other images are used. The only non-photographic decoration is drawn in code: gold dust particles, light glow, the dotted muggu pattern inside the card flaps, and the seal.

**Note on pin 2:** the door video is a commercial template by *MAV Invites* and carries their watermark. The site uses only its opening door sequence (their sample card text and branding are cut) and leaves the watermark intact. For a clean version, buy or licence it from MAV Invites and replace `assets/media/door-entrance.mp4` (and the music) with the same file names.

## Files

```
index.html          page structure and copy
css/style.css       all styling; css/fonts.css self-hosted fonts
js/config.js        ← event details
js/main.js          intro, hero, scroll timeline, card, RSVP, music
js/journey.js       Three.js walk-through
js/dust.js          gold dust layer
vendor/             three.js r160, GSAP 3.12 + ScrollTrigger (local copies)
fonts/              Tiro Telugu, Marcellus, Spectral (woff2)
assets/media/       optimized media actually served (~4 MB)
assets/src/         untouched originals from the pins
```
