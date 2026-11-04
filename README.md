# PaintStock — Kontrola farb

Lokalna aplikacja webowa (PWA) do kontroli terminów ważności farb na dziale farb: skanowanie kodów kreskowych, wiele partii pod jednym kodem, kolorowe ostrzeżenia o terminach, lokalizacje, eksport/import. Bez kont, bez chmury, dane tylko na urządzeniu (IndexedDB).

> PaintStock jest niezależnym narzędziem. Nie jest produktem PPG i nie jest przez PPG autoryzowany.

## Pliki

| Plik | Rola | Wymagany? |
|---|---|---|
| `index.html` | Cała aplikacja: HTML + CSS + JS | **tak** |
| `sw.js` | Service Worker, czyli praca offline | do trybu offline |
| `manifest.webmanifest`, `icons/` | Instalacja na ekranie głównym (PWA) | opcjonalne |
| `vendor/zxing.min.js` | Skaner ZXing 0.21.3 (Apache-2.0) jako zapasowy silnik | zalecany, w razie braku pobierany z CDN |

## Uruchomienie

### ⚠️ Aparat wymaga HTTPS albo localhost

Przeglądarki udostępniają `getUserMedia()` (aparat) tylko w **bezpiecznym kontekście**:

- `https://…` – dowolny hosting z certyfikatem,
- `http://localhost` / `http://127.0.0.1` – serwer lokalny.

Pod adresem `http://192.168.x.x` (np. komputer w sieci lokalnej otwarty na telefonie) **aparat nie zadziała**. Aplikacja wtedy działa dalej, ale kody trzeba wpisywać ręcznie. W *Ustawienia → O aplikacji* widać, czy kontekst jest bezpieczny.

### A) Hosting HTTPS (zalecane dla telefonu z Androidem)

Wrzuć zawartość katalogu na dowolny statyczny hosting z HTTPS, np. GitHub Pages (Settings → Pages → branch), Netlify, Cloudflare Pages. Otwórz adres w Chrome na Androidzie, a potem w menu ⋮ wybierz **Zainstaluj aplikację** / **Dodaj do ekranu głównego**. Po pierwszym załadowaniu aplikacja działa offline.

Hosting serwuje tylko pliki aplikacji. Twoje dane nigdy tam nie trafiają.

### B) Komputer, serwer lokalny

```bash
cd paintstock
python3 -m http.server 8080
# otwórz http://localhost:8080
```

(albo `npx serve .`). Kamera internetowa działa, Service Worker też.

### C) Telefon podłączony do komputera kablem (bez hostingu)

```bash
python3 -m http.server 8080          # na komputerze
adb reverse tcp:8080 tcp:8080        # Android z włączonym debugowaniem USB
# na telefonie w Chrome: http://localhost:8080
```

Dla telefonu to `localhost`, więc aparat działa.

### D) Otwarcie pliku bezpośrednio (`file://`)

Dwuklik na `index.html` uruchamia aplikację, ale z ograniczeniami:

| Funkcja | `file://` |
|---|---|
| Lista, formularze, IndexedDB, eksport/import | ✅ działa (Chrome/Edge/Firefox na komputerze) |
| Aparat | ⚠️ zależy od przeglądarki: Chrome na komputerze zwykle pyta o zgodę i działa, inne mogą blokować |
| Service Worker (offline) | ❌ nie działa |
| Instalacja jako aplikacja | ❌ nie działa |
| Android | ❌ współczesny Chrome praktycznie nie otwiera lokalnych plików HTML. Użyj A lub C |

Dane zapisane przez `file://` są w innym „miejscu” niż dane z `http://localhost`. Przenosisz je eksportem/importem JSON.

## Skaner

