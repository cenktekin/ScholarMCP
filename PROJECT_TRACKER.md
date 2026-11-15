# Project Tracker — ScholarMCP

## Durum

| Alan | Değer |
|------|-------|
| Sürüm | 1.1.0 (Unreleased: `year_range` JSON Schema düzeltmesi) |
| Son güncelleme | 2026-11-15 |
| Repo | `github.com/cenktekin/ScholarMCP` (fork) · upstream `lstudlo/ScholarMCP` |
| Stack | TypeScript + Node ≥20 · pnpm workspace · MCP SDK · Hono · Zod · Astro docs |
| Test | 59 test (vitest) · `pnpm check` (tsc --noEmit) · 4 GitHub Actions workflow'u |
| Aktif branch | `main` (T6 birleştirmesi sonrası) |
| Dosya boyutu | `src/**/*.ts` içinde 400 satır üstü dosya yok (2026-11-15) |

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

## Yapılanlar (2026-11-15)

| # | Kalem | Durum | Kanıt |
|---|-------|-------|-------|
| T6 | `fix/year-range-json-schema` → `main` (lokal merge + push) | ✅ | `main` = branch HEAD · `git rev-list --count fix/..main` = 0 |
| T7 | 400 satır üstü dosyaları böl | ✅ | `create-scholar-mcp-server.ts` 666→56 · ingestion 609→274 · literature 545→294 · citation 540→245 · start-http-server 457→297 · `src` içinde >400 satır dosya **0** |
| T8 | `generate-docs-releases.mjs` tag listesini siliyordu | ✅ | Boş tag listesinde dosyaya dokunmuyor; `git diff apps/docs/.../releases/index.mdx` **boş** |
| T9 | pnpm `ERR_PNPM_IGNORED_BUILDS` | ✅ | `allowBuilds: {esbuild: true, sharp: true}` (pnpm 11 şeması) · `pnpm install` build adımlarını çalıştırdı, uyarı yok |

**T7 sonrası modül haritası:**

| Modül | Sorumluluk |
|-------|-----------|
| `mcp/create-scholar-mcp-server.ts` | Sunucu kurulumu + registrar sırası (56 satır) |
| `mcp/tools/{search,ingestion,citation,reference}-tools.ts` | 10 MCP tool tanımı, domain bazlı |
| `mcp/tool-helpers.ts` | `McpToolContext`, hata eşleme, ortak şemalar |
| `research/ingestion-{parsing,pdf-source}.ts` | Metin ayrıştırma · PDF indirme/keşif · parser adaptörleri |
| `research/literature-{ranking,merge}.ts` | Skor/eşleştirme yardımcıları · provider merge + rank |
| `research/citation-formatting.ts` | CSL/BibTeX biçimlendirme ve atıf ayrıştırma |
| `http/http-security.ts` · `http/http-session-store.ts` | Host/origin/auth + CORS · oturum yaşam döngüsü |

**Doğrulama kapıları (2026-11-15, Windows 11 · pnpm 11.28.9):**

| Kapı | Sonuç |
|------|-------|
| `pnpm check` | ✅ 0 hata |
| `pnpm test` | ✅ 12 dosya / **59 test** |
| `pnpm release:check` | ✅ exit 0 · pack 41 dosya |
| `pnpm docs:build` | ✅ `Complete!` · `mcp-tools.mdx` yalnız başlık satırı değişti (10 tool korunuyor) |
| `git diff releases/index.mdx` | ✅ boş (T8) |
| `pnpm install` | ✅ ignored-builds uyarısı yok (T9) |

## Açık İşler

| # | İş | Efor | Not |
|---|-----|------|-----|
| T6 | ~~branch'i main'e indir~~ | — | ✅ 2026-11-15 — lokal merge + push |
| T7 | ~~400 satır üstü dosyaları böl~~ | — | ✅ 2026-11-15 — `src` içinde >400 satır dosya yok |
| T8 | ~~`generate-docs-releases.mjs` tag listesini siliyor~~ | — | ✅ 2026-11-15 — tag yoksa dosyaya dokunmuyor |
| T9 | ~~pnpm `ignored build scripts`~~ | — | ✅ 2026-11-15 — `allowBuilds` bool haritası |
| T10 | Upstream `lstudlo/ScholarMCP` tag'lerini fork'a çekme (`git fetch --tags upstream`) | XS | T8 alternatifi; upstream remote tanımlı değil. Fayda düşük: fork kendi tag'ini `pnpm release` ile üretiyor |
| T11 | GitHub Actions fork'ta hiç koşmuyor | S | **BLOKE**: 2 push (`4d3c4b5`, `db66a0f`) sonrası `actions/runs` `total_count: 0`; 4 workflow `active`; `workflow_dispatch` yok. Muhtemel neden private repo Actions kısıtı. T6'nın "CI yeşil" ayağı doğrulanamadı |
| — | Stale `dist/` yenileme | — | Ertelendi: `prepack` zaten build ediyor, düşük değer |
| — | Upstream drift / geri-merge stratejisi | — | Ertelendi: stratejik karar bekliyor |
| — | `RESEARCH_SEMANTIC_ENGINE=cloud-llm` için OpenAI-uyumlu uç | — | Ertelendi: kullanım kanıtı gelince |
| — | `pnpm audit` bağımlılık denetimi | — | Ertelendi: registry erişimi doğrulanmadı |

## Kararlar

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-11-15 | pnpm build onayı `onlyBuiltDependencies` değil `allowBuilds: {pkg: true}` ile yazılacak | pnpm 11.28.9 `onlyBuiltDependencies`'ı yok sayıyor (uyarı sürüyor); `allowBuilds` bool haritası build adımlarını çalıştırdı |
| 2026-11-15 | `generate-docs-api.mjs` tek dosya yerine `src/mcp/**` ağacını tarar | T7 bölmesinden sonra tek dosya taraması 10 tool yerine 0 tool üretiyordu |
| 2026-11-15 | `generate-docs-releases.mjs` yerel tag yoksa mevcut `releases/index.mdx`'e dokunmaz | Fork'ta tag yok; üretmek upstream tag listesini siliyordu. Upstream API'sine bağımlılık (ağ + token) yerine muhafazakâr guard seçildi |
| 2026-11-15 | `fix/year-range-json-schema` lokal merge + push ile main'e indirildi | Cenk Abi onayı; kendi fork'u, PR döngüsü gereksiz |
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
