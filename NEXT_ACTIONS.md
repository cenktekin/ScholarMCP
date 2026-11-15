# NEXT_ACTIONS — ScholarMCP

> **Amaç:** Bu dosya ScholarMCP denetiminin **dönüş çapasıdır** (resume anchor). Yeni bir oturumda
> `ScholarMCP\NEXT_ACTIONS.md oku ve uygula` cümlesiyle kaldığın yerden devam edilir.
> `.gitignore`'a EKLEME — takip edilen çapa olarak kalsın.

**Son denetim:** 2026-10-17 · **mod:** ince · **agresiflik:** orta · **sağlık skoru:** **67/100**
(eski puan **yok** — Ledger'da ScholarMCP kaydı bulunamadı, **ilk denetim**)

**Referanslar:**
- Ledger bölümü: `MASTER_PROJECT_LEDGER.md` → `### ScholarMCP`
- Joplin notu: `Teknik Notlar` → id `dc36d9f2d4b14698821455b338cb1898`
- TickTick devir task'ı: id `6ae6e0b58f083c2a9de5ca1a` (proje `6a775ef6e9aef50000000c17` · vade 2026-11-15)
  — önceki kontrol task'ı `6ad3dadf8f08e04af364f1c1` 2026-11-01'de kapatıldı
- Denetim logu: `~\.commandcode\audit-runs\scholarmcp-2026-10-17.md`

**Sıradaki komut:**
```text
ScholarMCP\NEXT_ACTIONS.md oku — açık kalem yok, yalnız T10 (upstream tag) ve ertelenenler var
```

---

## YAPILACAKLAR

| # | Kalem | Efor | Durum |
|---|-------|------|-------|
| T1 | Çalışma ağacını onar — 5 dosya geri, `ScholarMCP/` çöp dizinini arşive | XS | ✅ 2026-11-01 |
| T2 | `pnpm-workspace.yaml` geçersiz `allowBuilds` bloğunu sil | XS | ✅ 2026-11-01 |
| T3 | Öksüz `packages/scholar-mcp/package-lock.json`'u arşive taşı | XS | ✅ 2026-11-01 |
| T4 | `.env.example` ekle (takip edilen) | XS | ✅ 2026-11-01 |
| T5 | `CHANGELOG.md` + `PROJECT_TRACKER.md` ekle | S | ✅ 2026-11-01 |
| T6 | **`fix/year-range-json-schema` branch'ini main'e indir** | S | ✅ 2026-11-15 — lokal merge + push |
| T7 | 400 satır üstü dosyaları böl (5 dosya) | L | ✅ 2026-11-15 — `src` içinde >400 satır dosya kalmadı |
| T8 | `generate-docs-releases.mjs` tag listesini siliyor | S | ✅ 2026-11-15 — tag yoksa dosyaya dokunmuyor |
| T9 | pnpm `ignored build scripts` (esbuild, sharp) | XS | ✅ 2026-11-15 — `allowBuilds` bool haritası |
| T10 | Upstream `lstudlo/ScholarMCP` tag'lerini fork'a çek (`git fetch --tags upstream`) | XS | ⏳ AÇIK — düşük fayda, karar bekliyor |


**Doğrulama (2026-11-01):** `pnpm check` ✅ · 59 test ✅ · `pack:dry-run` ✅ (Windows düzeltmesi sonrası) ·
`release:check` ✅ exit 0 · `docs:build` ✅. Detay: `PROJECT_TRACKER.md`.

**Doğrulama (2026-11-15):** `pnpm check` ✅ 0 hata · 59/59 test ✅ · `release:check` ✅ exit 0 (pack 41 dosya) ·
`docs:build` ✅ `Complete!` · `git diff releases/index.mdx` ✅ boş · `pnpm install` ✅ ignored-builds uyarısı yok ·
`src` içinde 400 satır üstü dosya: **0**.

**TUR — kapanış 2026-11-15**
T6 lokal merge + push ile kapandı (`main` = branch HEAD). T7'de beş dosya bölündü:
`create-scholar-mcp-server.ts` 666→56 (+ `tools/*`, `tool-helpers.ts`), ingestion 609→274
(+ `ingestion-parsing.ts`, `ingestion-pdf-source.ts`), literature 545→294 (+ `literature-ranking.ts`,
`literature-merge.ts`), citation 540→245 (+ `citation-formatting.ts`), start-http-server 457→297
(+ `http-security.ts`, `http-session-store.ts`). T7 yan etkisi: `generate-docs-api.mjs` tek dosya taradığı
için 10 tool yerine 0 tool üretmeye başladı — `src/mcp/**` ağacını tarayacak şekilde düzeltildi.
T8'de tag yokken dosyayı ezip geçen yazma guard'landı. T9'da pnpm 11 şeması `allowBuilds: {esbuild: true,
sharp: true}` kullanıldı; `onlyBuiltDependencies` bu sürümde yok sayılıyor (task metnindeki öneri yanlıştı).
Testler modül sınırlarına uyarlandı (`ingestion-service.test.ts` iç metod spy'ları yerine modül fonksiyonları).

**Arşiv:** `D:\projects\_yedek\scholarmcp-onarim-20261101-093029`

## ERTELENEN
- Stale `dist/` yenileme (gitignored; `prepack` zaten build ediyor) — düşük değer
- Upstream (`lstudlo/ScholarMCP`) ile drift takibi / geri-merge — stratejik karar bekliyor
- `RESEARCH_SEMANTIC_ENGINE=cloud-llm` çıkarım LLM'i için OpenAI-uyumlu uç (Command Code provider) ayarı — kullanım kanıtı gelince
- Bağımlılık güvenlik denetimi (`pnpm audit`) — bu koşuda ağ/registry erişimi doğrulanamadı

## REDDEDİLEN (gimmick / orantısız)
- Yeni arama sağlayıcısı ekleme (PubMed/Scopus) — kullanım kanıtı yok
- Web UI / dashboard, PWA, mobil yüzey — proje bir MCP sunucusu, yüzey gereksiz
- Kapsamlı test kapsamı kovalama — mevcut 59 test + typecheck + CI zaten yeşil
