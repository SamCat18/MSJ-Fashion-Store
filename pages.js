(() => {
  const business = (window.STORE_CONFIG || {}).business || {};
  const missing = '[por completar]';
  document.querySelectorAll('[data-business]').forEach(node => {
    const value = String(business[node.dataset.business] || '').trim();
    node.textContent = value || missing;
    node.classList.toggle('fill', !value);
  });
  const banner = document.getElementById('draft-banner');
  if (banner) banner.hidden = Boolean(business.legalName && business.ruc && business.address && business.email);
  const year = document.getElementById('page-year');
  if (year) year.textContent = new Date().getFullYear();
})();
