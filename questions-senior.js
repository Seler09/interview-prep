/*
  PYTANIA NA POZIOMIE SENIOR
  Format jak w questions.js + opcjonalne pole:
    followUps – lista pytań pogłębiających, które rekruter może zadać dalej
*/
window.QUESTIONS = window.QUESTIONS || [];
window.QUESTIONS.push(
  // =====================================================================
  // SYSTEM DESIGN
  // =====================================================================
  {
    id: 'sd-framework',
    category: 'System design',
    difficulty: 2,
    question: 'Jak podchodzisz do zadania typu „zaprojektuj system X” na rozmowie?',
    answer: `Struktura, która pokazuje dojrzałość. Nie rzucaj się od razu w rysowanie pudełek.
1. **Wymagania funkcjonalne**: co system robi, kluczowe use case'y, czego NIE robimy.
2. **Wymagania niefunkcjonalne**: skala (DAU, RPS, wolumen danych), latencja (p99), dostępność (SLA), spójność vs dostępność, read/write ratio.
3. **Estymacje (back-of-the-envelope)**: RPS, storage na 5 lat, bandwidth. Wystarczy rząd wielkości.
4. **API i model danych**: endpointy, encje, wybór bazy uzasadniony wzorcem dostępu.
5. **High-level design**: klient → LB → serwisy → cache → DB → kolejki.
6. **Deep dive** w 1–2 najtrudniejsze elementy (hot keys, fan-out, spójność).
7. **Wąskie gardła, awarie, trade-offy**: co się stanie, gdy padnie X? Jak skalujemy 10×?

Mów na głos, dopytuj, nazywaj trade-offy. Rekruter ocenia proces myślenia, a nie „jedyny poprawny” diagram.`,
    followUps: ['Jak liczysz potrzebny storage na 5 lat?', 'Kiedy w ogóle nie potrzebujesz mikroserwisów w takim projekcie?'],
  },
  {
    id: 'sd-url-shortener',
    category: 'System design',
    difficulty: 2,
    question: 'Zaprojektuj skracacz linków (typu bit.ly).',
    answer: `**Wymagania**: tworzenie krótkiego linku, przekierowanie, opcjonalnie TTL, własny alias, statystyki. Read-heavy (np. 100:1).

**Generowanie klucza**: 7 znaków base62 daje ~3,5 bln kombinacji.
- licznik (ID z bazy / Snowflake / zakresy ID przydzielane serwerom) zakodowany base62. Bez kolizji, ale linki są przewidywalne.
- hash (np. MD5 z URL) obcięty do 7 znaków. Trzeba obsłużyć kolizje.
- pre-generowane klucze w osobnym serwisie (Key Generation Service).

**Przechowywanie**: prosty key-value (DynamoDB/Cassandra/Redis+DB). Brak relacji, ogromna skala.

**Odczyt**: cache (Redis) przed bazą, CDN/edge. Przekierowanie **301** (cache w przeglądarce, mniej ruchu, gorsza analityka) vs **302** (każde kliknięcie przechodzi przez nas, pełne statystyki).

**Analityka**: asynchronicznie przez kolejkę (Kafka), nie blokuj przekierowania.`,
    followUps: ['Jak zapobiec nadużyciom (spam, phishing)?', 'Jak obsłużyć hot linki, które nagle mają miliony kliknięć?', '301 czy 302 i dlaczego?'],
  },
  {
    id: 'sd-rate-limiter',
    category: 'System design',
    difficulty: 3,
    question: 'Zaprojektuj rate limiter dla API.',
    answer: `**Algorytmy**:
- **Token bucket**: tokeny dosypywane ze stałą szybkością, pozwala na burst. Najpopularniejszy.
- **Leaky bucket**: stałe tempo wypływu, wygładza ruch.
- **Fixed window counter**: prosty, ale na granicy okien przepuszcza do 2× limitu.
- **Sliding window log**: dokładny, ale zjada pamięć.
- **Sliding window counter**: przybliżenie z dwóch okien, dobry kompromis.

**Gdzie**: API gateway / middleware. Klucz: user ID, API key, IP.

**Rozproszenie**: wspólny stan w Redis. Atomowość przez skrypt Lua albo \`INCR\` + \`EXPIRE\`. Przy ogromnej skali lokalne liczniki z okresową synchronizacją (mniejsza precyzja, mniejsza latencja).

**Odpowiedź**: HTTP **429** + nagłówki \`Retry-After\`, \`X-RateLimit-Remaining\`.

**Awaria Redisa**: fail-open (przepuszczamy ruch, ryzyko przeciążenia) vs fail-closed (blokujemy wszystko). Zwykle fail-open plus lokalny limit awaryjny.`,
    followUps: ['Jak uniknąć race condition przy równoległych requestach?', 'Jak limitować w wielu regionach jednocześnie?'],
  },
  {
    id: 'sd-news-feed',
    category: 'System design',
    difficulty: 3,
    question: 'Zaprojektuj news feed (np. Twitter / Facebook).',
    answer: `Kluczowa decyzja to **fan-out**:
- **Fan-out on write (push)**: przy publikacji post trafia do „skrzynek” (cache feedu) wszystkich obserwujących. Szybki odczyt, drogi zapis. Problem z celebrytami (miliony followersów).
- **Fan-out on read (pull)**: feed składany przy odczycie z postów obserwowanych. Tani zapis, wolny odczyt.
- **Hybryda**: push dla zwykłych użytkowników, pull dla celebrytów, scalane przy odczycie. Tak robi się to w praktyce.

Elementy: post service, social graph service, feed cache (Redis, listy ID postów, ograniczone do np. 500), media w object storage + CDN, ranking (chronologia vs ML), paginacja kursorem (nie offsetem).`,
    followUps: ['Jak obsłużyć konto z 50 mln followersów?', 'Dlaczego paginacja kursorem, a nie offsetem?', 'Jak usunąć post, który już trafił do milionów feedów?'],
  },
  {
    id: 'sd-chat',
    category: 'System design',
    difficulty: 3,
    question: 'Zaprojektuj komunikator (czat 1:1 i grupowy).',
    answer: `- **Połączenie**: WebSocket (dwukierunkowy, trwały). Fallback: long polling.
- **Serwery czatu są stanowe** (trzymają połączenia), więc potrzebny jest rejestr „użytkownik → serwer” (Redis) i przekazywanie wiadomości między serwerami (pub/sub, kolejka).
- **Kolejność**: ID wiadomości monotoniczne per konwersacja (sekwencja albo Snowflake). Sortowanie po stronie klienta.
- **Dostarczenie**: wiadomość najpierw zapisana (trwałość), potem push. ACK od klienta. Offline → push notification + synchronizacja przy powrocie (od ostatniego znanego ID).
- **Storage**: write-heavy, wzorzec „ostatnie N wiadomości z konwersacji”, więc Cassandra/HBase z kluczem partycji = conversation_id.
- **Obecność (online/offline)**: heartbeat z TTL. Nie rozsyłaj zmian statusu do wszystkich przy dużych grupach.
- **Grupy**: małe grupy fan-out do każdego członka, duże kanały pull.`,
    followUps: ['Jak zapewnić exactly-once z perspektywy użytkownika (bez duplikatów)?', 'Jak dodać szyfrowanie end-to-end i co ono psuje?'],
  },
  {
    id: 'sd-caching',
    category: 'System design',
    difficulty: 2,
    question: 'Jakie znasz strategie cache\'owania i jakie są ich problemy?',
    answer: `**Wzorce**:
- **Cache-aside (lazy loading)**: aplikacja czyta z cache, przy missie z DB i zapisuje do cache. Najczęstszy.
- **Read-through**: to cache sam dociąga dane z DB.
- **Write-through**: zapis idzie do cache i DB synchronicznie. Dane spójne, ale wolniejszy zapis.
- **Write-behind (write-back)**: zapis do cache, do DB asynchronicznie. Szybko, ale ryzyko utraty danych.

**Problemy**:
- **Invalidacja**: TTL, usuwanie przy zapisie (delete zamiast update, żeby uniknąć wyścigów), eventy CDC.
- **Cache stampede (thundering herd)**: wiele requestów naraz przy missie. Rozwiązania: lock / single-flight, wcześniejsze odświeżanie (probabilistic early expiration), losowy jitter TTL.
- **Hot key**: replikacja klucza, lokalny cache w procesie.
- **Cache penetration**: zapytania o nieistniejące klucze. Cache'uj „null” albo użyj Bloom filtra.
- Polityki wyrzucania: LRU, LFU, TTL.`,
    followUps: ['Dlaczego przy zapisie lepiej usuwać klucz niż go aktualizować?', 'Jak zrobić wielopoziomowy cache (L1 w procesie + L2 Redis) i utrzymać spójność?'],
  },
  {
    id: 'sd-scaling-db',
    category: 'System design',
    difficulty: 3,
    question: 'Baza danych przestaje wyrabiać. Jak ją skalujesz, krok po kroku?',
    answer: `Kolejność od najtańszego:
1. **Diagnoza**: slow query log, EXPLAIN, brakujące indeksy, N+1, connection pool.
2. **Skalowanie pionowe**: większa maszyna (proste, ma sufit).
3. **Cache** przed bazą dla gorących odczytów.
4. **Repliki odczytowe**: odczyty na repliki. Uwaga na **replication lag** (read-your-writes: czytaj z mastera tuż po zapisie).
5. **Partycjonowanie** w obrębie jednej bazy (np. po dacie), archiwizacja starych danych.
6. **Podział funkcjonalny**: osobne bazy per domena/serwis.
7. **Sharding**: dane rozbite po kluczu na wiele instancji.
   - wybór klucza (równy rozkład, zapytania w obrębie shardu),
   - hash vs range sharding, consistent hashing,
   - koszty: brak cross-shard JOIN/transakcji, resharding, hot shardy.

Sharding to ostateczność, bo bardzo komplikuje system.`,
    followUps: ['Jak zrobić resharding bez downtime?', 'Jak zapewnić read-your-writes przy replikach?'],
  },
  {
    id: 'sd-consistent-hashing',
    category: 'System design',
    difficulty: 3,
    question: 'Co to jest consistent hashing i po co się go używa?',
    answer: `Przy zwykłym \`hash(key) % N\` zmiana liczby węzłów N przenosi prawie wszystkie klucze.

**Consistent hashing**: węzły i klucze mapowane są na pierścień (np. 0..2³²). Klucz trafia do pierwszego węzła zgodnie z ruchem wskazówek. Dodanie lub usunięcie węzła przenosi tylko ok. **K/N** kluczy.

**Wirtualne węzły (vnodes)**: każdy fizyczny węzeł ma wiele punktów na pierścieniu. Daje to równiejszy rozkład i pozwala ważyć mocniejsze maszyny.

Zastosowania: rozproszone cache (memcached), Cassandra, DynamoDB, load balancing ze sticky routingiem.`,
    followUps: ['Jakie są alternatywy (rendezvous hashing, jump hash)?'],
  },
  {
    id: 'sd-queues',
    category: 'System design',
    difficulty: 2,
    question: 'Kiedy i po co używasz kolejki wiadomości? Kafka vs RabbitMQ?',
    answer: `**Po co**: asynchroniczność (szybka odpowiedź dla usera), rozprzęganie serwisów, buforowanie skoków ruchu (load leveling), retry, fan-out do wielu konsumentów.

**RabbitMQ** (klasyczny broker): routing (exchange'e), wiadomość znika po ACK, push do konsumentów, dobry do kolejek zadań i złożonego routingu.

**Kafka** (rozproszony log): wiadomości trzymane przez retencję, konsumenci śledzą offset i mogą odtwarzać historię, ogromna przepustowość, kolejność gwarantowana **w obrębie partycji**. Dobra do event streamingu, event sourcingu i CDC.

**Semantyka dostarczania**: at-most-once, **at-least-once** (standard, więc konsumenci muszą być **idempotentni**), exactly-once (kosztowne, w Kafce w ograniczonym zakresie).

Problemy: poison messages, więc **DLQ** (dead letter queue); kolejność; backpressure; monitoring lagu konsumentów.`,
    followUps: ['Jak zapewnić kolejność zdarzeń dla jednego klienta w Kafce?', 'Co robisz z wiadomością, która za każdym razem wywala konsumenta?'],
  },
  {
    id: 'sd-file-upload',
    category: 'System design',
    difficulty: 2,
    question: 'Jak zaprojektujesz upload dużych plików (np. wideo kilka GB)?',
    answer: `- Klient nie wysyła pliku przez twój backend. Backend generuje **presigned URL**, a klient wrzuca bezpośrednio do object storage (S3/GCS).
- **Multipart / chunked upload**: części wysyłane równolegle, wznawianie po przerwie, checksumy.
- Po uploadzie event (S3 notification → kolejka) uruchamia asynchroniczne przetwarzanie: skanowanie antywirusowe, transkodowanie, miniatury.
- Status przetwarzania przez polling / WebSocket.
- Serwowanie przez **CDN**, dla wideo streaming adaptacyjny (HLS/DASH).
- Limity rozmiaru, walidacja typu po zawartości (nie po rozszerzeniu), lifecycle policy dla porzuconych uploadów.`,
  },

  // =====================================================================
  // SYSTEMY ROZPROSZONE
  // =====================================================================
  {
    id: 'ds-cap',
    category: 'Systemy rozproszone',
    difficulty: 2,
    question: 'Wyjaśnij twierdzenie CAP i PACELC.',
    answer: `**CAP**: przy **partycji sieciowej (P)** system musi wybrać między:
- **C (consistency)**: każdy odczyt widzi najnowszy zapis (albo błąd),
- **A (availability)**: każdy request dostaje odpowiedź (może być nieaktualna).

Partycje w praktyce się zdarzają, więc realny wybór to **CP vs AP**. „CA” w systemie rozproszonym nie istnieje.

**PACELC** rozszerza CAP: **jeśli P** → A albo C, **w przeciwnym razie (E)** → **L**atency albo **C**onsistency. Nawet bez awarii silna spójność kosztuje latencję (synchroniczna replikacja).

Przykłady: DynamoDB/Cassandra domyślnie PA/EL (z regulowaną spójnością), Spanner / bazy na Raft to PC/EC.`,
    followUps: ['Podaj przykład biznesowy, gdzie wybierzesz AP, a gdzie CP.', 'Czym jest quorum (R + W > N)?'],
  },
  {
    id: 'ds-consistency-models',
    category: 'Systemy rozproszone',
    difficulty: 3,
    question: 'Jakie znasz modele spójności?',
    answer: `Od najsilniejszego:
- **Linearizability (strong)**: operacje wyglądają, jakby działy się atomowo w jednym punkcie czasu, zgodnie z czasem rzeczywistym.
- **Sequential consistency**: jedna globalna kolejność zgodna z kolejnością w każdym procesie, ale niekoniecznie z czasem rzeczywistym.
- **Causal consistency**: zachowana kolejność operacji powiązanych przyczynowo (odpowiedź po pytaniu).
- **Read-your-writes / monotonic reads**: gwarancje sesyjne z perspektywy jednego klienta.
- **Eventual consistency**: bez nowych zapisów repliki w końcu się zbiegną.

Silniejsza spójność oznacza większą latencję i mniejszą dostępność. Dobierasz model per przypadek użycia: saldo konta silnie, licznik lajków eventual.`,
  },
  {
    id: 'ds-saga',
    category: 'Systemy rozproszone',
    difficulty: 3,
    question: 'Jak zrobić „transakcję” obejmującą kilka mikroserwisów? 2PC vs Saga.',
    answer: `**2PC (two-phase commit)**: koordynator: prepare → commit. Daje atomowość, ale blokuje zasoby, koordynator to SPOF, słaba skalowalność. Rzadko używany między mikroserwisami.

**Saga**: sekwencja lokalnych transakcji. Gdy krok się nie powiedzie, wykonywane są **transakcje kompensujące** (np. „anuluj rezerwację”).
- **Choreografia**: serwisy reagują na eventy innych. Luźne powiązania, ale trudniej śledzić przepływ.
- **Orkiestracja**: centralny orchestrator (np. Temporal, Step Functions) mówi, co robić. Czytelny przepływ.

Saga daje **eventual consistency**: trzeba projektować stany pośrednie (PENDING), kompensacje muszą być idempotentne, a niektórych akcji nie da się cofnąć (wysłany e-mail), więc ustawia się je na końcu.`,
    followUps: ['Jak niezawodnie opublikować event po zapisie do bazy? (outbox)', 'Co jeśli kompensacja też się nie powiedzie?'],
  },
  {
    id: 'ds-outbox',
    category: 'Systemy rozproszone',
    difficulty: 3,
    question: 'Co to jest wzorzec Transactional Outbox i jaki problem rozwiązuje?',
    answer: `**Problem (dual write)**: zapisujesz zamówienie do DB i publikujesz event do Kafki. Jeśli jedno się uda, a drugie nie, stan jest niespójny. Nie ma wspólnej transakcji DB + broker.

**Rozwiązanie**: w **tej samej transakcji** co zmiana biznesowa zapisujesz event do tabeli \`outbox\`. Osobny proces (poller albo **CDC**, np. Debezium czytający WAL/binlog) publikuje eventy do brokera i oznacza je jako wysłane.

Daje to **at-least-once**, więc konsumenci muszą być idempotentni (tabela przetworzonych ID = **inbox pattern**).`,
  },
  {
    id: 'ds-idempotency',
    category: 'Systemy rozproszone',
    difficulty: 2,
    question: 'Jak zaprojektować idempotentne API (np. płatności)?',
    answer: `Klient generuje **Idempotency-Key** (UUID) i wysyła go w nagłówku. Serwer:
1. Sprawdza, czy klucz już był (tabela z unikalnym indeksem na kluczu).
2. Jeśli był i zakończył się, zwraca **zapisaną odpowiedź**.
3. Jeśli jest w trakcie, zwraca 409 / każe ponowić później.
4. Jeśli nowy, zapisuje klucz (atomowo, unique constraint) i przetwarza.

Klucz wiążesz z parametrami requestu (ten sam klucz z innym body → błąd) i dajesz mu TTL (np. 24h).

Dlaczego: sieć zawodzi, klient robi retry po timeoucie, a nie wie, czy pierwsze żądanie przeszło. Bez idempotencji dostajesz podwójne obciążenie karty.`,
    followUps: ['Co, jeśli serwer padnie w połowie przetwarzania?'],
  },
  {
    id: 'ds-resilience',
    category: 'Systemy rozproszone',
    difficulty: 2,
    question: 'Jakie wzorce odporności (resilience) stosujesz przy komunikacji między serwisami?',
    answer: `- **Timeouty**: zawsze, na każdym wywołaniu sieciowym. Brak timeoutu to wiszące wątki i kaskadowa awaria.
- **Retry z exponential backoff + jitter**: jitter zapobiega synchronizacji retry wielu klientów. Retry tylko dla operacji idempotentnych i błędów przejściowych (5xx, timeout, nie 4xx).
- **Circuit breaker**: po serii błędów „otwiera się” i od razu zwraca błąd/fallback, potem half-open i próbne requesty.
- **Bulkhead**: osobne pule zasobów (wątki, połączenia) dla różnych zależności, żeby jedna wolna zależność nie zablokowała wszystkiego.
- **Fallback / graceful degradation**: dane z cache, uproszczona odpowiedź.
- **Retry budget**: ograniczenie liczby retry, żeby nie spowodować retry storm.
- **Load shedding**: odrzucanie nadmiarowego ruchu, zanim system się zatka.`,
    followUps: ['Co to jest retry storm i jak go uniknąć w łańcuchu A→B→C?'],
  },
  {
    id: 'ds-consensus',
    category: 'Systemy rozproszone',
    difficulty: 3,
    question: 'Na czym polega algorytm konsensusu (np. Raft)?',
    answer: `Cel: kilka węzłów zgadza się co do jednej sekwencji operacji (replikowany log) mimo awarii.

**Raft**:
- **Wybór lidera**: węzły mają losowe timeouty. Follower bez heartbeatu staje się kandydatem i prosi o głosy. Wygrywa ten z większością głosów w danym **term**.
- **Replikacja logu**: zapisy przechodzą przez lidera. Wpis jest **zatwierdzony**, gdy potwierdzi go **większość** (quorum).
- Toleruje awarię **f** węzłów przy **2f+1** węzłach (dlatego klastry 3 lub 5).

Zastosowania: etcd (Kubernetes), Consul, CockroachDB, Kafka KRaft. W praktyce nie implementujesz go sam, tylko używasz tych narzędzi np. do leader election czy distributed locków.`,
  },
  {
    id: 'ds-distributed-lock',
    category: 'Systemy rozproszone',
    difficulty: 3,
    question: 'Jak zrobić rozproszony lock i na co uważać?',
    answer: `Opcje: Redis (\`SET key val NX PX ttl\`), ZooKeeper/etcd (lease + sekwencyjne węzły), \`SELECT ... FOR UPDATE\` / advisory locki w Postgresie.

**Pułapki**:
- Lock **musi mieć TTL** (proces może paść), a proces może przetrzymać lock dłużej niż TTL (GC pause, lag sieci). Wtedy dwa procesy myślą, że mają lock.
- Rozwiązanie: **fencing token**, czyli rosnący numer wydawany z lockiem. Zasób odrzuca zapisy ze starszym tokenem.
- Zwolnienie locka tylko przez właściciela (porównaj wartość atomowo, skrypt Lua).
- Redlock jest kontrowersyjny (krytyka Kleppmanna). Do poprawności lepsze są systemy z konsensusem.

Najlepiej w ogóle unikać locków: idempotencja, optimistic locking, partycjonowanie pracy.`,
  },
  {
    id: 'ds-time',
    category: 'Systemy rozproszone',
    difficulty: 3,
    question: 'Dlaczego nie można polegać na zegarach w systemach rozproszonych?',
    answer: `Zegary maszyn dryfują, NTP potrafi cofnąć czas, a różnice sięgają milisekund i więcej. „Last write wins” po timestampie może więc zgubić nowszy zapis.

Rozwiązania:
- **Zegary logiczne (Lamport)**: licznik zwiększany przy każdym zdarzeniu. Daje porządek zgodny z przyczynowością.
- **Vector clocks**: wykrywają współbieżne (konfliktowe) zapisy.
- **Hybrid Logical Clocks**: łączą czas fizyczny i logiczny (CockroachDB).
- **TrueTime** (Spanner): czas z gwarantowanym przedziałem niepewności, opartym na zegarach atomowych.
- Do mierzenia odcinków czasu używaj **zegara monotonicznego**, nie wall-clock.`,
  },

  // =====================================================================
  // BAZY DANYCH (SENIOR)
  // =====================================================================
  {
    id: 'db-isolation-anomalies',
    category: 'Bazy danych (senior)',
    difficulty: 3,
    question: 'Omów poziomy izolacji transakcji i anomalie, przed którymi chronią.',
    answer: `**Anomalie**:
- **Dirty read**: odczyt niezatwierdzonych danych.
- **Non-repeatable read**: ten sam wiersz czytany dwa razy daje różne wartości.
- **Phantom read**: to samo zapytanie zwraca inny zbiór wierszy.
- **Lost update**: dwie transakcje czytają, modyfikują i zapisują, jedna nadpisuje drugą.
- **Write skew**: dwie transakcje czytają ten sam stan i zapisują różne wiersze, łamiąc wspólny niezmiennik (np. „co najmniej jeden lekarz na dyżurze”).

**Poziomy**: Read Uncommitted < **Read Committed** (domyślny w Postgresie) < **Repeatable Read** (domyślny w MySQL InnoDB; w Postgresie to snapshot isolation) < **Serializable**.

Snapshot isolation nie chroni przed write skew. Chroni dopiero Serializable (w Postgresie SSI, więc trzeba obsłużyć błędy serializacji retry'em) albo jawne locki (\`SELECT ... FOR UPDATE\`).`,
    followUps: ['Jak w praktyce zapobiegniesz lost update przy zmianie salda?'],
  },
  {
    id: 'db-mvcc',
    category: 'Bazy danych (senior)',
    difficulty: 3,
    question: 'Co to jest MVCC?',
    answer: `**Multi-Version Concurrency Control**: zamiast blokować odczyty, baza trzyma wiele wersji wierszy. Każda transakcja widzi **snapshot** danych z określonego momentu.

Efekt: **czytający nie blokują piszących i odwrotnie**.

W Postgresie: UPDATE tworzy nową wersję krotki (stara zostaje jako „martwa”), a **VACUUM** sprząta martwe wersje. Długie transakcje blokują sprzątanie, co daje **bloat** tabel i indeksów. Do tego dochodzi ryzyko transaction ID wraparound.

W MySQL InnoDB stare wersje trzymane są w undo logu.`,
    followUps: ['Dlaczego długo otwarte transakcje są groźne w Postgresie?'],
  },
  {
    id: 'db-locking',
    category: 'Bazy danych (senior)',
    difficulty: 2,
    question: 'Optimistic vs pessimistic locking: kiedy co?',
    answer: `**Pessimistic**: blokujesz wiersz przed modyfikacją (\`SELECT ... FOR UPDATE\`). Dobre przy wysokiej konkurencji o te same dane i krótkich transakcjach. Ryzyko deadlocków i spadku przepustowości.

**Optimistic**: bez blokad, z kolumną \`version\`:
\`\`\`sql
UPDATE accounts SET balance = 90, version = 6
WHERE id = 1 AND version = 5;
-- 0 zmienionych wierszy = ktoś był szybszy -> retry / błąd
\`\`\`
Dobre przy rzadkich konfliktach, długich interakcjach użytkownika (edycja formularza) i w systemach rozproszonych.

Czasem najprościej zrobić atomowy update: \`UPDATE ... SET balance = balance - 10 WHERE balance >= 10\`.`,
  },
  {
    id: 'db-deadlock',
    category: 'Bazy danych (senior)',
    difficulty: 2,
    question: 'Skąd biorą się deadlocki w bazie i jak im zapobiegać?',
    answer: `Transakcja A blokuje wiersz 1 i czeka na 2, a B blokuje 2 i czeka na 1. Baza wykrywa cykl i zabija jedną z transakcji.

Zapobieganie:
- **stała kolejność blokowania** zasobów (np. sortuj ID przed aktualizacją),
- krótkie transakcje, bez wywołań sieciowych w środku,
- odpowiednie indeksy (bez nich UPDATE może blokować więcej wierszy / zakresów),
- \`NOWAIT\` / \`SKIP LOCKED\` (np. kolejki zadań w Postgresie),
- aplikacja musi umieć zrobić **retry** transakcji po deadlocku.`,
  },
  {
    id: 'db-index-deep',
    category: 'Bazy danych (senior)',
    difficulty: 3,
    question: 'Indeksy na poziomie seniora: złożone, pokrywające, częściowe. Kiedy indeks NIE zadziała?',
    answer: `- **Indeks złożony (a, b, c)**: działa dla warunków na prefiksie: \`a\`, \`a,b\`, \`a,b,c\`. Nie zadziała dla samego \`b\`. Kolejność: najpierw kolumny z równością, potem zakresy/sortowanie.
- **Covering index** (\`INCLUDE\`): zawiera wszystkie kolumny zapytania, więc jest index-only scan bez sięgania do tabeli.
- **Partial index**: \`WHERE status = 'active'\`. Mniejszy, szybszy.
- **Expression index**: np. na \`lower(email)\`.
- Typy: B-tree (domyślny), Hash, GIN (JSONB, full-text, tablice), GiST, BRIN (ogromne tabele z naturalnym porządkiem, np. czas).

**Indeks nie zostanie użyty, gdy**:
- funkcja na kolumnie (\`WHERE YEAR(created_at) = 2024\`), lepiej warunek zakresowy,
- \`LIKE '%abc'\` (wiodący wildcard),
- niejawna konwersja typów,
- niska selektywność (planner uzna, że seq scan jest tańszy),
- nieaktualne statystyki (ANALYZE).`,
    followUps: ['Jak czytasz plan z EXPLAIN ANALYZE? Na co patrzysz?'],
  },
  {
    id: 'db-explain',
    category: 'Bazy danych (senior)',
    difficulty: 2,
    question: 'Zapytanie jest wolne na produkcji. Jak je diagnozujesz?',
    answer: `1. Potwierdź problem: slow query log / pg_stat_statements (czas łączny, liczba wywołań, średnia).
2. **EXPLAIN (ANALYZE, BUFFERS)** na realnych danych (lub kopii).
3. W planie szukaj: Seq Scan na dużej tabeli, dużej rozbieżności „estimated rows” vs „actual rows” (złe statystyki), Nested Loop na dużych zbiorach, sortowań na dysku, wielu odczytów buforów.
4. Napraw: indeks, przepisanie zapytania, ANALYZE, mniej kolumn (bez SELECT *), paginacja keyset.
5. Sprawdź kontekst: N+1 w ORM, locki (pg_locks), brak connection poolingu, bloat.
6. Zmierz po zmianie i dodaj monitoring/alert.`,
  },
  {
    id: 'db-n-plus-one',
    category: 'Bazy danych (senior)',
    difficulty: 1,
    question: 'Co to jest problem N+1 i jak go rozwiązać?',
    answer: `Jedno zapytanie pobiera listę N rekordów, a potem dla każdego wykonywane jest osobne zapytanie o powiązane dane. Razem N+1 zapytań. Typowe przy lazy loadingu w ORM.

Rozwiązania: **eager loading** / JOIN (\`include\`, \`JOIN FETCH\`, \`select_related\`), zapytanie z \`WHERE id IN (...)\`, w GraphQL **DataLoader** (batching). Wykrywanie: logi SQL, APM, testy liczące zapytania.`,
  },
  {
    id: 'db-sql-nosql',
    category: 'Bazy danych (senior)',
    difficulty: 2,
    question: 'SQL czy NoSQL? Jak dobierasz bazę do problemu?',
    answer: `Zaczynasz od **wzorców dostępu do danych**, nie od mody.
- **Relacyjna (Postgres/MySQL)**: relacje, transakcje ACID, elastyczne zapytania ad-hoc, spójność. Rozsądny default dla większości systemów.
- **Dokumentowa (MongoDB)**: dane naturalnie hierarchiczne, czytane jako całość, zmienny schemat.
- **Key-value (Redis, DynamoDB)**: proste odczyty po kluczu, ogromna skala, niska latencja.
- **Wide-column (Cassandra)**: ogromne wolumeny zapisów, zapytania znane z góry, multi-region.
- **Grafowa (Neo4j)**: zapytania o relacje wielopoziomowe (rekomendacje, fraudy).
- **Search (Elasticsearch)**: full-text, faceting. Zwykle jako dodatek, nie źródło prawdy.
- **Time-series (TimescaleDB, InfluxDB)**: metryki, IoT.

Przy NoSQL projektujesz model pod zapytania (denormalizacja). Zmiana wzorców dostępu potem boli.`,
  },
  {
    id: 'db-zero-downtime-migration',
    category: 'Bazy danych (senior)',
    difficulty: 3,
    question: 'Jak zrobić migrację schematu bez downtime\'u (np. zmiana nazwy kolumny)?',
    answer: `Wzorzec **expand → migrate → contract** (parallel change). Każdy krok jest kompatybilny z poprzednią i następną wersją aplikacji:
1. **Expand**: dodaj nową kolumnę (nullable, bez domyślnej wartości wymagającej przepisania tabeli).
2. Deploy aplikacji, która **zapisuje do obu** kolumn.
3. **Backfill** starych danych partiami (bez jednej gigantycznej transakcji).
4. Deploy aplikacji, która **czyta z nowej** kolumny.
5. Przestań zapisywać do starej.
6. **Contract**: usuń starą kolumnę.

Pułapki: operacje blokujące tabelę (w Postgresie np. \`CREATE INDEX\` bez \`CONCURRENTLY\`, niektóre ALTER TYPE), długie locki przy dużych tabelach, \`lock_timeout\` na migracjach, rollback aplikacji musi działać ze schematem po migracji.`,
  },

  // =====================================================================
  // ARCHITEKTURA
  // =====================================================================
  {
    id: 'arch-monolith-micro',
    category: 'Architektura',
    difficulty: 2,
    question: 'Monolit czy mikroserwisy? Kiedy warto migrować?',
    answer: `**Mikroserwisy dają**: niezależne deploye i skalowanie, autonomię zespołów, izolację awarii, swobodę technologii.
**Kosztują**: sieć (latencja, awarie), rozproszone transakcje, eventual consistency, observability, DevOps, testy integracyjne, wersjonowanie API.

Senior odpowiada: **„zależy, ale domyślnie modularny monolit”**. Mikroserwisy rozwiązują głównie problem **organizacyjny** (wiele zespołów blokuje się nawzajem), a nie techniczny.

Sygnały do wydzielenia: zespoły się blokują przy deployu, części systemu mają skrajnie różne wymagania skalowania/dostępności, wyraźne granice domenowe.

Migracja: **Strangler Fig**. Stopniowo wydzielasz funkcje za fasadą/proxy. Bez big-bang rewrite.

Antywzorzec: **rozproszony monolit**, czyli serwisy, które trzeba deployować razem i które dzielą bazę.`,
    followUps: ['Jak wyznaczasz granice serwisów?', 'Czy serwisy mogą współdzielić bazę danych?'],
  },
  {
    id: 'arch-ddd',
    category: 'Architektura',
    difficulty: 3,
    question: 'Kluczowe pojęcia Domain-Driven Design: bounded context, agregat, ubiquitous language.',
    answer: `- **Ubiquitous language**: wspólny język biznesu i kodu. Nazwy klas = pojęcia ekspertów domenowych.
- **Bounded context**: granica, w której model i język mają jednoznaczne znaczenie. „Klient” w sprzedaży i w supporcie to różne modele. Dobry kandydat na granicę serwisu/modułu.
- **Context map**: relacje między kontekstami (anti-corruption layer, shared kernel, customer/supplier).
- **Agregat**: klaster obiektów traktowany jako jednostka spójności, z **korzeniem** (aggregate root), przez który idą wszystkie zmiany. Jedna transakcja = jeden agregat. Między agregatami eventual consistency przez **domain events**.
- **Entity** (tożsamość) vs **Value Object** (niezmienny, porównywany po wartości, np. Money).
- Strategiczne DDD (granice) jest zwykle cenniejsze niż taktyczne (wzorce w kodzie).`,
  },
  {
    id: 'arch-hexagonal',
    category: 'Architektura',
    difficulty: 2,
    question: 'Na czym polega architektura heksagonalna (ports & adapters) / Clean Architecture?',
    answer: `Logika domenowa jest w środku i **nie zależy od infrastruktury**. Zależności wskazują do środka (Dependency Inversion).
- **Porty**: interfejsy definiowane przez domenę (np. \`OrderRepository\`, \`PaymentGateway\`).
- **Adaptery**: implementacje portów (Postgres, Stripe, kontroler REST, konsument Kafki).

Zalety: testowalność domeny bez bazy i frameworka, wymienialność infrastruktury, czytelne granice.
Koszt: więcej warstw i mapowania. Dla prostego CRUD-a to overengineering. Senior wie, kiedy NIE stosować.`,
  },
  {
    id: 'arch-cqrs-es',
    category: 'Architektura',
    difficulty: 3,
    question: 'CQRS i Event Sourcing: co to jest i kiedy ma sens?',
    answer: `**CQRS**: rozdzielenie modelu zapisu (komendy, walidacja reguł) i modelu odczytu (zoptymalizowane widoki/projekcje). Można mieć osobne bazy, np. zapis w Postgresie, odczyt w Elasticsearch.

**Event Sourcing**: stan nie jest zapisywany wprost. Zapisujesz **niezmienny log zdarzeń** (OrderPlaced, ItemAdded…), a stan odtwarzasz z eventów (ze snapshotami dla wydajności).

Zalety ES: pełny audyt, odtwarzanie stanu w czasie, nowe projekcje z historii.
Koszty: złożoność, **wersjonowanie eventów** (schemat na zawsze), eventual consistency widoków, trudniejsze zapytania, RODO (usuwanie danych z niezmiennego logu, np. crypto-shredding).

Stosuj w wybranych kontekstach z silną potrzebą audytu (finanse, logistyka), nie w całym systemie.`,
  },
  {
    id: 'arch-api-styles',
    category: 'Architektura',
    difficulty: 2,
    question: 'REST vs gRPC vs GraphQL: kiedy który?',
    answer: `- **REST/JSON**: uniwersalny, cache HTTP, łatwy debug, publiczne API. Over/under-fetching.
- **gRPC**: Protobuf (binarny, szybki), HTTP/2, streaming, silne kontrakty i generowanie kodu. Świetny **między serwisami**. Słabo w przeglądarce (potrzebny gRPC-web).
- **GraphQL**: klient wybiera pola, jeden endpoint, agregacja wielu źródeł. Dobry dla wielu klientów frontowych (BFF). Koszty: trudny cache HTTP, N+1 (DataLoader), ochrona przed kosztownymi zapytaniami (limit złożoności/głębokości), autoryzacja na poziomie pól.

Plus komunikacja asynchroniczna (eventy) tam, gdzie nie potrzeba natychmiastowej odpowiedzi.`,
  },
  {
    id: 'arch-api-versioning',
    category: 'Architektura',
    difficulty: 2,
    question: 'Jak wersjonujesz i ewoluujesz API, żeby nie łamać klientów?',
    answer: `- Przede wszystkim **zmiany wstecznie kompatybilne**: dodawanie pól i endpointów jest OK. Usuwanie, zmiana typu czy znaczenia pola to breaking change.
- Klienci powinni być **tolerant readers** (ignorować nieznane pola).
- Wersjonowanie: w URL (\`/v2/\`) jest najprostsze i widoczne, w nagłówku/media type czystsze, ale mniej oczywiste. Stripe stosuje wersje datowane per konto.
- Proces deprecacji: ogłoszenie, nagłówki \`Deprecation\`/\`Sunset\`, monitoring, kto jeszcze używa starej wersji, termin wyłączenia.
- Między serwisami: **consumer-driven contract tests** (Pact), schema registry dla eventów.`,
  },
  {
    id: 'arch-coupling',
    category: 'Architektura',
    difficulty: 2,
    question: 'Co to jest coupling i cohesion i jak na nie wpływasz?',
    answer: `- **Cohesion (spójność)**: jak bardzo elementy modułu są ze sobą powiązane i służą jednemu celowi. Chcemy **wysokiej**.
- **Coupling (sprzężenie)**: jak bardzo moduły zależą od siebie. Chcemy **niskiego**.

Jak to osiągnąć: grupowanie po funkcji biznesowej (feature folders, bounded contexts) zamiast po warstwie technicznej, komunikacja przez wąskie interfejsy, ukrywanie szczegółów implementacji, eventy zamiast bezpośrednich wywołań tam, gdzie to ma sens, unikanie współdzielonej bazy między modułami.

Uważaj na coupling ukryty: wspólne biblioteki z logiką biznesową, temporal coupling (A musi działać, żeby B działało), współdzielony format danych.`,
  },
  {
    id: 'arch-decisions',
    category: 'Architektura',
    difficulty: 2,
    question: 'Jak podejmujesz i dokumentujesz decyzje architektoniczne?',
    answer: `- **ADR (Architecture Decision Record)**: krótki dokument w repo: kontekst, rozważane opcje, decyzja, konsekwencje. Niezmienny. Nowa decyzja zastępuje starą.
- Decyzje odwracalne (two-way door) podejmuj szybko, nieodwracalne (one-way door: baza, język, granice serwisów) ostrożniej, z prototypem/spike'iem.
- Kryteria: wymagania niefunkcjonalne, kompetencje zespołu, koszt utrzymania, ryzyko, time-to-market.
- Angażuj ludzi, których decyzja dotyczy (RFC, design review). Unikaj „architekta w wieży”.
- **C4 model** do diagramów (context, container, component, code).`,
  },
  {
    id: 'arch-tech-debt',
    category: 'Architektura',
    difficulty: 2,
    question: 'Jak zarządzasz długiem technicznym?',
    answer: `- Dług to narzędzie, nie grzech. Świadomy dług (dla szybszego time-to-market) jest OK, jeśli jest **zapisany** i ma plan spłaty.
- **Uwidocznij go**: backlog, oznaczenie w ticketach, metryki (czas zmiany w danym obszarze, liczba bugów, czas onboardingu).
- **Priorytetyzuj po wpływie**: spłacaj dług w miejscach często zmienianych (hotspoty = churn × złożoność). Dług w kodzie, którego nikt nie dotyka, może poczekać.
- Mów językiem biznesu: „ta zmiana skróci dodawanie metod płatności z 3 tygodni do 3 dni”, a nie „kod jest brzydki”.
- Praktyki: boy scout rule, stały % capacity sprintu, refactoring przy okazji feature'ów, Strangler Fig dla dużych przepisań. Unikaj big-bang rewrite.`,
  },

  // =====================================================================
  // JS / TS / NODE (SENIOR)
  // =====================================================================
  {
    id: 'node-event-loop-phases',
    category: 'JS / TS / Node (senior)',
    difficulty: 3,
    question: 'Jak działa event loop w Node.js (fazy, libuv, thread pool)?',
    answer: `Node = V8 + **libuv**. Kod JS działa na jednym wątku. I/O sieciowe jest nieblokujące (epoll/kqueue/IOCP), a operacje plikowe, DNS (\`dns.lookup\`), crypto i zlib idą do **thread poola libuv** (domyślnie 4 wątki, \`UV_THREADPOOL_SIZE\`).

**Fazy pętli**: timers (setTimeout/setInterval) → pending callbacks → idle/prepare → **poll** (I/O) → **check** (setImmediate) → close callbacks.

Między każdym callbackiem opróżniane są kolejki: najpierw \`process.nextTick\`, potem mikrozadania (Promise).

Wnioski:
- CPU-heavy kod blokuje cały serwer. Używaj worker_threads, wydzielonego serwisu albo dziel pracę na kawałki.
- Nadużycie \`process.nextTick\` może zagłodzić I/O.
- Monitoruj **event loop lag**.`,
    followUps: ['setImmediate vs setTimeout(fn, 0): kolejność?', 'Kiedy zwiększysz UV_THREADPOOL_SIZE?'],
  },
  {
    id: 'node-memory-leaks',
    category: 'JS / TS / Node (senior)',
    difficulty: 3,
    question: 'Jak szukasz wycieku pamięci w aplikacji Node/przeglądarce?',
    answer: `**Typowe przyczyny**: globalne kolekcje/cache bez limitu, niewyrejestrowane event listenery, timery (setInterval), domknięcia trzymające duże obiekty, odłączone węzły DOM trzymane w JS.

**Proces**:
1. Potwierdź: metryki heap used / RSS rosną mimo GC (wykres „piła” z rosnącą podstawą).
2. Zrób **heap snapshoty** (Chrome DevTools, \`--inspect\`, \`v8.writeHeapSnapshot\`) w odstępie czasu i porównaj (Comparison view). Szukaj obiektów, których przybywa.
3. Sprawdź **retainers**, czyli kto trzyma referencję.
4. Napraw: limity cache (LRU), \`WeakMap\`/\`WeakRef\`, cleanup w \`removeEventListener\` / \`useEffect\` cleanup / \`AbortController\`.

Pamiętaj o \`--max-old-space-size\` i limitach pamięci w kontenerach.`,
  },
  {
    id: 'node-streams',
    category: 'JS / TS / Node (senior)',
    difficulty: 2,
    question: 'Streamy w Node i backpressure: o co chodzi?',
    answer: `Stream przetwarza dane kawałkami zamiast ładować całość do pamięci (np. plik 10 GB, duży eksport CSV, proxy HTTP).

Typy: Readable, Writable, Duplex, Transform.

**Backpressure**: gdy konsument (Writable) nie nadąża, \`write()\` zwraca \`false\` i producent powinien wstrzymać się do zdarzenia \`'drain'\`. Ignorowanie tego oznacza puchnięcie bufora w pamięci.

Używaj \`stream.pipeline()\` (albo \`pipeline\` z \`stream/promises\`). Obsługuje backpressure, propaguje błędy i sprząta strumienie. Samo \`.pipe()\` nie propaguje błędów.

\`\`\`js
import { pipeline } from 'node:stream/promises';
await pipeline(fs.createReadStream('in.csv'), transform, fs.createWriteStream('out.csv'));
\`\`\``,
  },
  {
    id: 'ts-advanced-types',
    category: 'JS / TS / Node (senior)',
    difficulty: 3,
    question: 'Zaawansowany TypeScript: generyki, typy warunkowe, mapped types, infer.',
    answer: `\`\`\`ts
// generyk z ograniczeniem
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> { /* ... */ }

// mapped type
type Readonly2<T> = { readonly [P in keyof T]: T[P] };

// typ warunkowy + infer
type Awaited2<T> = T extends Promise<infer U> ? U : T;

// discriminated union: exhaustiveness check
type Shape = { kind: 'circle'; r: number } | { kind: 'square'; a: number };
function area(s: Shape) {
  switch (s.kind) {
    case 'circle': return Math.PI * s.r ** 2;
    case 'square': return s.a ** 2;
    default: { const _never: never = s; return _never; }
  }
}
\`\`\`
Warto znać też: **structural typing** (zgodność po kształcie, nie po nazwie), \`unknown\` vs \`any\`, type guards (\`x is T\`), \`satisfies\`, branded types (np. \`UserId\` różny od \`string\`), utility types (Partial, Required, Record, Omit, ReturnType). Typy TS **znikają w runtime**, więc dane z zewnątrz trzeba walidować (zod/valibot).`,
  },
  {
    id: 'js-prototype',
    category: 'JS / TS / Node (senior)',
    difficulty: 2,
    question: 'Jak działa dziedziczenie prototypowe i czym są klasy w JS?',
    answer: `Każdy obiekt ma wewnętrzny link \`[[Prototype]]\`. Przy odczycie właściwości, której obiekt nie ma, JS szuka jej w łańcuchu prototypów aż do \`null\`.

\`class\` to głównie **lukier składniowy** na funkcje konstruktorów i prototypy. Metody lądują na \`Klasa.prototype\` i są współdzielone przez instancje. Różnice: klasy są w strict mode, nie da się ich wywołać bez \`new\`, mają prawdziwie prywatne pola \`#x\`.

\`Object.create(proto)\` tworzy obiekt z danym prototypem. \`instanceof\` sprawdza łańcuch prototypów.`,
  },
  {
    id: 'js-weakmap',
    category: 'JS / TS / Node (senior)',
    difficulty: 2,
    question: 'Map vs WeakMap, Set vs WeakSet: kiedy słabe referencje?',
    answer: `**WeakMap** trzyma klucze (tylko obiekty) **słabo**. Jeśli nic innego nie odwołuje się do klucza, GC może usunąć wpis. Nie da się po niej iterować ani poznać rozmiaru.

Zastosowania: metadane/cache przypisane do obiektów bez ryzyka wycieku (np. cache wyników per obiekt DOM / request), prywatne dane obiektów.

Do tego \`WeakRef\` i \`FinalizationRegistry\`, ale ich zachowanie zależy od GC. Nie opieraj na nich logiki biznesowej.`,
  },
  {
    id: 'js-debounce-throttle',
    category: 'JS / TS / Node (senior)',
    difficulty: 2,
    question: 'Zaimplementuj debounce i wyjaśnij różnicę względem throttle.',
    answer: `**Debounce**: wywołaj funkcję dopiero po X ms ciszy (np. wyszukiwarka po skończeniu pisania).
**Throttle**: wywołuj najwyżej raz na X ms (np. scroll, resize).

\`\`\`js
function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function throttle(fn, ms) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    }
  };
}
\`\`\`
Rozszerzenia, o które mogą dopytać: opcje leading/trailing, metoda \`cancel()\`, zwracanie Promise.`,
  },
  {
    id: 'js-promise-all-impl',
    category: 'JS / TS / Node (senior)',
    difficulty: 3,
    question: 'Zaimplementuj Promise.all oraz funkcję wykonującą zadania z limitem współbieżności.',
    answer: `\`\`\`js
function promiseAll(items) {
  return new Promise((resolve, reject) => {
    const results = [];
    let done = 0;
    if (items.length === 0) return resolve(results);
    items.forEach((p, i) => {
      Promise.resolve(p).then(v => {
        results[i] = v;               // zachowujemy kolejność
        if (++done === items.length) resolve(results);
      }, reject);                     // pierwszy błąd odrzuca całość
    });
  });
}

async function mapLimit(tasks, limit) {   // tasks: tablica funkcji zwracających Promise
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
\`\`\``,
  },

  // =====================================================================
  // FRONTEND (SENIOR)
  // =====================================================================
  {
    id: 'fe-rendering-strategies',
    category: 'Frontend (senior)',
    difficulty: 2,
    question: 'CSR vs SSR vs SSG vs ISR vs streaming: jak wybierasz?',
    answer: `- **CSR**: pusta strona + JS renderuje w przeglądarce. Proste hostowanie, słabsze SEO i pierwszy render (FCP/LCP).
- **SSR**: HTML generowany per request. Dobre SEO i LCP, ale koszt serwera, TTFB i **hydratacja** (JS musi „ożywić” HTML).
- **SSG**: HTML generowany w buildzie. Najszybsze (CDN), ale dane mogą być nieaktualne.
- **ISR**: SSG z odświeżaniem w tle co X sekund / na żądanie.
- **Streaming SSR / React Server Components**: HTML wysyłany kawałkami (Suspense), komponenty serwerowe nie trafiają do bundla.
- **Islands / partial hydration** (Astro): hydratujesz tylko interaktywne fragmenty.

Wybór per strona: marketing/blog SSG, katalog produktów ISR/SSR, panel za logowaniem CSR.`,
  },
  {
    id: 'fe-web-vitals',
    category: 'Frontend (senior)',
    difficulty: 2,
    question: 'Core Web Vitals: co mierzą i jak je poprawić?',
    answer: `- **LCP** (Largest Contentful Paint, < 2,5 s): render największego elementu. Poprawa: szybki TTFB, preload kluczowego obrazu/fontu, optymalizacja obrazów (AVIF/WebP, \`srcset\`), mniej render-blocking CSS/JS, \`fetchpriority="high"\`.
- **INP** (Interaction to Next Paint, < 200 ms, zastąpił FID): responsywność na interakcje. Poprawa: dzielenie długich tasków (> 50 ms), mniej JS, \`scheduler.yield\`, web workery, unikanie zbędnych re-renderów.
- **CLS** (Cumulative Layout Shift, < 0,1): stabilność układu. Poprawa: wymiary obrazów i iframe'ów, zarezerwowane miejsce na reklamy/banery, \`font-display\` + dopasowane fallbacki fontów.

Mierz **dane polowe (RUM, CrUX)**, nie tylko Lighthouse.`,
  },
  {
    id: 'fe-react-rendering',
    category: 'Frontend (senior)',
    difficulty: 3,
    question: 'Jak React decyduje o re-renderze i jak optymalizujesz wydajność?',
    answer: `Komponent renderuje się ponownie, gdy: zmieni się jego stan, **re-renderuje się rodzic** (nawet przy tych samych propsach), zmieni się kontekst, którego używa.

Reconciliation: porównanie drzew (virtual DOM). Różny typ elementu oznacza wymianę poddrzewa. Listy wymagają stabilnego \`key\` (nie indeksu przy zmiennej kolejności).

**Optymalizacje** (najpierw zmierz React Profilerem):
- przenieś stan niżej (colocation) lub podawaj komponenty przez \`children\`,
- \`React.memo\` + stabilne referencje (\`useMemo\`, \`useCallback\`), ewentualnie React Compiler, który robi to automatycznie,
- podział kontekstu (osobne konteksty dla rzadko i często zmieniających się danych) albo store z selektorami (Zustand, Redux),
- wirtualizacja długich list,
- \`useTransition\` / \`useDeferredValue\` dla niepilnych aktualizacji,
- code splitting (\`lazy\` + Suspense).`,
  },
  {
    id: 'fe-state-management',
    category: 'Frontend (senior)',
    difficulty: 2,
    question: 'Jak podchodzisz do zarządzania stanem w dużej aplikacji frontendowej?',
    answer: `Najpierw **rozróżnij rodzaje stanu**:
- **Server state** (dane z API): TanStack Query / SWR / RTK Query. Cache, deduplikacja, revalidacja, optimistic updates. To zwykle 80% „globalnego stanu”.
- **URL state**: filtry, paginacja, zakładki w query params (linkowalność, back button).
- **Lokalny stan UI**: \`useState\` przy komponencie.
- **Globalny stan klienta** (motyw, sesja, koszyk): Context dla rzadkich zmian, Zustand/Redux/Jotai dla częstych.
- **Stan formularzy**: React Hook Form + walidacja schematem.

Antywzorzec: wrzucanie odpowiedzi z API do Reduxa i ręczne zarządzanie loading/error/cache.`,
  },
  {
    id: 'fe-browser-rendering',
    category: 'Frontend (senior)',
    difficulty: 3,
    question: 'Opisz pipeline renderowania przeglądarki. Co to jest reflow i jak go unikać?',
    answer: `HTML → **DOM**, CSS → **CSSOM** → **Render tree** → **Layout** (geometria) → **Paint** (piksele w warstwach) → **Composite** (składanie warstw na GPU).

- Zmiana geometrii (width, top, dodanie elementu) wymusza **layout (reflow)** + paint + composite. Najdrożej.
- Zmiana koloru wymusza paint + composite.
- \`transform\` i \`opacity\` to sam **composite**. Najtaniej, dlatego animuj tylko je.

**Layout thrashing**: przeplatanie odczytów (\`offsetHeight\`, \`getBoundingClientRect\`) i zapisów stylów w pętli wymusza synchroniczny layout wiele razy. Rozwiązanie: najpierw wszystkie odczyty, potem zapisy, \`requestAnimationFrame\`.

Inne techniki: \`will-change\` (ostrożnie), \`content-visibility: auto\`, CSS containment.`,
  },

  // =====================================================================
  // WSPÓŁBIEŻNOŚĆ
  // =====================================================================
  {
    id: 'conc-basics',
    category: 'Współbieżność',
    difficulty: 2,
    question: 'Proces vs wątek vs korutyna/async: różnice i kiedy co?',
    answer: `- **Proces**: osobna przestrzeń adresowa, izolacja, droższe tworzenie i komunikacja (IPC). Dobry do izolacji i omijania GIL (Python multiprocessing).
- **Wątek**: współdzielona pamięć w procesie, tańszy, ale wymaga synchronizacji (race conditions). Wątki systemowe są ciężkie (stos ~1 MB).
- **Korutyny / async / green threads / wirtualne wątki** (async/await, goroutines, Java Loom): lekkie, przełączane przez runtime, tysiące–miliony naraz. Idealne do **I/O-bound**.

Zasada: **I/O-bound** → async / wirtualne wątki. **CPU-bound** → wiele wątków/procesów ≈ liczba rdzeni.

Współbieżność (concurrency: zarządzanie wieloma zadaniami naraz) ≠ równoległość (parallelism: faktyczne wykonanie w tym samym czasie na wielu rdzeniach).`,
  },
  {
    id: 'conc-race-deadlock',
    category: 'Współbieżność',
    difficulty: 2,
    question: 'Race condition, deadlock, livelock, starvation: definicje i przeciwdziałanie.',
    answer: `- **Race condition**: wynik zależy od kolejności przeplotu wątków (np. \`count++\` to read-modify-write). Rozwiązania: mutex, operacje atomowe, niezmienne dane, jeden właściciel danych (aktor, kanał).
- **Deadlock**: wzajemne czekanie na zasoby. Warunki Coffmana: wzajemne wykluczanie, hold-and-wait, brak wywłaszczania, **cykliczne czekanie**. Przeciwdziałanie: stała kolejność brania locków, \`tryLock\` z timeoutem, mniej locków naraz.
- **Livelock**: wątki aktywnie reagują na siebie, ale nie robią postępu (dwie osoby ustępujące sobie w korytarzu). Rozwiązanie: losowy backoff.
- **Starvation**: wątek nigdy nie dostaje zasobu. Rozwiązanie: sprawiedliwe locki, priorytety z aging.

Race conditions występują też w JS (single-thread). Przykład: dwa async requesty i odpowiedź starszego przychodząca później nadpisuje nowszy wynik. Rozwiązanie: AbortController, ignorowanie przestarzałych odpowiedzi.`,
  },
  {
    id: 'conc-primitives',
    category: 'Współbieżność',
    difficulty: 3,
    question: 'Mutex, semafor, RW-lock, CAS: czym się różnią?',
    answer: `- **Mutex**: wzajemne wykluczanie, jeden właściciel naraz.
- **Semafor**: licznik pozwalający N wątkom naraz (np. limit połączeń do zasobu).
- **Read-write lock**: wielu czytelników albo jeden pisarz. Opłaca się przy przewadze odczytów.
- **Condition variable**: czekanie na spełnienie warunku (producent–konsument).
- **CAS (compare-and-swap)**: atomowa instrukcja CPU, podstawa struktur **lock-free** (AtomicInteger, ConcurrentHashMap). Problem ABA, rozwiązywany wersjonowaniem.
- **Memory model / visibility**: bez barier pamięci (volatile, atomics) jeden wątek może nie widzieć zapisów drugiego (cache CPU, reordering).

Na wyższym poziomie: kanały (Go), aktorzy (Akka/Erlang), immutable data, thread-safe kolekcje.`,
  },

  // =====================================================================
  // BEZPIECZEŃSTWO
  // =====================================================================
  {
    id: 'sec-owasp',
    category: 'Bezpieczeństwo',
    difficulty: 2,
    question: 'Wymień najważniejsze zagrożenia z OWASP Top 10 i jak się przed nimi bronisz.',
    answer: `- **Broken Access Control** (nr 1): IDOR (\`/orders/123\` cudzego użytkownika), brak sprawdzenia uprawnień po stronie serwera. Autoryzacja przy każdym zasobie, deny by default.
- **Injection** (SQL, NoSQL, command): zapytania parametryzowane / ORM, walidacja wejścia, nigdy konkatenacja.
- **Cryptographic failures**: TLS wszędzie, szyfrowanie danych wrażliwych, poprawne hashowanie haseł.
- **Insecure design**: threat modeling na etapie projektu.
- **Security misconfiguration**: domyślne hasła, otwarte panele, verbose errors na produkcji.
- **Vulnerable components**: skanowanie zależności (Dependabot, Snyk, npm audit), SBOM.
- **Auth failures**: brute force (rate limit, MFA), słabe sesje.
- **SSRF**: serwer pobiera URL podany przez usera i trafia w sieć wewnętrzną / metadane chmury. Allowlista, blokada prywatnych IP.
- **Logging & monitoring failures**: brak wykrywania ataków.`,
  },
  {
    id: 'sec-xss-csrf',
    category: 'Bezpieczeństwo',
    difficulty: 2,
    question: 'XSS i CSRF: na czym polegają i jak się bronić?',
    answer: `**XSS**: wstrzyknięcie skryptu, który wykona się w przeglądarce ofiary (stored, reflected, DOM-based).
- escapowanie danych zależne od kontekstu (frameworki robią to domyślnie; uważaj na \`innerHTML\`, \`dangerouslySetInnerHTML\`, \`v-html\`),
- sanityzacja HTML (DOMPurify), gdy musisz renderować HTML,
- **Content Security Policy** (nonce/hash, bez \`unsafe-inline\`),
- ciasteczka sesyjne \`HttpOnly\` (JS ich nie przeczyta).

**CSRF**: złośliwa strona wysyła żądanie do twojej aplikacji, a przeglądarka dołącza ciasteczka ofiary.
- \`SameSite=Lax/Strict\` na ciasteczkach (główna obrona dziś),
- tokeny anty-CSRF (synchronizer / double submit),
- sprawdzanie nagłówka \`Origin\`,
- zmieniające stan operacje nigdy przez GET.`,
  },
  {
    id: 'sec-jwt-sessions',
    category: 'Bezpieczeństwo',
    difficulty: 3,
    question: 'JWT czy sesje po stronie serwera? Jakie są pułapki JWT?',
    answer: `**Sesje**: losowe ID w ciasteczku, stan na serwerze (Redis). Łatwe unieważnienie (wylogowanie, ban), małe ciasteczko. Wymaga współdzielonego store'a.

**JWT**: podpisany token z claimami. Bezstanowy, weryfikowalny bez bazy, wygodny między serwisami.

**Pułapki JWT**:
- **nie da się go łatwo unieważnić**, więc krótki czas życia access tokena (5–15 min) + **refresh token** (rotowany, z wykrywaniem ponownego użycia) albo denylista,
- algorytm: wymuszaj konkretny (podatności \`alg: none\` / pomylenie RS256 z HS256),
- payload jest tylko zakodowany (base64), **nie zaszyfrowany**, więc żadnych sekretów w środku,
- przechowywanie w localStorage oznacza podatność na kradzież przez XSS. Bezpieczniej ciasteczko \`HttpOnly; Secure; SameSite\`.

Dla klasycznej aplikacji webowej sesje są często prostsze i bezpieczniejsze. JWT sprawdza się przy API między serwisami i w federacji tożsamości.`,
  },
  {
    id: 'sec-oauth',
    category: 'Bezpieczeństwo',
    difficulty: 3,
    question: 'Wyjaśnij OAuth 2.0 i OpenID Connect. Czym jest PKCE?',
    answer: `- **OAuth 2.0**: protokół **autoryzacji**. Aplikacja dostaje access token, żeby działać na zasobach użytkownika (delegacja uprawnień) bez poznawania jego hasła.
- **OIDC**: warstwa **uwierzytelniania** nad OAuth. Dodaje **ID token** (JWT z informacją, kim jest użytkownik) i endpoint userinfo. „Zaloguj przez Google” to OIDC.

**Flowy**:
- **Authorization Code + PKCE**: standard dla aplikacji webowych, SPA i mobilnych,
- **Client Credentials**: maszyna–maszyna,
- Implicit i Password grant: przestarzałe, nie używać.

**PKCE**: klient generuje losowy \`code_verifier\` i wysyła jego hash (\`code_challenge\`) na początku flow. Przy wymianie kodu na token musi pokazać oryginał. Chroni przed przechwyceniem authorization code (klienci publiczni nie mają sekretu).

Parametr \`state\` chroni przed CSRF, a \`redirect_uri\` musi być dokładnie dopasowany.`,
  },
  {
    id: 'sec-passwords-secrets',
    category: 'Bezpieczeństwo',
    difficulty: 2,
    question: 'Jak przechowujesz hasła użytkowników i sekrety aplikacji?',
    answer: `**Hasła**: nigdy nie szyfruj odwracalnie i nie używaj szybkich hashy (MD5, SHA-256). Używaj wolnych, z solą: **Argon2id** (preferowany), **bcrypt**, scrypt. Sól jest unikalna per hasło (biblioteki robią to same). Opcjonalnie pepper w HSM/KMS. Do tego rate limiting, MFA, sprawdzanie wycieków (HaveIBeenPwned k-anonymity).

**Sekrety aplikacji**: nie w repo ani w obrazie Dockera. Używaj secret managera (Vault, AWS Secrets Manager, GCP Secret Manager) lub zaszyfrowanych secretów w CI/K8s, rotacji, najmniejszych uprawnień, krótkotrwałych poświadczeń (OIDC federation z CI do chmury zamiast stałych kluczy). Skanowanie repo (gitleaks, GitHub secret scanning). Wyciekły sekret → **rotacja**, nie tylko usunięcie z historii.`,
  },

  // =====================================================================
  // TESTOWANIE I JAKOŚĆ
  // =====================================================================
  {
    id: 'test-strategy',
    category: 'Testowanie i jakość',
    difficulty: 2,
    question: 'Jak budujesz strategię testów w projekcie? Piramida vs trofeum.',
    answer: `- **Piramida**: dużo szybkich testów jednostkowych, mniej integracyjnych, mało E2E.
- **Trofeum testów** (Kent C. Dodds): nacisk na **testy integracyjne**, które dają najwięcej pewności na koszt. Plus statyczna analiza (TS, lint) jako fundament.

Zasady seniora:
- testuj **zachowanie**, nie implementację (refaktor nie powinien psuć testów),
- testy integracyjne z prawdziwą bazą (**Testcontainers**) zamiast mockowania ORM-a,
- E2E tylko dla krytycznych ścieżek (logowanie, płatność),
- **contract tests** między serwisami,
- testy muszą być szybkie i deterministyczne, inaczej ludzie przestaną je uruchamiać,
- coverage to wskaźnik, nie cel. Mutation testing lepiej mierzy jakość testów.`,
  },
  {
    id: 'test-doubles',
    category: 'Testowanie i jakość',
    difficulty: 2,
    question: 'Mock, stub, fake, spy: różnice. Kiedy mockowanie szkodzi?',
    answer: `- **Stub**: zwraca zaprogramowane odpowiedzi.
- **Mock**: weryfikuje, że wywołano go w określony sposób (test interakcji).
- **Spy**: prawdziwy obiekt/funkcja, która rejestruje wywołania.
- **Fake**: działająca, uproszczona implementacja (in-memory repozytorium).

**Mockowanie szkodzi**, gdy:
- mockujesz to, czego nie posiadasz (biblioteki, ORM). Lepiej owinąć adapterem i testować integracyjnie,
- testy weryfikują szczegóły implementacji, więc każdy refaktor je psuje,
- mocki się rozjeżdżają z rzeczywistością i testy są zielone, a produkcja leży.

Zasada: mockuj na **granicach systemu** (sieć, czas, losowość, zewnętrzne API). Wewnątrz używaj prawdziwych obiektów lub fake'ów.`,
  },
  {
    id: 'test-flaky',
    category: 'Testowanie i jakość',
    difficulty: 2,
    question: 'Co robisz z flaky testami?',
    answer: `Flaky test niszczy zaufanie do CI, bo ludzie zaczynają ignorować czerwone buildy.

Proces: **wykryj** (statystyki z CI, ponowne uruchomienia), **poddaj kwarantannie** (oznacz i nie blokuj pipeline'u, ale z ticketem i właścicielem), **napraw przyczynę**.

Typowe przyczyny:
- zależność od czasu (wstrzykuj zegar), strefy czasowej, losowości (seed),
- kolejność testów i współdzielony stan (izolacja danych, transakcje z rollbackiem),
- asynchroniczność: \`sleep\` zamiast czekania na warunek,
- zewnętrzne zależności (sieć),
- wyścigi w kodzie produkcyjnym. Flaky test bywa prawdziwym bugiem!

Automatyczny retry to plaster, nie rozwiązanie.`,
  },
  {
    id: 'quality-code-review',
    category: 'Testowanie i jakość',
    difficulty: 1,
    question: 'Jak robisz dobre code review?',
    answer: `- **Priorytety**: poprawność i bezpieczeństwo → design i utrzymywalność → testy → czytelność. Formatowanie i styl zostaw linterom.
- Małe PR-y (< 400 linii) są lepiej recenzowane. Zachęcaj do dzielenia.
- Ton: pytania zamiast rozkazów („co myślisz o…?”), komentuj kod, nie osobę, oznaczaj wagę (\`nit:\`, \`blocking:\`).
- Chwal dobre rozwiązania. Review to też narzędzie nauki i dzielenia się wiedzą.
- Szybki czas odpowiedzi (review czekające 2 dni zabija flow).
- Duże decyzje omawiaj synchronicznie lub w design docu przed implementacją, nie w PR po fakcie.`,
  },

  // =====================================================================
  // DEVOPS I OBSERWOWALNOŚĆ
  // =====================================================================
  {
    id: 'ops-deploy-strategies',
    category: 'DevOps i obserwowalność',
    difficulty: 2,
    question: 'Jakie znasz strategie wdrożeń? Blue-green, canary, rolling, feature flags.',
    answer: `- **Rolling**: stopniowa wymiana instancji. Domyślne w Kubernetes. Dwie wersje działają jednocześnie, więc muszą być kompatybilne.
- **Blue-green**: dwa identyczne środowiska, przełączenie ruchu naraz. Natychmiastowy rollback, ale podwójne zasoby. Uwaga na bazę danych (wspólna!).
- **Canary**: nowa wersja dostaje 1% → 5% → 25% → 100% ruchu, z automatycznym rollbackiem po metrykach (error rate, latencja).
- **Feature flags**: oddzielenie **deployu** od **release'u**. Kod jest na produkcji, ale wyłączony. Pozwala na trunk-based development, testy A/B, kill switch. Koszt: dług flag, więc trzeba je usuwać.
- **Dark launch / shadow traffic**: kopiowanie ruchu do nowej wersji bez zwracania odpowiedzi.`,
  },
  {
    id: 'ops-observability',
    category: 'DevOps i obserwowalność',
    difficulty: 2,
    question: 'Co to jest observability? Logi, metryki, trace\'y.',
    answer: `Observability to możliwość zrozumienia stanu systemu z jego zewnętrznych sygnałów, także dla problemów, których nie przewidziałeś.

- **Metryki**: liczby w czasie, tanie, do alertów i dashboardów. Metoda **RED** dla serwisów (Rate, Errors, Duration) i **USE** dla zasobów (Utilization, Saturation, Errors). Uważaj na wysoką kardynalność etykiet (np. user_id jako label).
- **Logi**: **strukturalne** (JSON), z korelacyjnym request/trace ID, właściwymi poziomami, bez danych osobowych i sekretów.
- **Distributed tracing**: śledzenie żądania przez wiele serwisów (spany), lokalizowanie latencji. Standard to **OpenTelemetry**.

Do tego: profilowanie ciągłe, RUM na froncie, alerty na **symptomy** (to, co widzi użytkownik), a nie przyczyny (CPU 80%).`,
  },
  {
    id: 'ops-slo',
    category: 'DevOps i obserwowalność',
    difficulty: 2,
    question: 'SLI, SLO, SLA, error budget: wyjaśnij.',
    answer: `- **SLI** (indicator): mierzalny wskaźnik, np. % requestów zakończonych sukcesem w < 300 ms.
- **SLO** (objective): wewnętrzny cel dla SLI, np. 99,9% w oknie 30 dni.
- **SLA** (agreement): umowa z klientem z konsekwencjami finansowymi. Luźniejsza niż SLO.
- **Error budget** = 100% − SLO. Przy 99,9% to ok. **43 minuty** niedostępności miesięcznie. Gdy budżet jest, można ryzykować szybkie wdrożenia. Gdy się skończył, priorytet ma stabilność.

100% dostępności to zły cel: nieosiągalny, nieopłacalny i blokuje rozwój. Alertuj na **burn rate** budżetu, nie na pojedyncze błędy.`,
  },
  {
    id: 'ops-incident',
    category: 'DevOps i obserwowalność',
    difficulty: 2,
    question: 'Produkcja leży. Jak prowadzisz incydent?',
    answer: `**W trakcie**:
1. Ustal **wpływ** (kto, ile, od kiedy) i ogłoś incydent. Role: incident commander, komunikacja, osoby techniczne.
2. **Najpierw mitygacja, potem diagnoza**: rollback ostatniego deployu, wyłączenie feature flagi, skalowanie, przełączenie ruchu. Przywróć działanie, root cause szukasz później.
3. Komunikuj regularnie status (status page, kanał incydentu).
4. Prowadź oś czasu działań.

**Po incydencie**: **blameless postmortem**: timeline, wpływ, przyczyna źródłowa (5 Whys), co zadziałało, co nie, **action items z właścicielami i terminami** (alerty, testy, automatyzacja). Pytamy, dlaczego system pozwolił na błąd, a nie kto zawinił.`,
  },
  {
    id: 'ops-containers-k8s',
    category: 'DevOps i obserwowalność',
    difficulty: 2,
    question: 'Kontenery vs VM. Podstawowe obiekty Kubernetes i typowe problemy.',
    answer: `**Kontener** współdzieli kernel hosta (namespaces + cgroups): lekki, startuje w sekundy, słabsza izolacja. **VM** ma własny kernel (hypervisor): mocna izolacja, cięższa.

**Kubernetes**: Pod (najmniejsza jednostka), Deployment (deklaratywne repliki, rolling update), Service (stabilny adres + load balancing), Ingress/Gateway (HTTP z zewnątrz), ConfigMap/Secret, HPA (autoskalowanie), StatefulSet (stanowe aplikacje), Job/CronJob.

**Typowe problemy**:
- brak **requests/limits** lub złe ustawienia: OOMKilled, CPU throttling,
- źle ustawione **readiness vs liveness** probes (liveness zależna od bazy oznacza kaskadowe restarty),
- brak graceful shutdown (obsługa SIGTERM, preStop, dokończenie requestów),
- obrazy: multi-stage build, mały obraz bazowy, nie uruchamiaj jako root, pinowane wersje.`,
  },
  {
    id: 'ops-cicd',
    category: 'DevOps i obserwowalność',
    difficulty: 1,
    question: 'Jak wygląda dobry pipeline CI/CD?',
    answer: `- **Trunk-based development** / krótko żyjące branche, częste małe merge'e.
- CI na każdym PR: build, lint, typecheck, testy (równolegle, z cache), skan bezpieczeństwa (SAST, zależności, sekrety), budowa artefaktu.
- **Build once, deploy many**: ten sam artefakt (obraz z tagiem SHA) przechodzi przez staging i prod. Konfiguracja przez zmienne środowiskowe.
- Automatyczny deploy na staging, testy smoke/E2E, deploy na prod (canary), automatyczny rollback po metrykach.
- Infrastructure as Code (Terraform), GitOps (Argo CD).
- Metryki **DORA**: deployment frequency, lead time for changes, change failure rate, time to restore.`,
  },

  // =====================================================================
  // WYDAJNOŚĆ
  // =====================================================================
  {
    id: 'perf-approach',
    category: 'Wydajność',
    difficulty: 2,
    question: 'Endpoint jest wolny (p99 = 3 s). Jak podchodzisz do optymalizacji?',
    answer: `1. **Zmierz, nie zgaduj**: tracing (gdzie idzie czas: DB, zewnętrzne API, CPU, kolejka na pulę połączeń?), percentyle, nie średnia.
2. Znajdź **wąskie gardło**. Optymalizacja czegokolwiek innego nic nie da (prawo Amdahla).
3. Typowe winowajce: zapytania do bazy (N+1, brak indeksu), sekwencyjne wywołania sieciowe, które można zrównoleglić, brak cache, za duże payloady (serializacja), wyczerpana pula połączeń, GC, lock contention.
4. Napraw jedną rzecz, **zmierz ponownie**.
5. Jeśli nie da się przyspieszyć: asynchroniczność (job + polling/webhook), prekomputacja, cache, degradacja.
6. Zabezpiecz: test wydajnościowy w CI / alert na p99.

**Tail latency** (p99) ma znaczenie, bo przy fan-oucie do wielu serwisów prawie każdy request trafi na wolny przypadek. Techniki: hedged requests, timeouty.`,
  },
  {
    id: 'perf-connection-pool',
    category: 'Wydajność',
    difficulty: 2,
    question: 'Po co jest connection pool i jak dobrać jego rozmiar?',
    answer: `Nawiązanie połączenia z bazą jest drogie (TCP, TLS, auth, proces backendu w Postgresie). Pula utrzymuje gotowe połączenia do ponownego użycia.

**Rozmiar**: więcej ≠ lepiej. Baza ma ograniczoną liczbę rdzeni i dysków, więc zbyt wiele połączeń oznacza kontekst-switching i lock contention. Punkt startowy (formuła z HikariCP): \`rdzenie_DB × 2 + liczba_dysków\`, potem test obciążeniowy.

Pamiętaj: **pula × liczba instancji aplikacji** ≤ max_connections bazy. Przy autoskalowaniu/serverless użyj poolera (PgBouncer, RDS Proxy).

Monitoruj: czas oczekiwania na połączenie, aktywne vs bezczynne, timeouty. Nie trzymaj połączenia podczas wywołań sieciowych do innych serwisów.`,
  },

  // =====================================================================
  // ALGORYTMY I LIVE CODING
  // =====================================================================
  {
    id: 'algo-lru',
    category: 'Algorytmy i live coding',
    difficulty: 3,
    question: 'Zaimplementuj LRU cache z operacjami get/put w O(1).',
    answer: `Klasycznie: **hash mapa + lista dwukierunkowa**. W JS można wykorzystać to, że \`Map\` zachowuje kolejność wstawiania:

\`\`\`js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return -1;
    const val = this.map.get(key);
    this.map.delete(key);       // przenieś na koniec = najświeższy
    this.map.set(key, val);
    return val;
  }
  put(key, val) {
    this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > this.capacity) {
      this.map.delete(this.map.keys().next().value); // najstarszy
    }
  }
}
\`\`\`
Na rozmowie powiedz, że w innych językach robisz to na HashMap + własnej liście dwukierunkowej (lub LinkedHashMap w Javie), i omów thread-safety.`,
    followUps: ['Jak zrobić ten cache bezpiecznym wątkowo?', 'Czym różni się LRU od LFU?'],
  },
  {
    id: 'algo-patterns',
    category: 'Algorytmy i live coding',
    difficulty: 2,
    question: 'Jakie wzorce algorytmiczne warto znać na live coding?',
    answer: `- **Hash mapa**: two sum, zliczanie, grupowanie anagramów. O(n) zamiast O(n²).
- **Two pointers**: posortowana tablica, palindromy, usuwanie duplikatów.
- **Sliding window**: najdłuższy podciąg bez powtórzeń, sumy w oknie.
- **Binary search**: także „po odpowiedzi” (minimalna pojemność itp.).
- **BFS/DFS**: grafy, drzewa, wyspy w macierzy. BFS daje najkrótszą ścieżkę w grafie nieważonym.
- **Heap**: top-K, scalanie K list, mediana strumienia.
- **Programowanie dynamiczne**: plecak, najdłuższy wspólny podciąg, liczba ścieżek.
- **Sortowanie topologiczne**: zależności (build, kursy).
- **Union-Find**: spójne składowe.

Na rozmowie: doprecyzuj wymagania, podaj przypadki brzegowe, zacznij od brute force, potem optymalizuj, mów o złożoności, przetestuj na przykładzie.`,
  },
  {
    id: 'algo-top-k',
    category: 'Algorytmy i live coding',
    difficulty: 2,
    question: 'Jak znaleźć K najczęściej występujących elementów? A w strumieniu o ogromnej skali?',
    answer: `**W pamięci**: zlicz w hash mapie, O(n). Potem:
- sortowanie: O(n log n),
- **min-heap o rozmiarze K**: O(n log K),
- bucket sort po częstości: O(n).

**Ogromna skala / strumień**:
- **Count-Min Sketch** + heap: przybliżone liczności w stałej pamięci,
- rozproszenie: map-reduce (zliczanie per partycja, potem scalenie). Pamiętaj, że lokalne top-K nie daje globalnego top-K bez dodatkowych kroków,
- okna czasowe (top-K w ostatniej godzinie) przez stream processing (Flink, Kafka Streams).`,
  },

  // =====================================================================
  // LEADERSHIP I PYTANIA BEHAWIORALNE (SENIOR)
  // =====================================================================
  {
    id: 'lead-what-senior',
    category: 'Leadership (senior)',
    difficulty: 1,
    question: 'Czym według ciebie różni się senior od mida?',
    answer: `Nie latami doświadczenia ani tym, że zna więcej frameworków. Senior:
- bierze odpowiedzialność za **wynik biznesowy**, nie tylko za ticket. Dopytuje o „dlaczego”,
- radzi sobie z **niejednoznacznością**: dostaje problem, nie specyfikację,
- myśli o **trade-offach** i kosztach utrzymania, wie, kiedy NIE budować,
- **podnosi poziom zespołu**: mentoring, review, dokumentacja, standardy,
- widzi ryzyka wcześnie i komunikuje je proaktywnie,
- potrafi powiedzieć „nie wiem, sprawdzę” i „nie zgadzam się, ale się dostosuję”.

Podaj 1–2 konkretne przykłady ze swojej pracy na potwierdzenie.`,
  },
  {
    id: 'lead-disagree',
    category: 'Leadership (senior)',
    difficulty: 2,
    question: 'Opowiedz o sytuacji, gdy nie zgadzałeś/aś się z decyzją techniczną (lidera, architekta, zespołu).',
    answer: `Struktura STAR. Pokaż:
- że **zrozumiałeś/aś** drugą stronę (jakie miała cele i ograniczenia),
- że argumentowałeś/aś **danymi** (benchmark, prototyp, koszty, ryzyka), a nie opinią,
- że rozmowa była prywatna i rzeczowa, a nie publiczna konfrontacja,
- **disagree and commit**: jeśli decyzja zapadła inaczej, wspierasz ją w pełni,
- wynik i wnioski (np. „ustaliliśmy metryki, po których wrócimy do tematu za kwartał”).

Unikaj historii, w której wszyscy byli głupi, a ty miałeś/aś rację.`,
  },
  {
    id: 'lead-mentoring',
    category: 'Leadership (senior)',
    difficulty: 1,
    question: 'Jak mentorujesz juniorów i midów?',
    answer: `- Dopasowanie do osoby: najpierw zrozum jej cele i poziom.
- **Pytania zamiast gotowych odpowiedzi** („jak byś to sprawdził/a?”). Uczy samodzielności.
- Pair programming, rozbudowane komentarze w review z wyjaśnieniem „dlaczego”, linki do materiałów.
- Stopniowanie trudności: zadania trochę ponad obecny poziom (stretch), z siatką bezpieczeństwa.
- Bezpieczne środowisko do błędów i pytań.
- Regularne 1:1, feedback konkretny i szybki (SBI: Situation–Behavior–Impact).
- Sukces mierzysz tym, czy osoba robi postępy i przejmuje coraz większe obszary.`,
  },
  {
    id: 'lead-estimation',
    category: 'Leadership (senior)',
    difficulty: 2,
    question: 'Jak estymujesz duże zadania i co robisz, gdy projekt się opóźnia?',
    answer: `**Estymacja**:
- rozbij na mniejsze części, zidentyfikuj niewiadome i zrób **spike** dla największych ryzyk,
- podawaj **przedział i poziom pewności** („3–5 tygodni, 70%”), a nie jedną liczbę,
- uwzględnij to, o czym się zapomina: testy, review, deploy, migracje, dokumentację, urlopy,
- porównuj z historycznymi danymi podobnych zadań.

**Opóźnienie**:
- komunikuj **wcześnie**, gdy tylko widzisz ryzyko, nie w dniu deadline'u,
- przedstaw opcje: zmniejszenie zakresu (MVP), przesunięcie terminu, dodatkowe osoby (prawo Brooksa: dokładanie ludzi do opóźnionego projektu często go spowalnia),
- przeanalizuj przyczynę i popraw proces.`,
  },
  {
    id: 'lead-production-failure',
    category: 'Leadership (senior)',
    difficulty: 2,
    question: 'Opowiedz o największym błędzie, jaki popełniłeś/aś na produkcji.',
    answer: `Rekruter sprawdza: szczerość, odpowiedzialność, jak działasz pod presją i czy wyciągasz wnioski systemowe.

Struktura:
1. Co się stało i jaki był **wpływ**: konkretnie, bez minimalizowania.
2. Jak zareagowałeś/aś: szybka eskalacja, mitygacja, komunikacja.
3. **Root cause**: techniczna i procesowa.
4. **Co zmieniłeś/aś systemowo**, żeby to się nie powtórzyło (testy, alerty, review, automatyzacja, guardrails), żeby nikt inny nie mógł popełnić tego błędu.

Nie mów „nigdy nie popełniłem błędu” ani nie zrzucaj winy na innych.`,
  },
  {
    id: 'lead-product',
    category: 'Leadership (senior)',
    difficulty: 2,
    question: 'Product manager chce feature „na wczoraj”, a ty widzisz, że to zrujnuje architekturę. Co robisz?',
    answer: `- Najpierw **zrozum potrzebę biznesową**: jaki problem rozwiązujemy, skąd deadline, co się stanie, jeśli przesuniemy termin.
- Przedstaw **opcje z trade-offami**, a nie samo „nie”:
  - szybka wersja ze świadomym długiem + zaplanowany czas na spłatę (zapisany w backlogu),
  - mniejszy zakres (MVP), który można zrobić dobrze w terminie,
  - pełne rozwiązanie z realnym terminem.
- Mów językiem kosztów i ryzyk biznesowych (awarie, spowolnienie przyszłych feature'ów), nie „czystości kodu”.
- Decyzję podejmujecie razem, a ty dbasz, żeby była świadoma i udokumentowana.

Senior jest partnerem dla biznesu, a nie przeszkodą ani bezkrytycznym wykonawcą.`,
  },
  {
    id: 'lead-legacy',
    category: 'Leadership (senior)',
    difficulty: 2,
    question: 'Dostajesz duży, stary system bez testów i dokumentacji. Od czego zaczynasz?',
    answer: `1. **Zrozum, zanim zmienisz**: rozmowy z ludźmi, którzy go znają, logi, metryki, mapowanie przepływów, które części są krytyczne biznesowo i najczęściej zmieniane.
2. **Siatka bezpieczeństwa**: **characterization tests** (testy, które utrwalają obecne zachowanie, nawet błędne), monitoring, możliwość szybkiego rollbacku.
3. Małe, bezpieczne kroki: refaktoryzacja przy okazji zmian, **seams** (Michael Feathers, „Working Effectively with Legacy Code”), wydzielanie modułów.
4. Dokumentuj na bieżąco (ADR, README, diagramy).
5. Większe przebudowy przez **Strangler Fig**, nie big-bang rewrite. Przepisanie od zera zwykle trwa 3× dłużej i gubi ukrytą wiedzę biznesową zaszytą w kodzie.`,
  },
  {
    id: 'lead-questions-to-ask',
    category: 'Leadership (senior)',
    difficulty: 1,
    question: 'Jakie pytania zadajesz firmie na koniec rozmowy?',
    answer: `Dobre pytania pokazują seniority i pomagają ci ocenić firmę:
- Jak wygląda proces od pomysłu do produkcji? Jak często deployujecie?
- Jak podejmowane są decyzje architektoniczne i kto ma w nich głos?
- Jak radzicie sobie z długiem technicznym? Ile czasu realnie na niego idzie?
- Jak wygląda on-call i jak często są incydenty?
- Jakie największe wyzwanie techniczne ma zespół w najbliższym roku?
- Czego oczekujecie od seniora w pierwszych 3–6 miesiącach? Jak wygląda ścieżka rozwoju (staff, lead)?
- Dlaczego ta rola jest otwarta?

Unikaj pytań, na które odpowiedź jest na pierwszej stronie ich strony www.`,
  },
);
