
'use strict';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;',
  '"':'&quot;', "'":'&#39;'
}[x]));

const dstr = x => x
  ? new Date(x).toLocaleString('pl-PL', {
      dateStyle:'short', timeStyle:'short'
    })
  : '—';

const opt = (s,v) => s === v ? 'selected' : '';
const ds = window.VMZA_DATA || {depots:[], downloads:[]};
const cfg = window.VMZA_CONFIG || {};

let sb = null;
let session = null;
let profile = null;
let view = 'dashboard';
let authView = 'login';

let search = {
  drivers:'', reports:'', downloads:'', depot:'all'
};

let state = {
  profiles:[], reports:[], rates:[], messages:[], shifts:[]
};

const configured =
  cfg.url?.startsWith('https://') &&
  cfg.anonKey &&
  !cfg.url.includes('YOUR-PROJECT');

if (configured && window.supabase?.createClient) {
  sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  });
}

const isAdmin = () =>
  profile?.role === 'admin' && profile?.status === 'active';

const driverName = id =>
  state.profiles.find(u => u.id === id)?.full_name ||
  'Nieznany kierowca';

const driverNum = id =>
  state.profiles.find(u => u.id === id)?.service_number || '—';

const depot = id => {
  const d = ds.depots.find(x => x.id === id);
  return d ? `${d.id} „${d.name}” (${d.code})` : 'Nieprzypisana';
};

const score = id =>
  state.reports
    .filter(r => r.driver_id === id)
    .reduce((s,r) => s + Number(r.points || 0), 0);

const table = (headers,rows,empty='Brak danych') => `
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="${headers.length}"
          class="muted">${esc(empty)}</td></tr>`}
      </tbody>
    </table>
  </div>
`;

const badge = v => `
  <span class="pill ${esc(v === 'W trakcie' ? 'W' : v)}">
    ${esc(({pending:'Oczekuje',active:'Aktywne',
      rejected:'Odrzucone'})[v] || v)}
  </span>
