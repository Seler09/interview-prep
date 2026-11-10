# 🎯 Pytania rekrutacyjne

Prosta aplikacja z fiszkami do nauki przed rekrutacją. To czysty HTML, CSS i JS, bez builda i bez backendu.

## Funkcje
- **Nauka**: fiszki z powtórkami w systemie Leitnera (pytania, których nie umiesz, wracają częściej).
- **Przeglądaj**: lista wszystkich pytań z wyszukiwarką.
- **Postęp**: statystyki dla każdej kategorii oraz eksport i import postępu do pliku JSON.
- Filtry po kategorii i trudności, tryb ciemny, skróty klawiszowe (`Spacja`, `1`, `2`, `3`).

## Uruchomienie lokalne
Otwórz `index.html` w przeglądarce (dwuklik). Serwer nie jest potrzebny.

## Dodawanie pytań
Edytuj `questions.js`. Format jest opisany w komentarzu na górze pliku.

## Hosting na GitHub Pages
```bash
git remote add origin https://github.com/<login>/interview-prep.git
git push -u origin main
```
Potem na GitHubie: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
Po około minucie strona będzie pod adresem `https://<login>.github.io/interview-prep/`.
