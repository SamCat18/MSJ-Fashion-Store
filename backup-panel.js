(() => {
  const token = window.BACKUP_TOKEN || '';
  const $ = selector => document.querySelector(selector);
  const moneySize = bytes => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  const dateTime = value => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  function showMessage(text, isError = false) { const message = $('#backup-message'); message.textContent = text; message.classList.toggle('error', isError); }
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { ...(options.headers || {}), ...(options.method === 'POST' ? { 'X-MSJ-Backup-Token': token } : {}) } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo consultar el servicio local.');
    return result;
  }
  function renderFiles(files) {
    $('#backup-files').innerHTML = files.map(file => `<tr><td class="file-name">${file.name}</td><td>${dateTime(file.createdAt)}</td><td>${moneySize(file.bytes)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Aún no hay respaldos locales.</td></tr>';
    $('#backup-count').textContent = files.length;
  }
  async function refresh() {
    try {
      const [status, backups] = await Promise.all([request('/api/status'), request('/api/backups')]);
      $('#connection-state').classList.add('online');
      $('#connection-state').innerHTML = '<i></i> Servicio local activo';
      $('#last-run').textContent = dateTime(status.lastRun);
      $('#last-result').textContent = status.lastResult || 'Sin ejecuciones registradas';
      $('#next-run').textContent = dateTime(status.nextRun);
      $('#schedule-state').textContent = status.taskInstalled ? 'Cada 6 horas' : 'Tarea no instalada';
      $('#tool-state').textContent = status.pgDumpAvailable ? 'Disponible' : 'Falta pg_dump';
      renderFiles(backups.files);
      if (!status.configured) showMessage('Configura la conexión cifrada antes de crear respaldos.', true);
      else if (!status.pgDumpAvailable) showMessage('Instala PostgreSQL Command Line Tools para habilitar pg_dump.', true);
      else showMessage('Servicio local listo para crear y consultar respaldos.');
    } catch (error) {
      $('#connection-state').classList.remove('online');
      $('#connection-state').innerHTML = '<i></i> Servicio sin conexión';
      showMessage(`${error.message} Inicia scripts/backup-panel-server.ps1.`, true);
    }
  }
  $('#refresh-backups').addEventListener('click', refresh);
  $('#run-backup').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    showMessage('Creando el backup comprimido…');
    try {
      const result = await request('/api/run', { method: 'POST' });
      showMessage(`Backup creado: ${result.name}`);
      await refresh();
    } catch (error) {
      showMessage(error.message, true);
      await refresh();
    } finally { button.disabled = false; }
  });
  refresh();
  setInterval(refresh, 60000);
})();