`;

function notify(msg,bad=false) {
  const n = $('notice-area');
  if (n) {
    n.innerHTML = `<div class="notice ${bad?'error':'ok'}">
      ${esc(msg)}</div>`;
  } else {
    alert(msg);
  }
}

function failure(err) {
  notify(err?.message || String(err),true);
}

async function query(tableName) {
  let q = sb.from(tableName).select('*');
  if (tableName === 'reports' || tableName === 'messages')
    q = q.order('created_at',{ascending:false}).limit(500);
  if (tableName === 'shifts')
    q = q.order('shift_date',{ascending:true}).limit(500);
  const {data,error} = await q;
  if (error) throw error;
  return data || [];
}

async function reload() {
  if (!session) {
    profile = null;
    renderAuth();
    return;
  }

  const {data,error} = await sb.from('profiles')
    .select('*').eq('id',session.user.id).single();

  if (error) throw error;
  profile = data;

  if (profile.status !== 'active') {
    renderWaiting();
    return;
  }

  const [p,r,m,s,rt] = await Promise.all([
    query('profiles'),
    query('reports'),
    query('messages'),
    query('shifts'),
    query('point_rates')
  ]);

  state = {
    profiles:p, reports:r, messages:m, shifts:s, rates:rt
  };

  render();
}

async function refresh() {
  try { await reload(); }
  catch(e) { failure(e); }
}

function loading() {
  $('app').innerHTML =
    '<div class="loading">Ładowanie danych z Supabase…</div>';
}

function authShell(body) {
  $('app').innerHTML = `
    <div class="banner"></div>
    <div class="auth-wrap">
      <div class="card">
        <div class="tag">
          VMZA WARSZAWA · PORTAL PRACOWNICZY
        </div>
        ${body}
      </div>
      <p class="muted">
        Nowe konta wymagają zatwierdzenia administratora.
      </p>
    </div>
  `;
}

function vmzaUsernameEmail(value) {
  const username = String(value || '').trim().toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    throw new Error(
      'Nazwa użytkownika: 3–30 znaków (a-z, 0-9, _).'
    );
  }

  return username + '@example.com';
}

function renderAuth() {
  if (!sb) {
    authShell('<h1>Sprawdź konfigurację Supabase</h1>');
    return;
  }

  const reg = authView === 'register';

  authShell(`
    <h1>${reg ? 'Rejestracja kierowcy' : 'Logowanie'}</h1>
    <p class="muted">
      ${reg ? 'Konto wymaga zatwierdzenia administratora.'
        : 'Wprowadź nazwę użytkownika i hasło.'}
    </p>
    <form id="auth-form">
      <div class="field">
        <label>Nazwa użytkownika</label>
        <input name="username" required minlength="3"
          maxlength="30" pattern="[a-zA-Z0-9_]+"
          autocomplete="username">
      </div>
      <div class="field">
        <label>Hasło</label>
        <input name="password" type="password"
          required minlength="8">
      </div>
      ${reg ? `
        <div class="field">
          <label>Powtórz hasło</label>
          <input name="confirmPassword" type="password"
            required minlength="8">
        </div>
      ` : ''}
      <button class="btn red" style="width:100%">
        ${reg ? 'Utwórz konto' : 'Zaloguj'}
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

  document.querySelectorAll('[data-auth]').forEach(b => {
    b.onclick = () => {
      authView = b.dataset.auth;
      renderAuth();
    };
  });

  $('auth-form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const username = String(f.get('username') || '')
      .trim().toLowerCase();
    const password = String(f.get('password') || '');
    const button = e.target.querySelector('button');
    button.disabled = true;

    try {
      const email = vmzaUsernameEmail(username);

      if (reg) {
        if (password !== String(f.get('confirmPassword') || ''))
          throw new Error('Hasła nie są identyczne.');

        const {data,error} = await sb.auth.signUp({
          email, password,
          options:{data:{full_name:username,username}}
        });

        if (error) throw error;
        if (!data.session)
          throw new Error(
            'Wyłącz Confirm email w ustawieniach Supabase.'
          );
        await start();
      } else {
        const {error} = await sb.auth.signInWithPassword({
          email,password
        });
        if (error) throw error;
        await start();
      }
    } catch(err) {
      $('auth-message').innerHTML =
        `<p class="error">${esc(err.message)}</p>`;
    } finally {
      button.disabled = false;
    }
  };
}

function renderWaiting() {
  authShell(`
    <h1>Twoje konto: ${esc(
      profile?.status === 'rejected' ? 'odrzucone' : 'oczekujące'
    )}</h1>
    <p>Administrator musi zatwierdzić konto.</p>
    <p><b>${esc(profile?.full_name || '')}</b></p>
    <div class="actions">
      <button id="check" class="btn red">Sprawdź ponownie</button>
      <button id="out" class="btn">Wyloguj</button>
    </div>
    <div id="notice-area"></div>
  `);
  $('check').onclick = refresh;
  $('out').onclick = signOut;
}

function renderForcedPassword() {
  authShell(`
    <h1>Ustaw nowe hasło</h1>
    <p>Administrator zresetował Twoje hasło.</p>
    <form id="password-form">
      <div class="field">
        <label>Nowe hasło (minimum 12 znaków)</label>
        <input name="password" type="password"
          minlength="12" required autocomplete="new-password">
      </div>
      <button class="btn red">Zmień hasło</button>
    </form>
    <div id="auth-message"></div>
    <button class="btn" id="out">Wyloguj</button>
  `);
  $('out').onclick = signOut;
  $('password-form').onsubmit = async e => {
    e.preventDefault();
    const password = String(new FormData(e.target).get('password'));
    try {
      const {error} = await sb.auth.updateUser({password});
      if (error) throw error;
      const {error:clearError} = await sb.rpc('vmza_password_changed');
      if (clearError) throw clearError;
      await reload();
    } catch(err) {
      $('auth-message').textContent = err.message;
    }
  };
}

