# Project Tracker — ScholarMCP

## Durum

| Alan | Değer |
|------|-------|
| Sürüm | 1.1.0 (Unreleased: `year_range` JSON Schema düzeltmesi) |
| Son güncelleme | 2026-11-01 |
| Repo | `github.com/cenktekin/ScholarMCP` (fork) · upstream `lstudlo/ScholarMCP` |
| Stack | TypeScript + Node ≥20 · pnpm workspace · MCP SDK · Hono · Zod · Astro docs |
| Test | 59 test (vitest) · `pnpm check` (tsc --noEmit) · 4 GitHub Actions workflow'u |
| Aktif branch | `fix/year-range-json-schema` (main'den 2 commit ileri) |

## Sağlık

| Alan | 2026-10-17 | Not |
|------|-----------|-----|
| Genel skor | **67/100** | İlk denetim; yeniden ölçüm yapılmadı |
| Çalışma ağacı | Kırık → **onarıldı** | 5 silinmiş dosya geri geldi, çöp dizin arşivlendi |
| Workspace config | Geçersiz → **geçerli** | `allowBuilds` placeholder bloğu silindi |
| Doküman seti | Eksik → **tamam** | `.env.example`, `CHANGELOG.md`, `PROJECT_TRACKER.md` eklendi |

> Yeniden denetim: `/proje-denetim @ScholarMCP tam orta`

## Yapılanlar (2026-11-01)

| # | Kalem | Durum | Kanıt |
|---|-------|-------|-------|
| T1 | Çalışma ağacı onarımı — 5 dosya geri, çöp dizin arşive | ✅ | `git status` temiz (yalnız takipsiz `NEXT_ACTIONS.md`) |
| T2 | `pnpm-workspace.yaml` geçersiz `allowBuilds` bloğu | ✅ | `git checkout -- pnpm-workspace.yaml` |
| T3 | Öksüz `package-lock.json` arşive | ✅ | `packages/scholar-mcp/package-lock.json` yok |
| T4 | `.env.example` + `.gitignore` istisnası | ✅ | 40 değişken, `config.ts` şemasıyla birebir |
| T5 | `CHANGELOG.md` + `PROJECT_TRACKER.md` | ✅ | Bu dosyalar |
| T6 | `fix/year-range-json-schema` → main | ⏳ Açık | Karar gerekiyor (aşağıda) |

**Doğrulama kapıları (2026-11-01, Windows 11 · pnpm 11.28.9):**

| Kapı | Sonuç |
|------|-------|
| `pnpm check` (tsc --noEmit) | ✅ 0 hata |
| `pnpm test` (vitest) | ✅ 12 dosya / **59 test** |
| `pnpm pack:dry-run` | ✅ 29 dosya · 408.5 kB — **düzeltme sonrası** |
| `pnpm release:check` | ✅ exit 0 (düzeltme öncesi Windows'ta kırıktı) |
| `pnpm docs:build` | ✅ `Complete!` · astro check 0 error / 0 warning |
| `pnpm release` (tam) | ⏸️ Çalıştırılmadı — push + `gh release create` yapıyor, onay ister |

Arşiv: `D:\projects\_yedek\scholarmcp-onarim-20261101-093029`

## Açık İşler

| # | İş | Efor | Not |
|---|-----|------|-----|
| T6 | `fix/year-range-json-schema` branch'ini main'e indir (merge veya PR) | S | Branch 2 commit ileri; `year_range` tuple düzeltmesi main'e girmedi |
| T7 | `create-scholar-mcp-server.ts` (629 satır) böl | L | Tüm MCP tool tanımları tek dosyada; 4 dosya >400 satır. Upstream fork → merge çakışma riski |
| T8 | `generate-docs-releases.mjs` fork'ta tag listesini siliyor | S | Script yerel `git tag`'leri okuyor; fork'ta tag yok → `releases/index.mdx` "No semantic version tags found" üretiyor ve upstream tag listesini siliyor. Upstream API'sini veya etiket fallback'ini kullanmalı. `docs:build` her çalıştığında dosya yeniden bozuluyor — commit'te revert edildi |
| T9 | pnpm `ignored build scripts` uyarısı (esbuild, sharp) | XS | `pnpm approve-builds` ile geçerli `onlyBuiltDependencies` listesi yazılmalı; denetimdeki geçersiz `allowBuilds` placeholder'ının doğru karşılığı. Şu an sadece uyarı, build'leri engellemiyor |
| — | Stale `dist/` yenileme | — | Ertelendi: `prepack` zaten build ediyor, düşük değer |
| — | Upstream drift / geri-merge stratejisi | — | Ertelendi: stratejik karar bekliyor |
| — | `RESEARCH_SEMANTIC_ENGINE=cloud-llm` için OpenAI-uyumlu uç | — | Ertelendi: kullanım kanıtı gelince |
| — | `pnpm audit` bağımlılık denetimi | — | Ertelendi: registry erişimi doğrulanmadı |

## Kararlar

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-11-01 | `pnpm release` doğrulaması `release:check` ile yapılacak, tam release çalıştırılmayacak | `scripts/release.mjs` sürüm bump + commit + tag + **push** + `gh release create` yapıyor; geri dönüşü zor, onay ister |
| 2026-11-01 | npm lockfile arşivlendi, silinmedi | Workspace `pnpm-lock.yaml` kullanıyor; arşiv geri dönüş kapısı bırakır |
| 2026-10-17 | Kapsamlı test kapsamı kovalanmayacak | 59 test + typecheck + CI zaten yeşil |
| 2026-10-17 | Web UI / dashboard / PWA eklenmeyecek | Proje bir MCP sunucusu, ek yüzey gereksiz |

## Referanslar

- `NEXT_ACTIONS.md` — denetim dönüş çapası (takip edilir, `.gitignore`'a eklenmez)
- `CHANGELOG.md` — sürüm geçmişi
- `MASTER_PROJECT_LEDGER.md` → `### ScholarMCP` — portföy kaydı
- `~\.commandcode\audit-runs\scholarmcp-2026-10-17.md` — denetim logu
- Joplin: `Teknik Notlar` → id `dc36d9f2d4b14698821455b338cb1898`
