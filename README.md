# Finances

> **Want your own copy?** Follow [docs/INSTALL.md](docs/INSTALL.md) (English, no coding needed): your own
> accounts, your own database, updates with one click. En català: [docs/INSTALL.ca.md](docs/INSTALL.ca.md).

App de finances personals mòbil (PWA): apuntar una despesa en menys de 5 segons, amb una mà; el mes, l'any, la
cartera d'inversions i, per a qui tributa a Espanya, les plusvàlues. En català, anglès i hebreu (de dreta a
esquerra), amb euros, dòlars o xèquels.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Supabase (Postgres + Auth) ·
Drizzle ORM · Tailwind CSS 4 · Vitest.

## Posar-ho en marxa en local

Cal Node 22, Docker en marxa i el [CLI de Supabase](https://supabase.com/docs/guides/cli).

```bash
npm install
npm run db:start          # Supabase local a Docker (la primera vegada descarrega imatges)
supabase status -o env    # copia els valors a .env.local (plantilla: .env.example)
npm run db:reset          # aplica les migracions de supabase/migrations
npm run dev               # http://localhost:3000
```

L'entrada és amb correu i contrasenya; l'app no envia cap correu i el registre obert està tancat. En local,
l'usuari es crea a Supabase Studio (http://127.0.0.1:54323 › Authentication › Add user, amb «Auto Confirm User»).
La primera vegada que s'entra, la pantalla de benvinguda demana l'idioma, la divisa i les categories.

## Scripts

| Script | Què fa |
|---|---|
| `npm run dev` | Servidor de desenvolupament |
| `npm run build` | Build de producció |
| `npm run typecheck` · `npm run lint` | Comprovacions estàtiques |
| `npm test` | Tests d'integració (RLS) contra el Supabase local |
| `npm run db:generate` | Genera una migració SQL a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica les migracions pendents a la base de dades de `.env.local` |
| `npm run db:reset` | Reconstrueix la base de dades local aplicant totes les migracions |

## Base de dades

- **Font de veritat:** `src/db/schema.ts`. Després de canviar-lo: `npm run db:generate` i
  `npm run db:migrate` (o `npm run db:reset`). Les migracions van a `supabase/migrations`.
- **A producció s'apliquen soles:** `npm run build` comença amb `scripts/db-migrate.ts`, que a Vercel (només als
  desplegaments de producció) aplica les migracions pendents, cadascuna en una transacció. Fa servir la taula de
  control del CLI de Supabase (`supabase_migrations.schema_migrations`), així que conviu amb `supabase db push`.
  Si una migració falla, el build s'atura i continua publicada la versió anterior.
- **RLS a totes les taules d'usuari** (`user_id = auth.uid()`). `user_id` agafa l'usuari autenticat per
  defecte.
- **Claus foranes compostes `(id, user_id)`:** un usuari no pot fer referència a files d'un altre.
- **`tax_lots` i `tax_disposals` són de només lectura** per a l'usuari: les regenera el servidor a partir
  de `trades`.
- **Diners sempre en `numeric`.** Drizzle els retorna com a `string`: no els passis a `number` per
  calcular.

### Com consultar la base de dades des del codi

- `withRls(claims, tx => …)` (`src/db/index.ts`): per a tot el que ve d'una petició d'usuari.
  Executa la consulta amb el rol `authenticated` i les claims del JWT, de manera que Postgres aplica la
  RLS.
- `adminDb`: salta la RLS. Només per a crons, l'script de migració i la regeneració del FIFO, sempre
  filtrant per usuari.
- A pàgines i Server Functions, l'usuari s'obté amb `requireUser()` (`src/lib/auth.ts`). El `proxy.ts`
  només fa una comprovació optimista.

## Producció

