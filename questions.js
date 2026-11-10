/*
  BAZA PYTAŃ — tutaj dodajesz/edytujesz pytania.

  Każde pytanie:
    id         – unikalny identyfikator (po nim zapisuje się postęp, nie zmieniaj go później)
    category   – kategoria (filtry tworzą się automatycznie)
    difficulty – 1 = łatwe, 2 = średnie, 3 = trudne
    question   – treść pytania
    answer     – odpowiedź; obsługuje mini-markdown:
                   **pogrubienie**, `kod`, listy zaczynające się od "- ",
                   bloki kodu w potrójnych backtickach,
                   pusta linia = nowy akapit
                 (w template stringach backtick zapisujemy jako \`)
*/
window.QUESTIONS = [
  // ===================== JavaScript =====================
  {
    id: 'js-var-let-const',
    category: 'JavaScript',
    difficulty: 1,
    question: 'Czym różnią się var, let i const?',
    answer: `- **var** – zasięg funkcyjny, hoisting z wartością \`undefined\`, można redeklarować.
- **let** – zasięg blokowy, hoisting do „temporal dead zone” (błąd przy odczycie przed deklaracją), można przypisać ponownie.
- **const** – jak let, ale bez ponownego przypisania. Obiekt w const nadal można mutować.

W praktyce: domyślnie \`const\`, \`let\` gdy wartość się zmienia, \`var\` unikamy.`,
  },
  {
    id: 'js-closure',
    category: 'JavaScript',
    difficulty: 2,
    question: 'Co to jest closure (domknięcie)?',
    answer: `Funkcja „pamięta” zmienne z zakresu, w którym została utworzona, nawet gdy ten zakres już się zakończył.

\`\`\`js
function counter() {
  let n = 0;
  return () => ++n;
}
const inc = counter();
inc(); // 1
inc(); // 2
\`\`\`

Zastosowania: prywatny stan, fabryki funkcji, memoizacja, callbacki.`,
  },
  {
    id: 'js-equality',
    category: 'JavaScript',
    difficulty: 1,
    question: 'Jaka jest różnica między == a ===?',
    answer: `\`==\` porównuje po **konwersji typów** (np. \`'1' == 1\` → true, \`null == undefined\` → true).

\`===\` porównuje **bez konwersji** – typ i wartość muszą się zgadzać.

Zasada: używaj \`===\`, chyba że świadomie chcesz np. \`x == null\` (łapie null i undefined).`,
  },
  {
    id: 'js-event-loop',
    category: 'JavaScript',
    difficulty: 3,
    question: 'Wyjaśnij event loop. Co wypisze poniższy kod?\n\nconsole.log(1); setTimeout(() => console.log(2)); Promise.resolve().then(() => console.log(3)); console.log(4);',
    answer: `Wynik: **1, 4, 3, 2**.

JS jest jednowątkowy. Kod synchroniczny wykonuje się na call stacku. Gdy stos jest pusty, event loop:
- najpierw opróżnia **kolejkę mikrozadań** (Promise.then, queueMicrotask, MutationObserver),
- potem bierze **jedno makrozadanie** (setTimeout, setInterval, zdarzenia I/O, UI) i znowu sprawdza mikrozadania.

Dlatego \`then\` (mikrozadanie) wykona się przed \`setTimeout\` (makrozadanie), nawet z opóźnieniem 0.`,
  },
  {
    id: 'js-async-await',
    category: 'JavaScript',
    difficulty: 2,
    question: 'Czym jest Promise i jak ma się do async/await?',
    answer: `**Promise** reprezentuje wynik operacji asynchronicznej. Stany: pending → fulfilled / rejected.

**async/await** to składnia na Promise'ach: funkcja \`async\` zawsze zwraca Promise, a \`await\` „czeka” na jego rozwiązanie bez blokowania wątku.

\`\`\`js
async function load() {
  try {
    const res = await fetch('/api');
    return await res.json();
  } catch (e) {
    console.error(e);
  }
}
\`\`\`

Równoległe wywołania: \`Promise.all\`, \`Promise.allSettled\`, \`Promise.race\`, \`Promise.any\`.`,
  },
  {
    id: 'js-this',
    category: 'JavaScript',
    difficulty: 2,
    question: 'Od czego zależy wartość this w JavaScripcie?',
    answer: `Od **sposobu wywołania** funkcji:
- \`obj.metoda()\` → this = obj
- zwykłe wywołanie \`f()\` → undefined (strict mode) lub obiekt globalny
- \`new F()\` → nowo tworzony obiekt
- \`call\` / \`apply\` / \`bind\` → wskazany jawnie obiekt
- **funkcja strzałkowa** nie ma własnego this – bierze je z otaczającego zakresu (leksykalnie).`,
  },
  {
    id: 'js-hoisting',
    category: 'JavaScript',
    difficulty: 1,
    question: 'Co to jest hoisting?',
    answer: `Deklaracje są „przenoszone” na górę zakresu przed wykonaniem kodu.
- deklaracje funkcji (\`function f() {}\`) – w całości, można je wywołać przed definicją,
- \`var\` – tylko deklaracja, wartość to \`undefined\`,
- \`let\` / \`const\` / \`class\` – są hoistowane, ale do momentu deklaracji są w TDZ → ReferenceError.`,
  },

  // ===================== HTML / CSS =====================
  {
    id: 'css-box-model',
    category: 'HTML / CSS',
    difficulty: 1,
    question: 'Opisz box model w CSS.',
    answer: `Każdy element to prostokąt złożony z: **content → padding → border → margin**.

\`box-sizing: content-box\` (domyślne) – width dotyczy samej treści.
\`box-sizing: border-box\` – width obejmuje content + padding + border (zwykle wygodniejsze, często ustawiane globalnie).`,
  },
  {
    id: 'css-flex-grid',
    category: 'HTML / CSS',
    difficulty: 2,
    question: 'Flexbox czy Grid – kiedy co?',
    answer: `- **Flexbox** – układ jednowymiarowy (wiersz albo kolumna), rozkład elementów wzdłuż osi, np. nawigacja, przyciski, wyśrodkowanie.
- **Grid** – układ dwuwymiarowy (wiersze i kolumny jednocześnie), np. layout strony, galerie, dashboardy.

Często łączy się oba: Grid do szkieletu strony, Flex wewnątrz komponentów.`,
  },
  {
    id: 'css-specificity',
    category: 'HTML / CSS',
    difficulty: 2,
    question: 'Jak działa specyficzność selektorów CSS?',
    answer: `Liczona jako trójka (a, b, c):
- a – selektory ID,
- b – klasy, atrybuty, pseudoklasy,
- c – elementy i pseudoelementy.

Wygrywa wyższa specyficzność; przy remisie – reguła zdefiniowana później. Style inline biją selektory, a \`!important\` bije wszystko (unikać). \`:where()\` ma specyficzność 0.`,
  },
  {
    id: 'html-semantics',
    category: 'HTML / CSS',
    difficulty: 1,
    question: 'Dlaczego semantyczny HTML jest ważny?',
    answer: `Znaczniki takie jak \`header\`, \`nav\`, \`main\`, \`article\`, \`button\` niosą znaczenie:
- **dostępność** – czytniki ekranu rozumieją strukturę strony, działa nawigacja klawiaturą,
- **SEO** – wyszukiwarki lepiej rozumieją treść,
- **czytelność kodu**.

Przykład: \`<button>\` zamiast \`<div onclick>\` daje fokus, obsługę Enter/Spacji i rolę „przycisk” za darmo.`,
  },

  // ===================== Git =====================
  {
    id: 'git-merge-rebase',
    category: 'Git',
    difficulty: 2,
    question: 'Czym różni się git merge od git rebase?',
    answer: `- **merge** – łączy gałęzie, tworząc commit scalający; historia zostaje nienaruszona (nieliniowa).
- **rebase** – „przesadza” twoje commity na koniec innej gałęzi, przepisując je (nowe hashe); historia liniowa.

Zasada: **nie rebase'uj gałęzi, które ktoś inny już pobrał** (publicznych), bo przepisujesz wspólną historię.`,
  },
  {
    id: 'git-reset-revert',
    category: 'Git',
    difficulty: 2,
    question: 'git reset vs git revert?',
    answer: `- **revert** – tworzy nowy commit odwracający zmiany; bezpieczny na wspólnych gałęziach.
- **reset** – przesuwa wskaźnik gałęzi wstecz (usuwa commity z historii):
  \`--soft\` zostawia zmiany w stage, \`--mixed\` (domyślny) w working directory, \`--hard\` kasuje je całkowicie.

Na wspólnej gałęzi używamy revert.`,
  },

  // ===================== Bazy danych =====================
  {
    id: 'sql-joins',
    category: 'Bazy danych',
    difficulty: 1,
    question: 'Jakie są rodzaje JOIN w SQL?',
    answer: `- **INNER JOIN** – tylko pasujące wiersze z obu tabel.
- **LEFT JOIN** – wszystkie z lewej + pasujące z prawej (brak → NULL).
- **RIGHT JOIN** – odwrotnie.
- **FULL OUTER JOIN** – wszystkie z obu stron.
- **CROSS JOIN** – iloczyn kartezjański.
- **SELF JOIN** – tabela łączona sama ze sobą (np. pracownik → przełożony).`,
  },
  {
    id: 'sql-index',
    category: 'Bazy danych',
    difficulty: 2,
    question: 'Co to jest indeks w bazie danych i jakie ma wady?',
    answer: `Struktura danych (najczęściej **B-drzewo**) przyspieszająca wyszukiwanie po kolumnach – zamiast skanować całą tabelę, baza „skacze” do właściwych wierszy.

Wady:
- zajmuje miejsce,
- spowalnia INSERT / UPDATE / DELETE (indeks trzeba aktualizować),
- mało przydatny dla kolumn o małej selektywności (np. bool).

Warto indeksować kolumny w WHERE, JOIN i ORDER BY. W indeksie złożonym liczy się kolejność kolumn.`,
  },
  {
    id: 'sql-acid',
    category: 'Bazy danych',
    difficulty: 2,
    question: 'Co oznacza ACID?',
    answer: `Właściwości transakcji:
- **Atomicity** – wszystko albo nic,
- **Consistency** – baza przechodzi z jednego poprawnego stanu w inny (więzy integralności),
- **Isolation** – równoległe transakcje nie widzą swoich niezatwierdzonych zmian (poziomy izolacji: read uncommitted, read committed, repeatable read, serializable),
- **Durability** – zatwierdzone dane przetrwają awarię.`,
  },
  {
    id: 'sql-where-having',
    category: 'Bazy danych',
    difficulty: 1,
    question: 'Czym różni się WHERE od HAVING?',
    answer: `**WHERE** filtruje wiersze **przed** grupowaniem, **HAVING** – grupy **po** \`GROUP BY\` (może używać funkcji agregujących).

\`\`\`sql
SELECT dept, COUNT(*) AS n
FROM employees
WHERE active = 1
GROUP BY dept
HAVING COUNT(*) > 5;
\`\`\``,
  },

  // ===================== Programowanie ogólne =====================
  {
    id: 'oop-pillars',
    category: 'Programowanie',
    difficulty: 1,
    question: 'Wymień i opisz 4 filary programowania obiektowego.',
    answer: `- **Enkapsulacja** – ukrywanie stanu wewnętrznego, dostęp przez metody.
- **Abstrakcja** – pokazywanie tylko istotnych cech, ukrywanie szczegółów implementacji.
- **Dziedziczenie** – klasa przejmuje zachowanie innej klasy.
- **Polimorfizm** – ten sam interfejs, różne zachowanie (np. nadpisywanie metod).`,
  },
  {
    id: 'solid',
    category: 'Programowanie',
    difficulty: 2,
    question: 'Co oznacza SOLID?',
    answer: `- **S** – Single Responsibility: klasa ma jeden powód do zmiany.
- **O** – Open/Closed: otwarte na rozszerzenia, zamknięte na modyfikacje.
- **L** – Liskov Substitution: podtyp musi dać się użyć w miejsce typu bazowego.
- **I** – Interface Segregation: wiele małych interfejsów zamiast jednego wielkiego.
- **D** – Dependency Inversion: zależ od abstrakcji, nie od konkretnych implementacji.`,
  },
  {
    id: 'big-o',
    category: 'Programowanie',
    difficulty: 2,
    question: 'Co to jest notacja Big O? Podaj przykłady.',
    answer: `Opisuje, jak rośnie czas (lub pamięć) algorytmu wraz z rozmiarem danych n, w najgorszym przypadku.
- **O(1)** – dostęp do elementu tablicy po indeksie, odczyt z hash mapy,
- **O(log n)** – wyszukiwanie binarne,
- **O(n)** – przejście po liście,
- **O(n log n)** – dobre sortowania (merge sort, quick sort średnio),
- **O(n²)** – zagnieżdżone pętle, bubble sort.`,
  },

  // ===================== Sieci / HTTP =====================
  {
    id: 'http-methods',
    category: 'Sieci / HTTP',
    difficulty: 1,
    question: 'Jakie znasz metody HTTP? Co znaczy, że metoda jest idempotentna?',
    answer: `GET (odczyt), POST (utworzenie), PUT (zastąpienie), PATCH (częściowa zmiana), DELETE (usunięcie), także HEAD, OPTIONS.

**Idempotentna** = wielokrotne wykonanie daje ten sam efekt co jednokrotne: GET, PUT, DELETE, HEAD, OPTIONS. **POST** nie jest idempotentny (dwa wywołania = dwa zasoby). PATCH zazwyczaj też nie.`,
  },
  {
    id: 'http-url-flow',
    category: 'Sieci / HTTP',
    difficulty: 3,
    question: 'Co się dzieje po wpisaniu adresu URL w przeglądarkę i naciśnięciu Enter?',
    answer: `- **DNS** – zamiana domeny na adres IP (cache przeglądarki, systemu, resolver).
- **TCP** – nawiązanie połączenia (3-way handshake), potem **TLS** dla HTTPS.
- **Żądanie HTTP** – np. GET / z nagłówkami, cookies.
- **Serwer** przetwarza żądanie (load balancer, aplikacja, baza) i zwraca odpowiedź.
- **Przeglądarka** parsuje HTML → DOM, CSS → CSSOM, buduje render tree, liczy layout, maluje (paint), składa warstwy (composite).
- Pobiera dodatkowe zasoby (CSS, JS, obrazki), wykonuje JS.`,
  },
  {
    id: 'rest',
    category: 'Sieci / HTTP',
    difficulty: 2,
    question: 'Co to jest REST API?',
    answer: `Styl architektury API oparty na HTTP:
- **zasoby** identyfikowane przez URL (\`/users/42\`),
- operacje przez **metody HTTP**,
- **bezstanowość** – każde żądanie zawiera wszystko, co potrzebne,
- reprezentacje (zwykle JSON), znaczące **kody statusu** (200, 201, 204, 400, 401, 403, 404, 500),
- możliwość cache'owania.`,
  },
  {
    id: 'cors',
    category: 'Sieci / HTTP',
    difficulty: 2,
    question: 'Co to jest CORS i po co istnieje?',
    answer: `Przeglądarka stosuje **same-origin policy** – JS nie może czytać odpowiedzi z innego originu (protokół + domena + port).

**CORS** pozwala serwerowi jawnie zezwolić na to nagłówkami, np. \`Access-Control-Allow-Origin\`. Dla „nieprostych” żądań przeglądarka najpierw wysyła **preflight** (OPTIONS).

To mechanizm przeglądarki – nie chroni serwera przed curl/Postmanem.`,
  },

  // ===================== Pytania miękkie =====================
  {
    id: 'soft-about-me',
    category: 'Pytania miękkie',
    difficulty: 1,
    question: 'Opowiedz coś o sobie.',
    answer: `Struktura na 1–2 minuty: **teraźniejszość → przeszłość → przyszłość**.
- Kim jesteś zawodowo teraz i czym się zajmujesz.
- 1–2 konkretne osiągnięcia/projekty związane z tą rolą.
- Dlaczego ta firma/stanowisko to logiczny następny krok.

Unikaj życiorysu od podstawówki – mów o tym, co istotne dla tej roli.`,
  },
  {
    id: 'soft-conflict',
    category: 'Pytania miękkie',
    difficulty: 2,
    question: 'Opisz trudną sytuację w zespole i jak ją rozwiązałeś/aś.',
    answer: `Użyj metody **STAR**:
- **Situation** – kontekst,
- **Task** – za co odpowiadałeś/aś,
- **Action** – co konkretnie zrobiłeś/aś (mów „ja”, nie „my”),
- **Result** – efekt, najlepiej mierzalny, i czego się nauczyłeś/aś.

Wybierz historię, gdzie konflikt był merytoryczny, a nie osobisty, i pokaż dojrzałe podejście.`,
  },
  {
    id: 'soft-why-us',
    category: 'Pytania miękkie',
    difficulty: 1,
    question: 'Dlaczego chcesz pracować w naszej firmie?',
    answer: `Pokaż, że zrobiłeś/aś research:
- produkt / technologia / branża, które cię interesują – konkretnie,
- jak twoje doświadczenie pasuje do ich potrzeb,
- czego chcesz się nauczyć i jak to łączy się z rozwojem firmy.

Unikaj odpowiedzi tylko o pieniądzach czy „bo szukam pracy”.`,
  },
];
