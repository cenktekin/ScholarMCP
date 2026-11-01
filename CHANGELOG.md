# Changelog

Tüm önemli değişiklikler bu dosyada. Format: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/), sürümleme [SemVer](https://semver.org/lang/tr/).

> Not: `v1.1.0` ve öncesi sürümler bu fork'a devralındı; commit geçmişleri upstream
> ([lstudlo/ScholarMCP](https://github.com/lstudlo/ScholarMCP)) deposunda bulunur.
> O sürümlerin ayrıntılı notları için GitHub Releases sayfasına bakın.

## [Unreleased]

### Düzeltme
- `year_range` parametresi JSON Schema 2020-12 ile uyumsuzdu: `z.tuple()` şeması MCP istemcilerinde
  doğrulama hatası veriyordu. Tuple kaldırıldı (`e8f2865`, `fix/year-range-json-schema`).
- `year_range` için `start <= end` doğrulaması eklendi; ters aralık artık hata döndürüyor (`84811fb`).
- **`pack` / `pack:dry-run` Windows'ta çalışmıyordu:** script'ler POSIX env-prefix sözdizimi
  kullanıyordu (`npm_config_cache=../../.npm-cache npm pack`), `cmd.exe` bunu komut sanıp
  `'npm_config_cache' is not recognized` hatası veriyordu. `npm pack --cache=../../.npm-cache`
  biçimine çevrildi; `pnpm release:check` artık Windows'ta da yeşil.

### Eklenen
- `.env.example` — 40 ortam değişkeninin şablonu, varsayılanlar `src/config.ts` şemasıyla birebir.
  `.gitignore`'a `!.env.example` istisnası eklendi.
- `CHANGELOG.md` (bu dosya) ve `PROJECT_TRACKER.md` — standart proje dosya seti tamamlandı.

### Bakım
- **Çalışma ağacı onarıldı:** yanlışlıkla alt klasöre taşınan 5 dosya geri getirildi —
  `scripts/release.mjs`, `scripts/generate-docs-api.mjs`, `scripts/generate-docs-releases.mjs`,
  `procedures/release-sop.md`, `public/scholarmcp_banner.png`. Çöp `ScholarMCP/` dizini arşive taşındı.
- `pnpm-workspace.yaml` içindeki geçersiz `allowBuilds` placeholder bloğu silindi
  (`esbuild: set this to true or false`) — pnpm workspace config'i bozuyordu.
- Öksüz `packages/scholar-mcp/package-lock.json` (132 KB, npm lockfile) arşive taşındı;
  workspace `pnpm-lock.yaml` kullanıyor, karışık lockfile `--frozen-lockfile` CI'ını riske atıyordu.

## [1.1.0] — 2026-03-11

- Upstream sürümü. Ayrıntı: [GitHub Releases — v1.1.0](https://github.com/lstudlo/ScholarMCP/releases/tag/v1.1.0).

## [1.0.8] — 2026-02-27

- Upstream sürümü. Ayrıntı: [GitHub Releases — v1.0.8](https://github.com/lstudlo/ScholarMCP/releases/tag/v1.0.8).

## [1.0.7] — 2026-02-23

- Upstream sürümü. Ayrıntı: [GitHub Releases — v1.0.7](https://github.com/lstudlo/ScholarMCP/releases/tag/v1.0.7).

## [1.0.3] — 2026-02-22

- Upstream sürümü. Ayrıntı: [GitHub Releases — v1.0.3](https://github.com/lstudlo/ScholarMCP/releases/tag/v1.0.3).

## [1.0.2] — 2026-02-22

- Upstream sürümü. Ayrıntı: [GitHub Releases — v1.0.2](https://github.com/lstudlo/ScholarMCP/releases/tag/v1.0.2).

## [1.0.1] — 2026-02-22

- İlk etiketli sürüm. Ayrıntı: [GitHub Releases — v1.0.1](https://github.com/lstudlo/ScholarMCP/releases/tag/v1.0.1).