function render() {
  if (profile.must_change_password) {
    renderForcedPassword();
    return;
  }

  const labels = {
    dashboard:'Pulpit',
    drivers:'Kierowcy',
    dispatch:'Dyspozytornia',
    schedule:'Grafik',
    reports:'Raporty i punkty',
    downloads:'Pobieralnia'
  };

  if (!isAdmin() && view === 'drivers') view = 'dashboard';
  const keys = Object.keys(labels).filter(k => isAdmin() || k !== 'drivers');

  $('app').innerHTML = `
    <div class="shell">
      <aside class="aside" id="aside">
        <div>
          <h2>VMZA <span style="color:#ff6c81">Warszawa</span></h2>
          <small>Portal pracowniczy</small>
        </div>
        <nav class="nav">
          ${keys.map(k => `
            <button data-view="${k}"
              class="${view === k ? 'active' : ''}">
              ${labels[k]}
            </button>
          `).join('')}
        </nav>
        <div class="bottom">
          <p>
            <b>${esc(profile.full_name)}</b><br>
            ${isAdmin() ? 'Administrator' :
              'Nr służbowy: ' + esc(profile.service_number || 'brak')}
          </p>
          <button class="btn small" id="logout">Wyloguj</button>
        </div>
      </aside>
      <main class="main">
        <header class="top">
          <div class="actions">
            <button class="btn mobile-menu" id="menu">☰</button>
            <strong>${labels[view]}</strong>
          </div>
          <div class="actions">
            <span class="pill">${isAdmin() ? 'ADMIN' : 'KIEROWCA'}</span>
            <button class="btn small" id="sync">Odśwież</button>
          </div>
        </header>
        <div class="content">
          <div id="notice-area"></div>
          ${({
            dashboard:dashboardPage,
            drivers:driversPage,
            dispatch:dispatchPage,
            schedule:schedulePage,
            reports:reportsPage,
            downloads:downloadsPage
          })[view]()}
          <p class="footer">
            VMZA Warszawa · System współdzielony przez Supabase
          </p>
        </div>
      </main>
    </div>
  `;

  document.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => {
      view = b.dataset.view;
      render();
    };
  });
  $('logout').onclick = signOut;
  $('sync').onclick = refresh;
  $('menu')?.addEventListener('click', () =>
    $('aside').classList.toggle('open')
  );
  wire();
}

function dashboardPage() {
  const drivers = state.profiles.filter(p => p.role === 'driver');
  const reports = state.reports;
  const own = state.shifts.filter(s =>
    s.shift_date >= new Date().toISOString().slice(0,10)
  ).slice(0,5);

  const stats = isAdmin()
    ? [
        ['Aktywni kierowcy',
          drivers.filter(d => d.status === 'active').length],
        ['Do zatwierdzenia',
          drivers.filter(d => d.status === 'pending').length],
        ['Raporty', reports.length],
        ['Punkty łącznie',
          reports.reduce((s,r) => s + Number(r.points || 0),0)]
      ]
    : [
        ['Numer służbowy',profile.service_number || 'Brak'],
        ['Stały pojazd',profile.vehicle_number || 'Brak'],
        ['Moje punkty',score(profile.id)],
        ['Moje raporty',reports.length]
      ];

  return `
    <div class="subhead">
      <div>
        <h2>Dzień dobry, ${esc(profile.full_name.split(' ')[0])}</h2>
        <small>Aktualne informacje VMZA Warszawa</small>
      </div>
    </div>
    <div class="stats">
      ${stats.map(x => `
        <div class="stat">
          <span>${esc(x[0])}</span>
          <strong>${esc(x[1])}</strong>
        </div>
      `).join('')}
    </div>
    <div class="grid">
      <div class="card">
        <h3>${isAdmin() ? 'Ostatnie raporty' : 'Mój przydział'}</h3>
        ${isAdmin()
          ? reports.slice(0,5).map(r => `
              <div class="line">
                <b>${esc(r.category)}</b> ·
                ${esc(driverName(r.driver_id))}
                <small>+${esc(r.points)} pkt</small>
              </div>
            `).join('') || 'Brak raportów'
          : `
              <div class="line">
                Numer służbowy:
                <b>${esc(profile.service_number || 'Nieprzydzielony')}</b>
              </div>
              <div class="line">
                Pojazd:
                <b>${esc(profile.vehicle_number || 'Nieprzydzielony')}</b>
              </div>
              <div class="line">
                Zajezdnia:
                <b>${esc(depot(profile.depot))}</b>
              </div>
            `}
      </div>
      <div class="card">
        <h3>Najbliższe służby</h3>
        ${own.map(s => `
          <div class="line">
            <b>${esc(s.shift_date)}</b> ·
            ${esc(driverName(s.driver_id))}<br>
            <small>Linia ${esc(s.line)} ·
              ${esc(s.start_time.slice(0,5))}–
              ${esc(s.end_time.slice(0,5))}
            </small>
          </div>
        `).join('') || 'Brak wpisów w grafiku'}
      </div>
    </div>
    <div class="card">
      <h3>Najnowsze wiadomości</h3>
      ${state.messages.slice(0,4).map(m => `
        <div class="message">
          <b>${esc(m.subject)}</b>
          <small>${dstr(m.created_at)}</small>
          <p class="textbody">${esc(m.body)}</p>
        </div>
      `).join('') || 'Brak wiadomości'}
    </div>
  `;
}

