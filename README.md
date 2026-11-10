# VMZA Warszawa — GitHub Pages + Supabase

Portal pracowniczy dla fikcyjnego projektu VMZA Warszawa. Kod źródłowy i interfejs są statyczne (GitHub Pages), natomiast konta, raporty, punkty, grafiki, komunikaty i przydziały przechowywane są w Supabase PostgreSQL. Supabase Auth zarządza hasłami i sesjami. Po wdrożeniu dane synchronizują się między komputerami po naciśnięciu **Odśwież** (nie ma jeszcze subskrypcji realtime).

## Pierwsze uruchomienie

1. Utwórz projekt na https://supabase.com/dashboard . W **SQL Editor** uruchom całe `supabase/schema.sql` w NOWYM projekcie. Skrypt nie jest migracją przeznaczoną do wielokrotnego uruchamiania w istniejącej bazie.
2. W **Project Settings / API Keys** znajdź **Project URL** i **publishable key** (albo starszy `anon` public key). Wpisz je do `config.js` — tylko te DWIE publiczne wartości. **Nigdy nie wpisuj klucza `service_role`, `secret`, hasła bazy ani hasła administratora do repozytorium.**
3. W Supabase **Authentication → URL Configuration** ustaw **Site URL** na adres GitHub Pages Twojego repozytorium, np. `https://twoj-login.github.io/vmza/`. W **Redirect URLs** dodaj ten sam adres (ukośnik na końcu według użytego adresu). W **Authentication → Providers → Email** włącz email/password i potwierdzanie emaila, jeśli będzie używane.
4. Na https://github.com utwórz repozytorium, np. `vmza`. Prześlij **zawartość tego folderu** (`index.html`, `app.js`, `styles.css`, `downloads.js`, `config.js`, folder `assets`). Możesz dodać README i katalog `supabase`, ale NIE dodawaj prawdziwych kluczy tajnych. W **Settings → Pages → Build and deployment** ustaw **Deploy from branch → main → /(root)**. Poczekaj na publikację adresu `https://twoj-login.github.io/vmza/`.
5. Otwórz stronę, zarejestruj SIEBIE swoim adresem email i potwierdź wiadomość email. Domyślnie każde nowe konto jest kierowcą ze statusem `pending`.
6. W Supabase **SQL Editor** uruchom poniższe polecenie z WŁASNYM email. To jedyny ręczny etap nadawania pierwszej roli administratora:

```sql
update public.profiles set role='admin', status='active'
where email='TWOJ-EMAIL@example.com';
```

7. Wyloguj się i zaloguj ponownie. W panelu **Kierowcy** zobaczysz nowe konta; zatwierdzaj je i ustawiaj numer służbowy / pojazd / zajezdnię. Kierowca może zalogować się z drugiego urządzenia, a administrator zobaczy wysłany raport po kliknięciu **Odśwież**.

## Resetowanie haseł przez administratora (dodatkowy etap)

Zwykłe GitHub Pages NIE może bezpiecznie posiadać klucza `service_role`. Do resetowania cudzych haseł dołączona jest odrębna funkcja serwerowa: `supabase/functions/admin-reset-password/index.ts`. Aby ją włączyć:

1. Zainstaluj Supabase CLI według https://supabase.com/docs/guides/local-development/cli/getting-started i zaloguj się w CLI.
2. W katalogu projektu: `supabase link --project-ref TWOJ_PROJECT_REF`.
3. Skonfiguruj sekret `VMZA_ALLOWED_ORIGIN` z dokładnym origin witryny, np. `https://twoj-login.github.io` (bez ścieżki `/vmza/`):
   `supabase secrets set VMZA_ALLOWED_ORIGIN=https://twoj-login.github.io`
4. Opublikuj funkcję: `supabase functions deploy admin-reset-password` — zachowaj wymaganą weryfikację tokena. W projekcie powinny być dostępne serwerowe `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` dostarczane przez platformę; nie dodawaj ich do repozytorium. W środowiskach z innym sposobem zarządzania kluczami skonfiguruj je w sekcji sekretów funkcji.
5. Przycisk **Reset hasła** wysyła żądanie z sesją zalogowanego administratora, funkcja weryfikuje rolę po stronie serwera i generuje losowe hasło tymczasowe. Jest ono pokazywane administratorowi jednokrotnie. Kierowca zostanie poproszony o jego zmianę po zalogowaniu. Bez wdrożonej Edge Function przycisk resetowania nie działa — pozostaje odzyskiwanie hasła przez email w Supabase Auth.

**Ważne:** funkcja serwerowa musi mieć poprawnie skonfigurowane uprawnienia i wymaga testu przed użyciem produkcyjnym. Nie przesyłaj haseł przez publiczne kanały.

## Bezpieczeństwo i ograniczenia

- `schema.sql` włącza RLS dla wszystkich tabel. Kierowca odczytuje tylko własne raporty, grafiki i wiadomości skierowane do niego lub do wszystkich. Tylko aktywny admin zmienia przydziały, konta i stawki. Punkty za nowe zgłoszenie wylicza baza danych, a nie JavaScript.
- Korzystaj z adresu HTTPS i używaj bezpiecznych haseł. Zabezpiecz konto administratora MFA, jeśli jest dostępne w konfiguracji Auth. Przed wdrożeniem na potrzeby rzeczywistej organizacji przeprowadź testy uprawnień, polityk, kopii zapasowych i odzyskiwania kont. Interfejs jest prototypem, nie ma audytu bezpieczeństwa.
- RLS nie blokuje nadmiernej liczby żądań, spamu i prób rejestracji. Włącz ochronę antybotową/captcha i limity dostępu odpowiednie do ruchu. Supabase email ma ograniczenia; do większej liczby kierowców skonfiguruj własny SMTP.
- Widoczne dla admina są adresy email kierowców — poinformuj o zasadach przetwarzania danych. Pobieralnia wskazuje na pliki zewnętrznych dostawców; ich treść, status i prawa do udostępniania nie zostały sprawdzone.
- Rejestracja używa email, nie pseudonimu/loginu. Po uruchomieniu strony na GitHub **baza danych nie jest lokalna**. Odśwież listy po zmianach z innego komputera.
- Ocena punktowa jest automatyczna przy wysyłaniu zgłoszenia. Na produkcji warto ustalić politykę antyspamową i zasady punktowania.

## Struktura

- `index.html`, `app.js`, `styles.css` — portal dla kierowców i administratora
- `assets/banner.png` — przesłany baner
- `downloads.js` — 22 linki do pojazdów przypisanych do zajezdni
- `config.js` — PUBLICZNY adres i klucz klienta Supabase (bez sekretów)
- `supabase/schema.sql` — tabela, trigery i zabezpieczenia RLS
- `supabase/functions/admin-reset-password/index.ts` — funkcja resetowania hasła admina


### Pobieralnia – aktualizacja
Dodano 8 pakietów map i 3 pozycje dodatków (baza obiektów, tablice, plik do linii/brygad/rozkładów). Wszystkie linki są odnośnikami do zewnętrznych zasobów dostarczonymi przez użytkownika. Zawartość i dostępność linków nie były weryfikowane. W celu aktualizacji GitHub Pages podmień pliki `downloads.js`, `app.js` i ewentualnie `README.md`.
