@echo off
rem Udgiver tma-starter (og KUN den) til Cloudflare. -c er nødvendig: uden den valgte wrangler sitets egen
rem opsætning i repoets rod (målt 4/11-2026). Testen køres først; fejler den, udgives intet.
cd /d %~dp0
node test.mjs || (echo TEST FEJLEDE - intet udgivet & exit /b 1)
npx wrangler deploy -c wrangler.toml
