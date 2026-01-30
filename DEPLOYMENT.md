# Deployment Guide (Railway + Supabase)

Follow these steps to deploy your **Absensi Broadcast App** to the cloud.

## Part 1: Supabase Setup (Database)

1.  **Create Project**: Go to [Supabase.com](https://supabase.com), create a new project.
2.  **Get Credentials**:
    *   Go to **Project Settings > API**.
    *   Copy **Project URL** (will be `SUPABASE_URL`).
    *   Copy **service_role** secret (will be `SUPABASE_KEY`). *Note: Use service_role to allow the backend to read/write settings without complex Row Level Security rules.*
3.  **Create Table**:
    *   Go to **SQL Editor** in sidebar.
    *   Paste and run this SQL command:

```sql
CREATE TABLE app_settings (
  id int8 PRIMARY KEY,
  config jsonb
);

-- (Optional) Initial Insert for safety
INSERT INTO app_settings (id, config) 
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
```

## Part 2: Railway Setup (Hosting)

1.  **Create Project**: Go to [Railway.app](https://railway.app), create a new project from your **GitHub Repository**.
2.  **Add Variables**:
    *   Go to the **Variables** tab of your service.
    *   Add the following variables (Copied from your local `.env` + Supabase):

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `BASE_URL` | `https://member.gaji.id/gajiid-API` | URL Gaji.id (sama seperti .env) |
| `SECRET_KEY` | *(Likely D8AE...)* | Secret Key Gaji.id (sama seperti .env) |
| `API_ID` | *(Likely 5509...)* | API ID Gaji.id (sama seperti .env) |
| `API_PATH` | `/open-api/dr-absensi-harian/search` | Path API Gaji.id (sama seperti .env) |
| `SUPABASE_URL` | `https://xyz.supabase.co` | **[NEW]** Dari Part 1 |
| `SUPABASE_KEY` | `eyJh...` | **[NEW]** Dari Part 1 (service_role) |
| `TZ` | `Asia/Jakarta` | Set Timezone ke WIB |
| `PORT` | `3000` | (Opsional, Railway biasanya auto-detect) |

3.  **Deploy**: Railway will automatically build and deploy `node server.js` based on your `package.json`.

## Part 3: WAHA Connection

Your app needs to talk to WAHA (`waha.gamaagro.com` or similar).

1.  Open your deployed App URL (e.g., `https://gaji-monitor-production.up.railway.app`).
2.  Go to **Broadcast WA** menu.
3.  Set **WAHA API URL** to your WAHA Public URL (e.g. `https://waha.mydomain.com`).
4.  Set **Session ID** and **Target Number**.
5.  Click **Save Pengaturan**.
    *   *This will now save permanently to Supabase!*

## Troubleshooting

-   **Logs**: Check generic logs in Railway dashboard if the app crashes.
-   **Database**: Check Supabase Table Editor (`app_settings` table) to see if the JSON data is being updated when you click "Save".
