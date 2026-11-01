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
ScholarMCP\NEXT_ACTIONS.md oku ve T6-T9 kalemlerini sırayla uygula
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
| T6 | **`fix/year-range-json-schema` branch'ini main'e indir/PR aç** | S | ⏳ AÇIK — karar bekliyor |
| T7 | `create-scholar-mcp-server.ts` (629 satır) böl | L | ⏳ AÇIK |
| T8 | `generate-docs-releases.mjs` fork'ta tag listesini siliyor | S | ⏳ AÇIK (2026-11-01'de bulundu) |
| T9 | pnpm `ignored build scripts` (esbuild, sharp) → `onlyBuiltDependencies` | XS | ⏳ AÇIK (2026-11-01'de bulundu) |

**Doğrulama (2026-11-01):** `pnpm check` ✅ · 59 test ✅ · `pack:dry-run` ✅ (Windows düzeltmesi sonrası) ·
`release:check` ✅ exit 0 · `docs:build` ✅. Detay: `PROJECT_TRACKER.md`.

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
