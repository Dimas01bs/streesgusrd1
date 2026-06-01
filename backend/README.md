# Backend Deteksi Dini Tingkat Stres

Backend ini dibuat agar sesuai dengan rencana frontend React/Vite pada dokumen `gemini-code-1778744192011.md`. API berfokus pada:

- menerima input pola tidur harian,
- menghitung prediksi tingkat stres secara real-time,
- menyimpan riwayat prediksi,
- menyediakan ringkasan dashboard untuk visualisasi frontend.

## Stack

- Express.js
- PostgreSQL
- Zod
- Vitest + Supertest

## Menjalankan Lokal

1. Install Node.js LTS.
2. Masuk ke folder `backend`.
3. Jalankan `npm install`.
4. Salin `.env.example` menjadi `.env`.
5. Jalankan `npm run dev`.

## Kontrak API Utama

Base URL default: `http://localhost:5000/api/v1`

### `GET /health`

Health check server dan database.

### `GET /meta/form`

Mengembalikan metadata form agar frontend punya opsi label, batas nilai, dan field yang konsisten.

### `POST /predictions`

Menerima data:

```json
{
  "sleepDate": "2026-05-14",
  "sleepDurationHours": 5.5,
  "sleepQuality": 4,
  "bedtimeConsistency": 3,
  "awakeningsCount": 3,
  "daytimeFatigue": 8,
  "screenTimeBeforeBedMinutes": 120,
  "caffeineIntakeCups": 3,
  "sleepLatencyMinutes": 40,
  "notes": "Sering terbangun tengah malam"
}
```

Response:

```json
{
  "success": true,
  "message": "Prediction generated successfully.",
  "data": {
    "id": 1,
    "sleepDate": "2026-05-14",
    "stressLevel": "Tinggi",
    "stressScore": 78,
    "confidence": 0.89,
    "recommendations": [
      "Kurangi screen time minimal 30 menit sebelum tidur.",
      "Batasi konsumsi kafein setelah pukul 14.00.",
      "Pertimbangkan rutinitas relaksasi ringan sebelum tidur."
    ]
  }
}
```

### `GET /predictions`

Riwayat prediksi, mendukung query `page`, `limit`, dan `stressLevel`.

### `GET /predictions/:id`

Detail satu prediksi.

### `GET /dashboard/summary`

Ringkasan untuk dashboard frontend:

- distribusi tingkat stres,
- rata-rata skor,
- tren 7 hari terakhir,
- daftar prediksi terbaru.

## Database

Backend menggunakan PostgreSQL melalui environment variable `DATABASE_URL`.

Contoh:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stressguard
```

Saat deploy production, gunakan connection string PostgreSQL dari provider seperti Railway, Render, Supabase, Neon, atau layanan PostgreSQL lain.

Jika PostgreSQL berjalan sebagai container dalam Docker network yang sama dengan backend:

```env
DATABASE_URL=postgresql://postgres:postgres@stressguard-postgres:5432/stressguard
```

## Catatan Integrasi Model ML

Service saat ini memakai `MODEL_PROVIDER=heuristic` agar aplikasi tetap berjalan walau file model ML belum tersedia di repository. Lapisan inferensi sudah dipisah di `src/services/prediction.service.js`, jadi AI Engineer bisa mengganti implementasi tersebut dengan model `.keras` atau SavedModel tanpa mengubah controller/route.

## Testing

Jalankan:

```bash
npm test
```

## Deployment

- Render: gunakan file `render.yaml`
- Railway: gunakan file `railway.json`

Pastikan env production minimal mengatur:

- `PORT`
- `FRONTEND_ORIGIN`
- `DATABASE_URL`
- `MODEL_PROVIDER`
- `MODEL_VERSION`