- **Silniki:** natywny `BarcodeDetector` (Chrome na Androidzie z usługami Google Play), a gdy go brak, **ZXing** (JavaScript, np. Chrome na Linuksie/Windows, Firefox). Silnik można wymusić w ustawieniach.
- **Formaty:** EAN-13, EAN-8, Code 128, DataMatrix, o ile obsługuje je dany silnik. Lista aktywnych formatów jest pod podglądem.
- **Jeden odczyt na skan:** po wykryciu kodu detekcja jest blokowana do zamknięcia formularza, a ten sam kod jest ignorowany jeszcze przez 2,5 s (puszka zwykle jest wciąż w kadrze).
- **Latarka:** dostępna tylko gdy aparat zgłasza `torch` (większość Androidów; na komputerach zwykle brak).
- **Zwykły EAN nie zawiera daty ważności.** Datę i partię aplikacja odczytuje tylko z kodów **GS1** (DataMatrix/GS1-128) z identyfikatorami AI(17) i AI(10). Pole wypełnia się wtedy wstępnie i trzeba je potwierdzić. AI(11), czyli data produkcji, nigdy nie trafia do terminu.
- Aparat jest zwalniany przy wyjściu z zakładki Skaner, przejściu aplikacji w tło i zamknięciu strony.

## OCR daty (eksperymentalne)

Tesseract.js 5.1.1 (z CDN, przy pierwszym użyciu ok. 10–15 MB). Rozpoznaje `DD.MM.RRRR`, `DD-MM-RRRR`, `RRRR-MM-DD`, a z oznaczeniem niepewności także `DD.MM.RR` i `MM/RRRR`. Daty z opisem *PROD/MFG/data produkcji* są oznaczane jako produkcyjne i nie są podstawiane automatycznie. Każdy wynik trzeba zatwierdzić ręcznie. Skuteczność na nadrukach kropkowych (inkjet) jest ograniczona: pomaga zaznaczenie palcem samego nadruku i opcja „Nadruk kropkowy”. OCR offline działa po jednorazowym pobraniu (*Ustawienia → Przygotuj OCR*).

## Kolory terminów

| Dni do terminu | Wygląd | Status |
|---|---|---|
| > 31 | ciemna karta | W terminie |
| 8–31 | żółta | Do 31 dni |
| 1–7 | pomarańczowa | Do 7 dni |
| 0 (dziś) | czerwona | Termin mija dziś |
| < 0 | czerwona | **Do weryfikacji** (upływ okresu przechowywania ≠ zepsucie farby) |

Statystyka „Produkty z terminem do 31 dni” liczy produkty z partią w przedziale 0–31 dni. „Przeterminowane” liczy produkty z partią po terminie. Pod liczbą widać też liczbę partii i puszek.

## Dane

- IndexedDB (`paintstock`: `products`, `batches`, `meta`). Każda zmiana zapisuje się od razu, transakcyjnie.
- Niezapisany formularz jest zachowywany jako szkic, więc przetrwa nawet zabicie karty przez Androida podczas robienia zdjęcia do OCR.
- Aplikacja prosi o *trwałe przechowywanie* (`navigator.storage.persist`), żeby przeglądarka nie czyściła danych przy braku miejsca. Najpewniej działa to po instalacji jako PWA.
- **Kopia zapasowa:** eksport JSON (pełny, do ponownego importu) i CSV (do Excela, separator `;`, UTF-8 z BOM).
- Wyczyszczenie danych witryny w przeglądarce usuwa bazę, dlatego rób regularnie eksport JSON.

## Model danych

```text
product { id, barcode, name, manufacturer, capacity, description, demo, createdAt, updatedAt }
batch   { id, productId, lot, expiry: "RRRR-MM-DD", qty, zone, rack, shelf, notes, demo, createdAt, updatedAt }
```

Jeden produkt (kod) może mieć dowolnie wiele partii. Dodanie partii o istniejącym numerze nigdy jej nie nadpisuje: aplikacja pyta, czy dodać puszki do istniejącej partii, czy zapisać osobny wpis.

## Rozbudowa

Kod w `index.html` jest podzielony na moduły-obiekty: `D` (daty), `DB` (IndexedDB), `Store` (stan), `Overlay`/`Router` (okna i historia, w tym przycisk Wstecz na Androidzie), `Home`, `Products`, `Detail`, `Form`, `Draft`, `Scanner`, `GS1`, `OCR`, `IO`, `Demo`, `SettingsView`, `App`. Przyciski działają przez delegację `data-action` → `App.actions`. Po zmianie plików aplikacji podbij `VERSION` w `sw.js`, żeby urządzenia pobrały nową wersję.
