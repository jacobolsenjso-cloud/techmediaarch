@echo off
rem Udgiver tma-push (10/11-2026). ALTID med -c wrangler.toml: uden den tager wrangler sitets egen opsætning
rem (wrangler.jsonc i repoets rod) og ville sende sitet op under forkert navn (fundet 4/11 ved tma-starter).
cd /d "%~dp0"
npx --yes wrangler deploy -c wrangler.toml