- Supabase es connecta des del Marketplace de Vercel (regió UE). L'app accepta tant els noms de
  `.env.example` com els que crea la integració (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL`): vegeu `src/lib/env.ts`.
- Les funcions s'executen a Frankfurt (`vercel.json` › `regions`), a prop de la base de dades.
- Variables a Vercel, a més de les de la integració: `ALLOWED_EMAILS`, `CRON_SECRET` i, opcional,
  `EODHD_API_KEY`. `DATABASE_URL` és opcional (si no hi és, es fa servir `POSTGRES_URL` de la integració).
- Les claus de les notificacions (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) també són opcionals: si no
  hi són, l'app en genera unes la primera vegada i les desa a `app_secrets` (taula sense accés des de l'API).
- Supabase › Authentication › Sign In / Providers: desactivar «Allow new users to sign up» (el
  proveïdor Email ha de quedar actiu).
- Supabase › Authentication › Users › Add user: crear l'usuari amb correu i contrasenya i marcar
  «Auto Confirm User». Si s'oblida la contrasenya, es canvia des d'aquí mateix.
- Taules: les crea el primer desplegament amb la base de dades connectada (vegeu «Base de dades»).
- Pestanya Fiscal (plusvàlues i IRPF d'Espanya): als usuaris nous surt amagada; s'activa a Ajustos.
- Importar d'un full de càlcul (Ajustos › Importar): el CSV es llegeix al navegador (`src/lib/csv-import.ts`), amb
  les columnes endevinades pels títols; el full de Finances (pestanya Data) es reconeix sol. Els moviments es desen
  amb un id estable (usuari + data, concepte, import, categoria i ordre entre iguals), així que reimportar no duplica.

### App al mòbil

- Instal·lable des de Safari (Comparteix › Afegeix a la pantalla d'inici): manifest, icona i pantalla completa.
- `public/sw.js`: obre les pàgines ja visitades sense connexió (primer la xarxa; si no n'hi ha, l'última còpia).
- L'alta ràpida sense connexió es desa al mòbil (IndexedDB) i s'envia sola en tornar la connexió o obrir l'app
  (`src/lib/offline-queue.ts`, `src/components/offline-sync.tsx`); el mateix UUID evita duplicats.
- Notificacions (Ajustos › Notificacions): Web Push amb claus VAPID; només amb l'app instal·lada a l'iPhone.
  El cron envia els avisos del dia (`src/lib/notifications.ts`) i en guarda la clau a `notification_log`
  perquè no es repeteixin. La icona mostra quants moviments hi ha pendents.

### Cron diari

`/api/cron/daily` s'executa cada dia a les 8:00 UTC, les 9:00 a l'hivern (`vercel.json`). Vercel hi envia
`Authorization: Bearer $CRON_SECRET`; sense `CRON_SECRET` la ruta respon 401.

- **Preus**: cada font cobreix uns tipus de posició (`src/lib/prices/`). Canviar de font vol dir
  escriure un altre `PriceProvider`; res més de l'app canvia.
  - Cripto: preu spot de l'API pública de Coinbase (sense clau). El ticker és el parell, p. ex. `ETH-EUR`.
  - Divises: tipus de referència oficials del BCE (sense clau), amb la seva data.
  - Accions i fons: EODHD (`EODHD_API_KEY`, pla gratuït de 20 consultes al dia: una per posició).
    El ticker de la posició es tradueix al símbol d'EODHD (`BME:ITX` → `ITX.MC`, `ETR:SAP` →
    `SAP.XETRA`, `CVE:ABC` → `ABC.V`, els EUA → `.US`); els fons van per ISIN (`IE00….EUFUND`).
    Un ticker que ja porta punt (`ABC.TO`) es fa servir tal qual. Cada preu es desa amb la seva data.
  - Alternativa opcional: un Google Sheet propi amb `GOOGLEFINANCE()` (`GOOGLE_SERVICE_ACCOUNT_*`,
    `PRICES_SHEET_ID`). Sense cap font, el preu es posa a mà des del detall de la posició.
    Yahoo Finance queda descartat: bloqueja les peticions automàtiques.
  - Un preu que es desvia més d'un 50 % de l'últim desat no es desa i surt com a sospitós a l'informe.
- **Foto mensual**: el dia 1 desa el valor de la cartera, el cost i el desglossament (fons, accions,
  cripto, efectiu, préstecs) a `net_worth_snapshots`, que alimenta el gràfic d'evolució.

## Dades personals

Cap dada real va al repositori. Les dades i els fitxers propis (exports, informes, scripts personals) van a
`data/raw/`, `docs/private/` i `privat/`, totes tres al `.gitignore`.
