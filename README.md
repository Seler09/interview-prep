# 🎯 Pytania rekrutacyjne

Prosta aplikacja z fiszkami do nauki przed rekrutacją. To czysty HTML, CSS i JS, bez builda i bez backendu.

## Funkcje
- **Nauka**: fiszki z powtórkami w systemie Leitnera (pytania, których nie umiesz, wracają częściej) i podsumowanie po każdej sesji.
- **Przeglądaj**: lista wszystkich pytań z wyszukiwarką.
- **Postęp**: % opanowania, statystyki dla każdej kategorii, licznik dni z rzędu, eksport i import do pliku JSON.
- **Bez kont**: postęp zapisuje się automatycznie w `localStorage` przeglądarki, więc każdy użytkownik ma swój postęp na swoim urządzeniu.
- **Reset postępu**: cały albo tylko dla pytań z aktualnych filtrów.
- Zestawy Podstawy / Senior, filtry po kategorii i trudności.
- Responsywność (dolna nawigacja i przyciski pod kciukiem na telefonie), tryb ciemny i jasny, skróty klawiszowe (`Spacja`, `1`, `2`, `3`).

## Uruchomienie lokalne
Otwórz `index.html` w przeglądarce (dwuklik). Serwer nie jest potrzebny.

## Dodawanie pytań
- `questions.js`: pytania podstawowe. Format jest opisany w komentarzu na górze pliku.
- `questions-senior.js`: pytania na poziomie senior (system design, systemy rozproszone, architektura, bazy danych, bezpieczeństwo, DevOps, leadership…).
  Opcjonalne pole `followUps` zawiera listę pytań pogłębiających, które rekruter może zadać.

## Hosting na GitHub Pages
```bash
git remote add origin https://github.com/<login>/interview-prep.git
git push -u origin main
```
Potem na GitHubie: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
Po około minucie strona będzie pod adresem `https://<login>.github.io/interview-prep/`.
