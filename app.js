
/* ==============================================
   VMZA WARSZAWA — LOGOWANIE NA NAZWĘ UŻYTKOWNIKA
   ============================================== */

function vmzaUsernameEmail(value) {
  const username = String(value || '').trim().toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    throw new Error(
      'Nazwa użytkownika musi mieć 3–30 znaków. ' +
      'Dozwolone: litery a-z, cyfry i podkreślenie.'
    );
  }

  return username + '@example.com';
}

renderAuth = function () {
  if (!sb) {
    authShell(`
      <h1>Brak połączenia</h1>
      <p>Sprawdź ustawienia Supabase w config.js.</p>
    `);
    return;
  }

  const registering = authView === 'register';

  authShell(`
    <h1>
      ${registering ? 'Rejestracja kierowcy' : 'Logowanie'}
    </h1>

    <p class="muted">
      ${registering
        ? 'Utwórz konto. Administrator musi je zatwierdzić.'
        : 'Wpisz nazwę użytkownika i hasło.'}
    </p>

    <form id="auth-form">
      <div class="field">
        <label>Nazwa użytkownika</label>
        <input
          name="username"
          placeholder="np. kierowca123"
          autocomplete="username"
          minlength="3"
          maxlength="30"
          pattern="[a-zA-Z0-9_]+"
          required
        >
      </div>

      <div class="field">
        <label>Hasło</label>
        <input
          name="password"
          type="password"
          placeholder="Hasło"
          minlength="8"
          autocomplete="${registering
            ? 'new-password'
            : 'current-password'}"
          required
        >
      </div>

      ${registering ? `
        <div class="field">
          <label>Powtórz hasło</label>
          <input
            name="confirmPassword"
            type="password"
            placeholder="Powtórz hasło"
            minlength="8"
            autocomplete="new-password"
            required
          >
        </div>
      ` : ''}

      <button class="btn red" style="width:100%">
        ${registering ? 'Utwórz konto' : 'Zaloguj'}
      </button>
    </form>

    <div id="auth-message"></div>

    <div class="actions" style="margin-top:14px">
      <button class="btn small" data-auth="login">
        Logowanie
      </button>

      <button class="btn small" data-auth="register">
        Rejestracja
      </button>
    </div>
  `);

  document.querySelectorAll('[data-auth]').forEach(button => {
    button.onclick = () => {
      authView = button.dataset.auth;
      renderAuth();
    };
  });

  $('auth-form').onsubmit = async event => {
    event.preventDefault();

    const form = new FormData(event.target);
    const username = String(form.get('username')).trim().toLowerCase();
    const password = String(form.get('password') || '');
    const confirmation = String(form.get('confirmPassword') || '');
    const button = event.target.querySelector('button');

    button.disabled = true;

    try {
      const email = vmzaUsernameEmail(username);

      if (registering) {
        if (password !== confirmation) {
          throw new Error('Podane hasła nie są identyczne.');
        }

        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: username,
              username: username
            }
          }
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error(
            'Konto nie zostało automatycznie aktywowane. ' +
            'Wyłącz Confirm email w Supabase.'
          );
        }

        $('auth-message').innerHTML = `
          <div class="notice">
            Konto utworzone. Poczekaj na zatwierdzenie
            przez administratora.
          </div>
        `;

        await start();
      } else {
        const { error } = await sb.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        await start();
      }
    } catch (error) {
      $('auth-message').innerHTML = `
        <p class="error">${esc(error.message)}</p>
      `;
    } finally {
      button.disabled = false;
    }
  };
};

/* Ekran oczekiwania bez adresu e-mail */

renderWaiting = function () {
  authShell(`
    <h1>
      ${profile?.status === 'rejected'
        ? 'Konto odrzucone'
        : 'Oczekiwanie na zatwierdzenie'}
    </h1>

    <p>
      Administrator musi zatwierdzić konto,
      zanim uzyskasz dostęp do portalu.
    </p>

    <p>
      <b>${esc(profile?.full_name || '')}</b>
    </p>

    <div class="actions">
      <button id="check" class="btn red">
        Sprawdź ponownie
      </button>

      <button id="out" class="btn">
        Wyloguj
      </button>
    </div>

    <div id="notice-area"></div>
  `);

  $('check').onclick = refresh;
  $('out').onclick = signOut;
};

/* Lista kierowców bez adresów e-mail */