function driversPage() {
  const p = state.profiles.filter(u =>
    u.role === 'driver' &&
    [u.full_name,u.service_number,u.vehicle_number,u.depot]
      .join(' ').toLowerCase().includes(search.drivers.toLowerCase())
  );

  return `
    <h2>Kierowcy i konta</h2>
    <div class="card">
      <h3>Wyszukaj kierowcę</h3>
      <input id="driver-search" class="search"
        placeholder="Numer służbowy, nazwa, pojazd"
        value="${esc(search.drivers)}">
      <div id="driver-table" style="margin-top:15px">
        ${driverTable(p)}
      </div>
    </div>
    <div class="notice">
      Reset hasła wymaga wdrożonej funkcji Supabase
      admin-reset-password.
    </div>
  `;
}

function driverTable(p) {
  return table(
    ['Numer','Kierowca','Zajezdnia','Pojazd',
     'Punkty','Status','Akcje'],
    p.map(u => `
      <tr>
        <td><b>${esc(u.service_number || '—')}</b></td>
        <td>${esc(u.full_name)}</td>
        <td>${esc(depot(u.depot))}</td>
        <td>${esc(u.vehicle_number || '—')}</td>
        <td><b>${score(u.id)}</b></td>
        <td>${badge(u.status)}</td>
        <td>
          <div class="actions">
            ${u.status === 'pending' ? `
              <button class="btn small red"
                data-approve="${u.id}">Zatwierdź</button>
            ` : ''}
            <button class="btn small"
              data-assign="${u.id}">Przydział</button>
            <button class="btn small"
              data-reset="${u.id}">Reset hasła</button>
            ${u.status === 'active' ? `
              <button class="btn small"
                data-reject="${u.id}">Zablokuj</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join(''),
    'Brak kierowców'
  );
}

function dispatchPage() {
  return `
    <h2>Dyspozytornia</h2>
    ${isAdmin() ? `
      <div class="card">
        <h3>Wyślij komunikat</h3>
        <form id="message-form">
          <div class="field">
            <label>Adresat</label>
            <select name="recipient">
              <option value="">Wszyscy aktywni kierowcy</option>
              ${state.profiles.filter(u =>
                u.role === 'driver' && u.status === 'active'
              ).map(u => `
                <option value="${u.id}">
                  ${esc(u.service_number || '—')} –
                  ${esc(u.full_name)}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="field">
            <label>Temat</label>
            <input name="subject" required maxlength="150">
          </div>
          <div class="field">
            <label>Treść</label>
            <textarea name="body" maxlength="3000" required></textarea>
          </div>
          <button class="btn red">Wyślij wiadomość</button>
        </form>
      </div>
    ` : ''}
    <div class="card">
      <h3>Wiadomości</h3>
      ${state.messages.map(m => `
        <div class="message">
          <b>${esc(m.subject)}</b> ·
          <small>
            ${m.recipient_id
              ? 'Do: ' + esc(driverName(m.recipient_id))
              : 'Do wszystkich'} ·
            ${dstr(m.created_at)}
          </small>
          <p class="textbody">${esc(m.body)}</p>
        </div>
      `).join('') || 'Brak komunikatów'}
    </div>
  `;
}

function schedulePage() {
  return `
    <h2>Grafik kierowców</h2>
    ${isAdmin() ? `
      <div class="card">
        <h3>Zaplanuj służbę</h3>
        <form id="shift-form">
          <div class="grid">
            <div class="field">
              <label>Kierowca</label>
              <select name="driver_id" required>
                ${state.profiles.filter(u =>
                  u.role === 'driver' && u.status === 'active'
                ).map(u => `
                  <option value="${u.id}">
                    ${esc(u.service_number || '—')} ·
                    ${esc(u.full_name)}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="field">
              <label>Data</label>
              <input name="shift_date" type="date" required>
            </div>
            <div class="field">
              <label>Linia</label>
              <input name="line" maxlength="40" required>
            </div>
            <div class="field">
              <label>Pojazd</label>
              <input name="vehicle_number" maxlength="30">
            </div>
            <div class="field">
              <label>Od</label>
              <input name="start_time" type="time" required>
            </div>
            <div class="field">
              <label>Do</label>
              <input name="end_time" type="time" required>
            </div>
          </div>
          <button class="btn red">Dodaj służbę</button>
        </form>
      </div>
    ` : ''}
    <div class="card">
      ${table(
        ['Dzień','Kierowca','Linia','Godziny','Pojazd','Akcje'],
        state.shifts.map(s => `
          <tr>
            <td>${esc(s.shift_date)}</td>
            <td>${esc(driverNum(s.driver_id))} ·
                ${esc(driverName(s.driver_id))}</td>
            <td>${esc(s.line)}</td>
            <td>${esc(s.start_time.slice(0,5))}–
                ${esc(s.end_time.slice(0,5))}</td>
            <td>${esc(s.vehicle_number || '—')}</td>
            <td>${isAdmin() ? `
              <button class="btn small"
                data-delshift="${s.id}">Usuń</button>
            ` : '—'}</td>
          </tr>
        `).join(''),
        'Brak służb'
      )}
    </div>
  `;
}

function reportsPage() {
  const rows = state.reports.filter(r =>
    [r.category,r.description,r.vehicle_number,
     driverNum(r.driver_id),driverName(r.driver_id)]
      .join(' ').toLowerCase().includes(search.reports.toLowerCase())
  );

  return `
    <h2>Raporty i punkty</h2>
    <div class="stats">
      <div class="stat">
        <span>Raporty</span>
        <strong>${state.reports.length}</strong>
      </div>
      <div class="stat">
        <span>Nowe</span>
        <strong>${state.reports.filter(r =>
          r.status === 'Nowy').length}</strong>
      </div>
      <div class="stat">
        <span>W trakcie</span>
        <strong>${state.reports.filter(r =>
          r.status === 'W trakcie').length}</strong>
      </div>
      <div class="stat">
        <span>${isAdmin() ? 'Punkty razem' : 'Moje punkty'}</span>
        <strong>${isAdmin()
          ? state.reports.reduce((s,r) =>
              s + Number(r.points || 0),0)
          : score(profile.id)}</strong>
      </div>
    </div>
    ${isAdmin() ? `
      <div class="card">
        <h3>Stawki punktowe</h3>
        <form id="rates-form">
          <div class="grid">
            ${state.rates.map(r => `
              <div class="field">
                <label>${esc(r.category)}</label>
                <input name="${esc(r.category)}" type="number"
                  min="0" max="100" value="${r.points}" required>
              </div>
            `).join('')}
          </div>
          <button class="btn red">Zapisz stawki</button>
        </form>
      </div>
    ` : `
      <div class="card">
        <h3>Wyślij raport</h3>
        <form id="report-form">
          <div class="grid">
            <div class="field">
              <label>Rodzaj zgłoszenia</label>
              <select name="category">
                ${state.rates.map(r => `
                  <option value="${esc(r.category)}">
                    ${esc(r.category)} (+${r.points} pkt)
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="field">
              <label>Numer pojazdu</label>
              <input name="vehicle_number"
                value="${esc(profile.vehicle_number || '')}"
                maxlength="30">
            </div>
          </div>
          <div class="field">
            <label>Opis</label>
            <textarea name="description"
              minlength="8" maxlength="3000" required></textarea>
          </div>
          <p class="muted">
            Punkty nalicza baza danych automatycznie.
          </p>
          <button class="btn red">Wyślij raport</button>
        </form>
      </div>
    `}
    <div class="card">
      <div class="subhead">
        <h3>Historia zgłoszeń</h3>
        <input class="search" id="report-search"
          style="max-width:320px"
          value="${esc(search.reports)}"
          placeholder="Szukaj numeru służbowego / opisu">
      </div>
      <div id="reports-table">${reportTable(rows)}</div>
    </div>
  `;
}

function reportTable(rows) {
  return table(
    ['Data','Numer / kierowca','Zgłoszenie',
     'Pojazd','Punkty','Status / odpowiedź'],
    rows.map(r => `
      <tr>
        <td>${dstr(r.created_at)}</td>
        <td><b>${esc(driverNum(r.driver_id))}</b><br>
          ${esc(driverName(r.driver_id))}</td>
        <td><b>${esc(r.category)}</b>
          <div class="textbody">${esc(r.description)}</div></td>
        <td>${esc(r.vehicle_number || '—')}</td>
        <td><b>+${esc(r.points)}</b></td>
        <td>
          ${isAdmin() ? `
            <select data-reportstatus="${r.id}" class="search">
              <option ${opt(r.status,'Nowy')}>Nowy</option>
              <option ${opt(r.status,'W trakcie')}>W trakcie</option>
              <option ${opt(r.status,'Zamknięty')}>Zamknięty</option>
            </select>
            <button class="btn small"
              data-answer="${r.id}">Odpowiedz</button>
          ` : badge(r.status)}
          ${r.response ? `
            <div class="notice textbody">
              ${esc(r.response)}
            </div>
          ` : ''}
        </td>
      </tr>
    `).join(''),
    'Brak raportów'
  );
}

function downloadsPage() {
  const entries = ds.downloads.filter(x =>
    (search.depot === 'all' || x[0] === search.depot) &&
    x.slice(0,2).join(' ').toLowerCase()
      .includes(search.downloads.toLowerCase())
  );

  return `
    <h2>Pobieralnia VMZA</h2>
    <div class="card">
      <div class="findbar">
        <input class="search" id="dl-search"
          placeholder="Szukaj pojazdu, mapy lub dodatku"
          value="${esc(search.downloads)}">
        <select class="search" id="dl-depot">
          <option value="all">Wszystkie kategorie</option>
          <option value="MAP" ${opt(search.depot,'MAP')}>Mapy</option>
          <option value="EXTRA" ${opt(search.depot,'EXTRA')}>
            Dodatki i pliki
          </option>
          ${ds.depots.map(d => `
            <option value="${d.id}" ${opt(search.depot,d.id)}>
              ${esc(depot(d.id))}
            </option>
          `).join('')}
        </select>
      </div>
      <div id="dl-list" class="downloads">
        ${dlCards(entries)}
      </div>
    </div>
    <div class="notice">
      Pojazdy 4200, 4207, 4211, 4218 tymczasowo przeniesione
      z R-2 Kleszczowa do R-1 Woronicza.
    </div>
    <small>
      Linki prowadzą do zewnętrznych zasobów i mogą wymagać logowania.
    </small>
  `;
}

function dlCards(entries) {
  return entries.map(x => `
    <div class="dl">
      <div>
        <b>${x[0] === 'MAP' ? 'Mapa – linie ' :
          x[0] === 'EXTRA' ? '' : 'Seria '}${esc(x[1])}</b><br>
        <small>${x[0] === 'MAP' ? 'Mapy' :
          x[0] === 'EXTRA' ? 'Dodatki i pliki' :
          esc(depot(x[0]))}</small>
      </div>
      <a class="btn red small" href="${esc(x[2])}"
        rel="noopener noreferrer" target="_blank">
        Otwórz ↗
      </a>
    </div>
  `).join('') || 'Brak wyników';
}

function wire() {
  if (view === 'drivers') {
    const update = () => {
      $('driver-table').innerHTML = driverTable(
        state.profiles.filter(u =>
          u.role === 'driver' &&
          [u.full_name,u.service_number,u.vehicle_number,u.depot]
            .join(' ').toLowerCase()
            .includes(search.drivers.toLowerCase())
        )
      );
      bindDriverButtons();
    };
    $('driver-search').oninput = e => {
      search.drivers = e.target.value;
      update();
    };
    bindDriverButtons();
  }

  if (view === 'dispatch' && isAdmin()) {
    $('message-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const {error} = await sb.from('messages').insert({
          recipient_id:f.get('recipient') || null,
          subject:String(f.get('subject')).trim(),
          body:String(f.get('body')).trim()
        });
        if (error) throw error;
        await reload();
        notify('Komunikat wysłano.');
      } catch(err) { failure(err); }
    };
  }

  if (view === 'schedule' && isAdmin()) {
    $('shift-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const {error} = await sb.from('shifts').insert({
          driver_id:f.get('driver_id'),
          shift_date:f.get('shift_date'),
          line:String(f.get('line')),
          vehicle_number:String(f.get('vehicle_number')),
          start_time:f.get('start_time'),
          end_time:f.get('end_time')
        });
        if (error) throw error;
        await reload();
        notify('Służba dodana.');
      } catch(err) { failure(err); }
    };

    document.querySelectorAll('[data-delshift]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('Usunąć tę służbę?')) return;
        try {
          const {error} = await sb.from('shifts')
            .delete().eq('id',b.dataset.delshift);
          if (error) throw error;
          await reload();
        } catch(err) { failure(err); }
      };
    });
  }

  if (view === 'reports') {
    $('report-search').oninput = e => {
      search.reports = e.target.value;
      $('reports-table').innerHTML = reportTable(
        state.reports.filter(r =>
          [r.category,r.description,r.vehicle_number,
           driverNum(r.driver_id),driverName(r.driver_id)]
            .join(' ').toLowerCase()
            .includes(search.reports.toLowerCase())
        )
      );
      bindReportButtons();
    };

    if (isAdmin()) {
      $('rates-form').onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        try {
          for (const r of state.rates) {
            const {error} = await sb.from('point_rates')
              .update({points:Number(f.get(r.category))})
              .eq('category',r.category);
            if (error) throw error;
          }
          await reload();
          notify('Stawki zapisane.');
        } catch(err) { failure(err); }
      };
      bindReportButtons();
    } else {
      $('report-form').onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        try {
          const {error} = await sb.from('reports').insert({
            driver_id:profile.id,
            category:f.get('category'),
            description:String(f.get('description')).trim(),
            vehicle_number:String(f.get('vehicle_number')).trim()
          });
          if (error) throw error;
          await reload();
          notify('Raport przesłany, punkty naliczone.');
        } catch(err) { failure(err); }
      };
    }
  }

  if (view === 'downloads') {
    $('dl-search').oninput = e => {
      search.downloads = e.target.value;
      filterDl();
    };
    $('dl-depot').onchange = e => {
      search.depot = e.target.value;
      filterDl();
    };
  }
}

function filterDl() {
  $('dl-list').innerHTML = dlCards(
    ds.downloads.filter(x =>
      (search.depot === 'all' || x[0] === search.depot) &&
      x.slice(0,2).join(' ').toLowerCase()
        .includes(search.downloads.toLowerCase())
    )
  );
}

function bindReportButtons() {
  document.querySelectorAll('[data-reportstatus]').forEach(b => {
    b.onchange = async () => {
      try {
        const {error} = await sb.from('reports')
          .update({status:b.value})
          .eq('id',b.dataset.reportstatus);
        if (error) throw error;
        await reload();
      } catch(err) { failure(err); }
    };
  });

  document.querySelectorAll('[data-answer]').forEach(b => {
    b.onclick = async () => {
      const r = state.reports.find(x => x.id === b.dataset.answer);
      const response = prompt('Odpowiedź dla kierowcy',r?.response || '');
      if (response === null) return;
      try {
        const {error} = await sb.from('reports')
          .update({response:response.slice(0,3000)})
          .eq('id',b.dataset.answer);
        if (error) throw error;
        await reload();
      } catch(err) { failure(err); }
    };
  });
}

function bindDriverButtons() {
  document.querySelectorAll('[data-approve]').forEach(b => {
    b.onclick = () =>
      changeProfile(b.dataset.approve,{status:'active'});
  });

  document.querySelectorAll('[data-reject]').forEach(b => {
    b.onclick = () => {
      if (confirm('Zablokować konto?'))
        changeProfile(b.dataset.reject,{status:'rejected'});
    };
  });

  document.querySelectorAll('[data-assign]').forEach(b => {
    b.onclick = async () => {
      const u = state.profiles.find(x => x.id === b.dataset.assign);
      if (!u) return;

      const service = prompt(
        'Numer służbowy (same cyfry):',
        u.service_number || ''
      );
      if (service === null) return;

      if (service && !/^\d{2,10}$/.test(service)) {
        notify('Numer służbowy: 2–10 cyfr',true);
        return;
      }

      const vehicle = prompt(
        'Stały pojazd (numer taborowy):',
        u.vehicle_number || ''
      );
      if (vehicle === null) return;

      const d = prompt(
        'Zajezdnia: R-1, R-2, R-3, R-4:',
        u.depot || 'R-1'
      );
      if (d === null) return;

      if (d && !ds.depots.find(x =>
        x.id === d.toUpperCase()
      )) {
        notify('Nieznana zajezdnia',true);
        return;
      }

      await changeProfile(u.id,{
        service_number:service || null,
        vehicle_number:vehicle.trim() || null,
        depot:d.toUpperCase() || null
      });
    };
  });

  document.querySelectorAll('[data-reset]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Wygenerować nowe hasło tymczasowe?')) return;
      try {
        const {data,error} = await sb.functions.invoke(
          'admin-reset-password',
          {body:{userId:b.dataset.reset}}
        );
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!data?.temporaryPassword)
          throw new Error('Nie otrzymano hasła tymczasowego.');

        alert(
          'HASŁO TYMCZASOWE:\n\n' +
          data.temporaryPassword +
          '\n\nPrzekaż kierowcy bezpiecznie.'
        );
      } catch(err) {
        failure(new Error(
          'Nie udało się zresetować hasła. ' +
          (err.message || '')
        ));
      }
    };
  });
}

async function changeProfile(id,patch) {
  try {
    const {error} = await sb.from('profiles')
      .update(patch).eq('id',id);
    if (error) throw error;
    await reload();
    notify('Zapisano zmiany.');
  } catch(err) { failure(err); }
}

async function signOut() {
  await sb.auth.signOut();
  session = null;
  profile = null;
  authView = 'login';
  renderAuth();
}

async function start() {
  if (!sb) {
    renderAuth();
    return;
  }

  const {data:{session:current},error} =
    await sb.auth.getSession();

  if (error) throw error;
  session = current;

  if (!session) {
    renderAuth();
    return;
  }

  loading();

  try {
    await reload();
  } catch(err) {
    authShell(`
      <h1>Błąd połączenia</h1>
      <p class="error">${esc(err.message)}</p>
      <button class="btn" id="retry">
        Spróbuj ponownie
      </button>
      <button class="btn" id="out">
        Wyloguj
      </button>
    `);
    $('retry').onclick = start;
    $('out').onclick = signOut;
  }
}

start().catch(err => {
  console.error(err);
  authShell(`
    <h1>Błąd uruchamiania</h1>
    <p class="error">${esc(err.message)}</p>
    <button class="btn" id="retry">Spróbuj ponownie</button>
  `);
  $('retry').onclick = start;
});
