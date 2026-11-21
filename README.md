# trip-planner

Kişisel gezi planlayıcı. Google Maps "Kaydedilenler" listesinden, otele olan süre ve aktivite tercihine göre öneri üretir.

## Durum: Adım 1 – Paylaşılan listeyi okuma

- `functions/api/list.js` → `GET /api/list?url=<paylaşım linki>` listeyi JSON olarak döner (Cloudflare Pages Function).
- `public/index.html` → linki yapıştırıp sonucu gören basit test sayfası.
- `scripts/test_list.py` → aynı mantığın yerel Python testi (sadece standart kütüphane).

> Not: Liste okuma, Google Maps'in kendi sayfasının kullandığı resmi olmayan bir endpoint'e dayanıyor. Google değiştirirse bozulabilir.

## Yerel test

```bash
python scripts/test_list.py "https://maps.app.goo.gl/XXXX"
```

## Cloudflare Pages'e deploy

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → *Connect to Git* → bu repoyu seç.
2. Build ayarları: Framework preset **None**, Build command **boş**, Build output directory **`public`**.
3. Deploy. `functions/` klasörü otomatik olarak `/api/*` altında çalışır.
4. `https://<proje>.pages.dev` adresini iPhone'da açıp linki yapıştır.

### Workers olarak deploy edildiyse

Cloudflare projeyi **Worker** olarak oluşturduysa `wrangler.jsonc` + `src/worker.js` devreye girer: `/api/*` istekleri aynı fonksiyonlara yönlenir, geri kalanı `public/` klasöründen sunulur. `wrangler.jsonc` içindeki `name`, dashboard'daki Worker adıyla aynı olmalı.
