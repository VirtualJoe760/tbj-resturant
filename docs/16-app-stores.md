# 16 · Branding, menu times and the app stores

## One file for the look: `src/config/business-theme.ts`

Everything visual about a restaurant lives in one file, with its images in `public/brand/`:

| Field | What it controls | File guidance |
|---|---|---|
| `logo` | Home page header, desktop top bar | PNG with a see-through background, ~800 px wide |
| `appIcon` | Phone home screen, favicon, Play Store / App Store icon, install prompt | Square PNG, 1024 × 1024, important part in the middle 80% |
| `heroBanners` | Crossfading photos behind the home page header, in order | Wide JPGs, ≥ 1600 px across |
| `style` | The whole look: **Classic** (light, rounded), **Midnight** (dark pages, glowing accent), **Diner** (cream paper, bold outlines, offset shadows), **Minimal** (white space, square corners) | Switch any time in Admin → Branding |
| `gallery` | The "Photos" strip on the home page | Upload in Admin → Branding → Photo gallery |
| `fonts.heading` / `fonts.body` | Name and page titles / everything else | Ids from `FONTS` in `src/domain/branding.ts` (Google Fonts) |
| `colors.accent` / `header` / `background` | Buttons, top bars and app background, page | Hex; button text turns black or white by itself |

`create-tbj-restaurant` writes this file and copies the images during intake. Edit it by hand
any time: drop a file in `public/brand/`, point the field at `"/brand/<file>"`, push.

The app icon is drawn from `appIcon` at every size the stores and phones ask for:
`/icon-192`, `/icon-512`, `/icon-maskable` (Android adaptive), `/apple-icon` (180, opaque) and
`/favicon.png`. With no icon, it's the first letter of the name on the header color.

**Admin → Branding** lets the owner try a different logo, photos, fonts, colors or icon without a
deploy. Those changes are stored as *overrides* on top of the file (only the fields that differ),
the page shows which fields are overridden, and **Reset to the theme file** clears them. Switching
the demo to another business clears overrides too.

## Menu item photos

Admin → Menu → Edit items → every item shows its **Photos** strip right on the list (no panel to open): add several at once, reorder with
‹ ›, remove with ✕. The first is the cover (menu thumbnail). On the menu, the item sheet opens
with a swipeable carousel (arrows and dots on computers). Uploads are resized in the browser
(1600 px JPG) and stored in the database (`media` table), so clones need no file storage.

## Menu times (breakfast, lunch, dinner)

Admin → Menu → **Menu times**: add windows (name, start, end, days; an end earlier than the start
runs past midnight, e.g. Late night 22:00–02:00), then tick which sections each covers. A section
with no menu time follows the opening hours. Outside its window a section shows
"Not now · Breakfast · 7 AM – 11 AM", its items can't be added, and checkout re-checks on the
server. The menu header says what's being served ("Serving lunch").

The CLI guesses menu times from section names (Breakfast, Brunch, Lunch, Dinner, Late night),
asks for the hours ("7-11", "11am-3pm", "22:00-02:00" all work) and which sections, and the
import loads them.

## The app stores

The site is already an installable app (PWA): manifest with id, maskable icon, shortcuts,
portrait, standalone. Store apps are thin shells around the live site, so menu, prices and photos
update without resubmitting.

```
pnpm tbj store --url https://thehoodpalmdesert.com    # writes ./store
```

| | Google Play | Apple App Store |
|---|---|---|
| How | Trusted Web Activity built with Bubblewrap (`store/twa-manifest.json`) | Capacitor shell (`store/capacitor.config.json`) |
| Build machine | Windows is fine | A Mac, or a cloud Mac (Codemagic, Ionic Appflow) |
| Account | Google Play Console, $25 once | Apple Developer Program, $99/year, in the client's name |
| Link-up | Signing fingerprint → `restaurant.app.androidSha256` → `/.well-known/assetlinks.json` | `<team>.<bundle id>` → `restaurant.app.iosAppId` → `/.well-known/apple-app-site-association` |
| Review risk | Low | Apple rejects "just a website" (guideline 4.2): ship with push notifications for order-ready alerts and Sign in with Apple |

`restaurant.app.androidPackage` is set by the CLI from the domain (`com.thehoodpalmdesert.app`).
Store listings belong to the client's own developer accounts; we build and submit for them.

**Not built yet:** push notifications (needed for Apple review), Sign in with Apple, a
screenshot generator for store listings.
