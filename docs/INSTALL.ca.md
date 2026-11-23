# La teva pròpia còpia de Finances

[English](INSTALL.md) · **Català**

Finances és una app de finances personals per al mòbil: apuntes una despesa en pocs segons i et mostra el mes,
l'any i la cartera d'inversions. Funciona en català, anglès i hebreu, amb euros, dòlars o xèquels.

Aquesta guia posa en marxa **la teva pròpia còpia**. Funciona amb els teus comptes gratuïts, i les teves dades
només són a la teva base de dades: ningú més les pot veure, tampoc qui t'ha passat el codi.

Es fa en uns 20 minuts, una sola vegada. Només necessites l'ordinador per configurar-ho; després, l'app es fa servir
des del mòbil. No cal instal·lar res ni escriure cap ordre.

**Cost:** gratuït. Tot el que hi ha a continuació cap als plans gratuïts de GitHub, Vercel i Supabase.

---

## 1. Aconsegueix el codi (GitHub)

1. Crea't un compte gratuït a [github.com](https://github.com) si no en tens, i entra-hi.
2. Obre [github.com/guillemlo/finances](https://github.com/guillemlo/finances), prem **Fork** (a dalt a la dreta) i
   després **Create fork**. Ara tens la teva pròpia còpia del codi al teu compte.

El teu fork és públic, com l'original, però només conté el codi: les teves dades no van mai a GitHub.

## 2. Publica l'app (Vercel)

1. Ves a [vercel.com](https://vercel.com) i tria **Sign Up** → **Continue with GitHub**.
2. Prem **Add New…** → **Project**.
3. Al costat del teu fork (`finances`), prem **Import**. Si no hi surt, tria **Adjust GitHub App Permissions** i
   dona a Vercel accés a aquest repositori.
4. **Project Name**: tria un nom. L'adreça de la teva app serà `https://<nom>.vercel.app`.
5. Prem **Deploy** i espera que acabi (uns 2 minuts). L'app encara no funcionarà: li falta la base de dades. És el
   pas següent.

## 3. Crea la base de dades (Supabase, des de Vercel)

1. Al teu projecte de Vercel, obre la pestanya **Storage** i prem **Create Database**.
2. Tria **Supabase** i prem **Continue**. Accepta les condicions si te les demana.
3. **Region**: tria **Frankfurt** (Central EU). És la més propera a on s'executa l'app.
4. Posa-li qualsevol nom i crea-la. Quan et demani a quins entorns la connectes, deixa'ls tots (Production, Preview
   i Development) i prem **Connect**.

Vercel ja sap com arribar a la teva base de dades. No cal copiar cap contrasenya.

## 4. Crea el teu usuari (Supabase)

L'app no té cap pàgina pública per registrar-se: el teu usuari el crees tu, una sola vegada.

1. A Vercel → **Storage**, obre la base de dades i prem **Open in Supabase**.
2. Ves a **Authentication** → **Sign In / Providers**. Desactiva «Allow new users to sign up» i prem **Save**
   (deixa activat el proveïdor Email). Així ningú més pot crear-se un compte a la teva app.
3. Ves a **Authentication** → **Users** → **Add user** → **Create new user**.
4. Escriu el teu correu i una contrasenya segura, marca **Auto Confirm User** i prem **Create user**.

L'app no envia mai correus: hi entres amb aquest correu i aquesta contrasenya. Si algun dia oblides la contrasenya,
la pots canviar aquí mateix, a la pàgina del teu usuari.

## 5. Configuració (Vercel)

Al teu projecte de Vercel, ves a **Settings** → **Environment Variables** i afegeix aquestes variables, d'una en
una (**Key** i **Value**, i després **Save**):

| Key | Value | Per què |
|---|---|---|
| `ALLOWED_EMAILS` | el teu correu | Només aquest correu pot entrar. |
| `CRON_SECRET` | un text llarg a l'atzar, p. ex. 40 lletres i xifres del generador del teu gestor de contrasenyes | Protegeix la tasca diària que actualitza els preus i envia els avisos. No l'hauràs d'escriure mai més. |
| `EODHD_API_KEY` | *(opcional)* la teva clau gratuïta d'[eodhd.com](https://eodhd.com) | Preus diaris automàtics d'accions i fons dels EUA i d'Europa. |

Els preus de les criptomonedes (Coinbase) i els tipus de canvi (Banc Central Europeu) funcionen sense cap clau.
Sense `EODHD_API_KEY`, o per a accions que EODHD no cobreix (per exemple, les que cotitzen a Tel Aviv), el preu
l'escrius tu a la pàgina de la posició.

Després ves a la pestanya **Deployments**, obre el menú (**⋯**) del més recent i prem **Redeploy**. Aquest
desplegament també crea les taules de la base de dades. Espera que posi **Ready**.

## 6. Comença a fer-la servir (el mòbil)

1. A l'iPhone, obre `https://<nom>.vercel.app` amb **Safari** i entra.
2. Tria l'idioma, la divisa i les categories que faràs servir.
3. Prem el botó **Comparteix** → **Afegeix a la pantalla d'inici**. A partir d'ara, obre-la des d'aquesta icona:
   funciona a pantalla completa i també sense connexió (el que apuntis sense xarxa s'envia quan en tornis a tenir).
4. Opcional: **Ajustos** → **Notificacions** per rebre un avís diari (a l'iPhone només funciona si obres l'app des de
   la icona de la pantalla d'inici).

La **pestanya Fiscal** (plusvàlues i IRPF) surt desactivada: només serveix a Espanya. La pots activar a **Ajustos**
si mai la necessites.

## 7. Porta les teves dades antigues (opcional)

Si portaves les finances en un full de càlcul, és més còmode fer-ho des de l'ordinador:

1. Al Google Sheets, obre la pestanya amb els moviments (al full de Finances, **Data**) i tria **Fitxer** →
   **Baixa** → **Valors separats per comes (.csv)**.
2. Obre la teva app al navegador de l'ordinador, entra-hi i ves a **Ajustos** → **Importar d'un full de càlcul**.
3. Tria el fitxer. El full de Finances es reconeix sol; amb qualsevol altre, indica quina columna és cada cosa.
   Revisa on va cada categoria i prem **Importar**.

El fitxer es llegeix al teu navegador i els moviments van directament a la teva base de dades. Si tornes a importar
el mateix fitxer, no es duplica res: més endavant en pots importar una versió actualitzada.

---

## Rebre actualitzacions

Quan hi hagi una versió nova de l'app:

1. Obre el teu fork a GitHub.
2. Prem **Sync fork** → **Update branch**.

Això és tot. Vercel publica la versió nova tot sol en uns 2 minuts, i qualsevol canvi que necessiti la base de dades
s'aplica automàticament. Si alguna vegada falla en publicar-se, la versió anterior continua en línia: obre Vercel →
**Deployments**, obre el desplegament que ha fallat i envia els **Build Logs** a qui t'ha passat l'app.

## Bo de saber

- **Les teves dades** només són al teu projecte de Supabase. Pots veure les taules a Supabase → **Table Editor**.
- **Inactivitat:** Supabase pot pausar els projectes gratuïts que no es fan servir durant una setmana. La tasca
  diària de l'app toca la base de dades cada dia, i normalment això ho evita. Si algun cop es pausa, obre Supabase i
  prem **Restore**.
- **Canviar l'idioma o la divisa** més endavant: **Ajustos** a l'app. Canviar la divisa no converteix els imports
  que ja has desat; només canvia el símbol amb què es mostren.
