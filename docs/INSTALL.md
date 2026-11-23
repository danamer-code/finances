# Your own copy of Finances

**English** · [Català](INSTALL.ca.md)

Finances is a personal finance app for your phone: you note an expense in a few seconds, and it shows your month,
your year and your investment portfolio. It works in English, Hebrew and Catalan, with shekels, dollars or euros.

This guide sets up **your own copy**. It runs on your own free accounts, and your data lives only in your own
database: nobody else, including the person who shared the code with you, can see it.

It takes about 20 minutes, once. You only need a computer for the setup; afterwards you use the app on your
phone. You don't need to install anything or type any commands.

**Cost:** free. Everything below fits in the free plans of GitHub, Vercel and Supabase.

---

## 1. Get the code (GitHub)

1. Create a free account at [github.com](https://github.com) if you don't have one, and send your GitHub
   username to the person sharing the app with you.
2. You will get an invitation by email. Open it and press **Accept invitation**.
3. On the repository page, press **Fork** (top right) and then **Create fork**. You now have your own copy of
   the code under your account.

## 2. Publish the app (Vercel)

1. Go to [vercel.com](https://vercel.com) and choose **Sign Up** → **Continue with GitHub**.
2. Press **Add New…** → **Project**.
3. Next to your fork (`finances`), press **Import**. If you don't see it, choose **Adjust GitHub App
   Permissions** and give Vercel access to that repository.
4. **Project Name**: choose a name. Your app's address will be `https://<name>.vercel.app`.
5. Press **Deploy** and wait for it to finish (about 2 minutes). The app won't work yet: it still has no
   database. That's the next step.

## 3. Create your database (Supabase, from Vercel)

1. In your Vercel project, open the **Storage** tab and press **Create Database**.
2. Choose **Supabase** and press **Continue**. Accept the terms if asked.
3. **Region**: choose **Frankfurt** (Central EU). It's the closest to where the app runs.
4. Give it any name and create it. When asked which environments to connect, keep all of them
   (Production, Preview and Development) and press **Connect**.

Vercel now knows how to reach your database. You don't need to copy any passwords.

## 4. Create your login (Supabase)

The app has no public sign-up page: you create your own user once.

1. In Vercel → **Storage**, open your database and press **Open in Supabase**.
2. Go to **Authentication** → **Sign In / Providers**. Turn **off** "Allow new users to sign up" and press
   **Save**. (Leave the Email provider enabled.) This way nobody else can create an account in your app.
3. Go to **Authentication** → **Users** → **Add user** → **Create new user**.
4. Type your email and a strong password, tick **Auto Confirm User** and press **Create user**.

The app never sends emails: you sign in with this email and password. If you ever forget the password, you can
change it here, on your user's page.

## 5. Settings (Vercel)

In your Vercel project, go to **Settings** → **Environment Variables** and add these, one by one
(**Key** and **Value**, then **Save**):

| Key | Value | Why |
|---|---|---|
| `ALLOWED_EMAILS` | your email | Only this email can sign in. |
| `CRON_SECRET` | a long random text, e.g. 40 letters and numbers from your password manager's generator | Protects the daily job that updates prices and sends notifications. You never need to type it again. |
| `EODHD_API_KEY` | *(optional)* your free key from [eodhd.com](https://eodhd.com) | Automatic daily prices for US and European stocks and funds. |

Crypto prices (Coinbase) and exchange rates (European Central Bank) work without any key. Without `EODHD_API_KEY`,
or for shares that EODHD doesn't cover (for example, shares listed in Tel Aviv), you type the price yourself on
the holding's page.

Then go to the **Deployments** tab, open the menu (**⋯**) of the newest one and press **Redeploy**. This deploy
also creates your database tables. Wait until it says **Ready**.

## 6. Start using it (your phone)

1. On your iPhone, open `https://<name>.vercel.app` in **Safari** and sign in.
2. Pick your language (English / עברית), your currency (₪) and the categories you'll use.
3. Press the **Share** button → **Add to Home Screen**. From now on, open it from that icon: it works full screen,
   also offline (what you add without a connection is sent when you're back online).
4. Optional: **Settings** → **Notifications** to get a daily reminder (on iPhone this only works when the app is
   opened from the home screen icon).

The **Tax tab** (capital gains and Spanish income tax) is off: it only applies in Spain. You can turn it on in
**Settings** if you ever need it.

---

## Getting updates

When there's a new version of the app:

1. Open your fork on GitHub.
2. Press **Sync fork** → **Update branch**.

That's all. Vercel publishes the new version on its own in about 2 minutes, and any change the database needs is
applied automatically. If something ever goes wrong while publishing, the previous version stays online: open
Vercel → **Deployments**, open the failed one, and send the **Build Logs** to the person who shared the app.

## Good to know

- **Your data** is in your Supabase project only. You can see the raw tables in Supabase → **Table Editor**.
- **Inactivity:** Supabase may pause free projects that aren't used for a week. The app's daily job touches the
  database every day, which normally keeps it awake. If it's ever paused, open Supabase and press **Restore**.
- **Changing language or currency** later: **Settings** in the app. Changing the currency doesn't convert amounts
  you've already saved; it only changes the symbol they're shown with.