driverTable = function (drivers) {
  return table(
    [
      'Numer',
      'Nazwa użytkownika',
      'Zajezdnia',
      'Pojazd',
      'Punkty',
      'Status',
      'Akcje'
    ],
    drivers.map(user => `
      <tr>
        <td>
          <b>${esc(user.service_number || '—')}</b>
        </td>

        <td>${esc(user.full_name || '—')}</td>

        <td>${esc(depot(user.depot))}</td>

        <td>${esc(user.vehicle_number || '—')}</td>

        <td><b>${score(user.id)}</b></td>

        <td>${badge(user.status)}</td>

        <td>
          <div class="actions">
            ${user.status === 'pending' ? `
              <button
                class="btn small red"
                data-approve="${user.id}"
              >
                Zatwierdź
              </button>
            ` : ''}

            <button
              class="btn small"
              data-assign="${user.id}"
            >
              Przydział
            </button>

            <button
              class="btn small"
              data-reset="${user.id}"
            >
              Reset hasła
            </button>

            ${user.status === 'active' ? `
              <button
                class="btn small"
                data-reject="${user.id}"
              >
                Zablokuj
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join(''),
    'Brak kierowców'
  );
};

/* Wyszukiwanie kierowców bez adresu e-mail */

driversPage = function () {
  const drivers = state.profiles.filter(user =>
    user.role === 'driver' &&
    [
      user.full_name,
      user.service_number,
      user.vehicle_number,
      user.depot
    ].join(' ').toLowerCase().includes(
      search.drivers.toLowerCase()
    )
  );

  return `
    <h2>Kierowcy i konta</h2>

    <div class="card">
      <h3>Wyszukaj kierowcę</h3>

      <input
        id="driver-search"
        class="search"
        placeholder="Nazwa użytkownika, numer lub pojazd"
        value="${esc(search.drivers)}"
      >

      <div id="driver-table" style="margin-top:15px">
        ${driverTable(drivers)}
      </div>
    </div>

    <div class="notice">
      Reset hasła wymaga wdrożonej funkcji
      Supabase Edge Function admin-reset-password.
    </div>
  `;
};

/* VMZA WARSZAWA — LOGOWANIE NA NAZWĘ UŻYTKOWNIKA */

function vmzaUsernameEmail(value) {
  const username = String(value || '').trim().toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    throw new Error(
      'Nazwa użytkownika: 3–30 znaków, litery a-z, cyfry lub _.'
    );
  }

  return username + '@example.com';
}

renderAuth = function () {
  if (!sb) {
    authShell(
      '<h1>Brak połączenia</h1>' +
      '<p>Sprawdź konfigurację Supabase.</p>'
    );
    return;
  }

  const registering = authView === 'register';

  authShell(`
    <h1>${registering ? 'Rejestracja kierowcy' : 'Logowanie'}</h1>

    <p class="muted">
      ${registering
        ? 'Utwórz konto i poczekaj na zatwierdzenie administratora.'
        : 'Wprowadź nazwę użytkownika i hasło.'}
    </p>

    <form id="auth-form">
      <div class="field">
        <label>Nazwa użytkownika</label>
        <input
          name="username"
          placeholder="np. kierowca123"
          autocomplete="username"
          minlength="3"
          maxlength="30"
          pattern="[a-zA-Z0-9_]+"
          required
        >
      </div>

      <div class="field">
        <label>Hasło</label>
        <input
          name="password"
          type="password"
          minlength="8"
          autocomplete="${registering ? 'new-password' : 'current-password'}"
          required
        >
      </div>

      ${registering ? `
        <div class="field">
          <label>Powtórz hasło</label>
          <input
            name="confirmPassword"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
          >
        </div>
      ` : ''}

      <button class="btn red" style="width:100%">
        ${registering ? 'Utwórz konto' : 'Zaloguj'}
      </button>
    </form>

    <div id="auth-message"></div>

    <div class="actions" style="margin-top:14px">
      <button class="btn small" data-auth="login">
        Logowanie
      </button>
      <button class="btn small" data-auth="register">
        Rejestracja
      </button>
    </div>
  `);

  document.querySelectorAll('[data-auth]').forEach(button => {
    button.onclick = () => {
      authView = button.dataset.auth;
      renderAuth();
    };
  });

  $('auth-form').onsubmit = async event => {
    event.preventDefault();

    const form = new FormData(event.target);
    const username = String(form.get('username')).trim().toLowerCase();
    const password = String(form.get('password') || '');
    const confirmation = String(form.get('confirmPassword') || '');
    const button = event.target.querySelector('button');

    button.disabled = true;

    try {
      const email = vmzaUsernameEmail(username);

      if (registering) {
        if (password !== confirmation) {
          throw new Error('Hasła nie są identyczne.');
        }

        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: username,
              username
            }
          }
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error(
            'Konto wymaga potwierdzenia. Wyłącz Confirm email w Supabase.'
          );
        }

        await start();
      } else {
        const { error } = await sb.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        await start();
      }
    } catch (error) {
      $('auth-message').innerHTML =
        `<p class="error">${esc(error.message)}</p>`;
    } finally {
      button.disabled = false;
    }
  };
};

renderWaiting = function () {
  authShell(`
    <h1>
      ${profile?.status === 'rejected'
        ? 'Konto odrzucone'
        : 'Oczekiwanie na zatwierdzenie'}
    </h1>

    <p>Administrator musi zatwierdzić Twoje konto.</p>
    <p><b>${esc(profile?.full_name || '')}</b></p>

    <div class="actions">
      <button id="check" class="btn red">Sprawdź ponownie</button>
      <button id="out" class="btn">Wyloguj</button>
    </div>

    <div id="notice-area"></div>
  `);

  $('check').onclick = refresh;
  $('out').onclick = signOut;
};

start().catch(e=>{console.error(e);renderAuth()});
