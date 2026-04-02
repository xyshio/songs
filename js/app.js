/**
 * Śpiewnik / Zbiór tekstów
 * Dane trzymane lokalnie w localStorage.
 * Brak backendu, brak PHP, działa na zwykłym HTTP i lokalnie.
 */

const STORAGE_KEY = 'songs_library_data';
const DATA_FILE_PATH = 'data/songs.json';

let dataReadyPromise = null;

function isAdminMode() {
  return localStorage.getItem('mode') === 'admin';
}

function storageLoad() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function storageSave(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function fetchDataFile() {
  return fetch(DATA_FILE_PATH, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Nie udało się wczytać pliku danych.');
      }
      return response.json();
    })
    .then((items) => {
      if (!Array.isArray(items)) {
        throw new Error('Plik danych musi zawierać tablicę wpisów.');
      }
      return items;
    });
}

function ensureDataReady(callback) {
  if (!dataReadyPromise) {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      dataReadyPromise = Promise.resolve(storageLoad());
    } else {
      dataReadyPromise = fetchDataFile()
        .then((items) => {
          storageSave(items);
          return storageLoad();
        })
        .catch(() => {
          storageSave([]);
          return [];
        });
    }
  }

  return dataReadyPromise.then((items) => {
    if (typeof callback === 'function') {
      callback(items);
    }
    return items;
  });
}

function reloadFromDataFile(success, error) {
  if (window.location.protocol === 'file:') {
    const err = new Error('Fetch nie dziala przez protokol file://. Otworz aplikacje przez serwer HTTP (np. Apache, nginx lub: npx serve).');
    if (typeof error === 'function') error(err);
    return;
  }
  dataReadyPromise = null;
  fetchDataFile()
    .then((items) => {
      localStorage.removeItem(STORAGE_KEY); // clear only after successful fetch
      storageSave(items);
      dataReadyPromise = Promise.resolve(storageLoad());
      if (typeof success === 'function') {
        success(items);
      }
    })
    .catch((err) => {
      dataReadyPromise = Promise.resolve(storageLoad()); // restore on error, keep existing data
      if (typeof error === 'function') {
        error(err);
      }
    });
}

function resetToSeed(success, error) {
  reloadFromDataFile(success, error);
}

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function apiGetAll(success) {
  const items = storageLoad().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  setTimeout(() => success(items), 0);
}

function apiGetOne(id, success, error) {
  const item = storageLoad().find((entry) => entry.id === id);
  if (item) {
    setTimeout(() => success(item), 0);
    return;
  }
  setTimeout(() => (error || $.noop)({ status: 404 }), 0);
}

function apiCreate(data, success, error) {
  if (!data.title || !data.title.trim() || !data.content || !data.content.trim()) {
    setTimeout(() => (error || $.noop)({ responseJSON: { error: 'Tytuł i treść są wymagane.' } }), 0);
    return;
  }
  const now = new Date().toISOString();
  const newItem = {
    id: generateId(),
    title: data.title.trim(),
    author: (data.author || '').trim(),
    category: data.category || 'piosenka',
    content: data.content,
    createdAt: now,
    updatedAt: now
  };
  const items = storageLoad();
  items.push(newItem);
  storageSave(items);
  setTimeout(() => success(newItem), 0);
}

function apiUpdate(id, data, success, error) {
  const items = storageLoad();
  const index = items.findIndex((entry) => entry.id === id);
  if (index === -1) {
    setTimeout(() => (error || $.noop)({ status: 404 }), 0);
    return;
  }
  items[index] = {
    ...items[index],
    title: data.title && data.title.trim() ? data.title.trim() : items[index].title,
    author: data.author !== undefined ? data.author.trim() : items[index].author,
    category: data.category && data.category.trim() ? data.category.trim() : items[index].category,
    content: data.content !== undefined ? data.content : items[index].content,
    updatedAt: new Date().toISOString()
  };
  storageSave(items);
  setTimeout(() => success(items[index]), 0);
}

function apiDelete(id, success, error) {
  const items = storageLoad();
  const filtered = items.filter((entry) => entry.id !== id);
  if (filtered.length === items.length) {
    setTimeout(() => (error || $.noop)({ status: 404 }), 0);
    return;
  }
  storageSave(filtered);
  setTimeout(() => success({ message: 'Usunięto wpis.' }), 0);
}

