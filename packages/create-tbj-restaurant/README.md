# create-tbj-resturant

Creates a restaurant web app (Next.js, installable on phones) set up for one restaurant.

```bash
npx create-tbj-resturant
```

It asks for the restaurant (Google Business listing, Yelp, website, or typed in), reads the menu,
and asks about menu times (breakfast / lunch / dinner), logo, app icon, home page photos, fonts,
colors and delivery (DoorDash or Uber drivers). Then it copies the template into a new folder,
installs it, loads the menu into a local database, makes the first commit, and can create a
private GitHub repo for Vercel.

```bash
npx create-tbj-resturant johns-diner --google "John's Diner, Indio, CA" --logo logo.png --icon icon.png --delivery doordash
cd johns-diner && pnpm dev
```

Inside an existing app (`pnpm tbj …`): `login` (save Google / Yelp / Anthropic keys), `switch`
(turn the demo site into another restaurant), `store` (Play Store / App Store kit), `list`.

Needs Node 20+ and Git. Docs: https://github.com/VirtualJoe760/tbj-resturant/tree/main/docs