function exportToJson() {
  const items = storageLoad();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'songs-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllToPdf(items) {
  const sourceItems = Array.isArray(items) ? items : storageLoad();

  if (!sourceItems.length) {
    showToast('Brak wpisów do eksportu.', 'error');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1000,height=800');

  if (!printWindow) {
    showToast('Przeglądarka zablokowała okno wydruku.', 'error');
    return;
  }

  const printStyles = `
    @page {
      size: A4;
      margin: 18mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #222;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    .print-header {
      margin-bottom: 12mm;
      border-bottom: 1px solid #d9d9d9;
      padding-bottom: 6mm;
    }

    .print-header h1 {
      margin: 0 0 3mm;
      font-size: 22pt;
      font-weight: 700;
    }

    .print-header p {
      margin: 0;
      color: #666;
      font-size: 10pt;
    }

    .entry {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 10mm;
      padding-bottom: 8mm;
      border-bottom: 1px solid #ececec;
    }

    .entry:last-child {
      border-bottom: none;
    }

    .entry-title {
      margin: 0 0 3mm;
      font-size: 16pt;
      font-weight: 700;
    }

    .entry-meta {
      margin: 0 0 4mm;
      color: #666;
      font-size: 10pt;
    }

    .entry-content {
      margin: 0;
      padding: 4mm 5mm;
      background: #faf8f4;
      border-left: 3px solid #5b67d8;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "Cascadia Mono", Consolas, "Courier New", monospace;
      font-size: 10.5pt;
      line-height: 1.55;
    }

    .screen-note {
      display: none;
    }

    @media screen {
      body {
        background: #f3f3f3;
        padding: 20px;
      }

      .page {
        max-width: 210mm;
        margin: 0 auto;
        background: #fff;
        padding: 18mm 14mm;
        box-shadow: 0 8px 32px rgba(0,0,0,.12);
      }

      .screen-note {
        display: block;
        margin-top: 12px;
        color: #666;
        font-size: 10pt;
      }
    }
  `;

  const entriesHtml = sourceItems.map((item, index) => {
    const metaParts = [
      'Autor: ' + escapeHtml(item.author || '-'),
      'Typ: ' + escapeHtml(item.category || '-'),
      'Data: ' + escapeHtml(formatDate(item.updatedAt || item.createdAt) || '-')
    ];

    return `
      <section class="entry">
        <h2 class="entry-title">${index + 1}. ${escapeHtml(item.title || 'Bez tytułu')}</h2>
        <p class="entry-meta">${metaParts.join(' &nbsp;|&nbsp; ')}</p>
        <pre class="entry-content">${escapeHtml(item.content || '')}</pre>
      </section>
    `;
  }).join('');

  const documentHtml = `
    <!DOCTYPE html>
    <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SongWebBook PDF</title>
        <style>${printStyles}</style>
      </head>
      <body>
        <div class="page">
          <header class="print-header">
            <h1>SongWebBook</h1>
            <p>Eksport wpisów • ${escapeHtml(new Date().toLocaleString('pl-PL'))}</p>
          </header>
          ${entriesHtml}
          <p class="screen-note">W oknie wydruku wybierz „Zapisz jako PDF”.</p>
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(documentHtml);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 300);
}

function importFromJson(file, merge, done) {
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (!Array.isArray(imported)) {
        throw new Error('Plik JSON musi zawierać tablicę wpisów.');
      }
      if (merge) {
        const current = storageLoad();
        const map = {};
        current.forEach((entry) => { map[entry.id] = entry; });
        imported.forEach((entry) => { map[entry.id] = entry; });
        storageSave(Object.values(map));
      } else {
        storageSave(imported);
      }
      done(null, imported.length);
    } catch (error) {
      done(error.message || 'Błąd importu JSON.');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function categoryBadge(category) {
  const map = {
    piosenka: { cls: 'badge-song', label: '🎵 Piosenka' },
    wiersz: { cls: 'badge-poem', label: '📖 Wiersz' }
  };
  const item = map[category] || { cls: 'badge-other', label: category || 'Inne' };
  return '<span class="badge ' + item.cls + '">' + item.label + '</span>';
}

function convertPlChars(value) {
  return (value || '')
    .replace(/&#324;/g, 'ń');
}

function escapeHtml(value) {
  //value = convertPlChars(value);
  return $('<div>').text(value || '').html();
}

function getExcerpt(text, len = 160) {
  const normalized = (text || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.length > len ? normalized.slice(0, len) + '…' : normalized;
}

function showToast(message, type) {
  const $toast = $('#toast');
  $toast.removeClass('toast-success toast-error').text(message);
  if (type === 'success') $toast.addClass('toast-success');
  if (type === 'error') $toast.addClass('toast-error');
  $toast.stop(true, true).fadeIn(180);
  clearTimeout($toast.data('timeoutId'));
  $toast.data('timeoutId', setTimeout(() => $toast.fadeOut(300), 2800));
}

function pluralPL(value, one, few, many) {
  if (value === 1) return value + ' ' + one;
  if (value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20)) {
    return value + ' ' + few;
  }
  return value + ' ' + many;
}
