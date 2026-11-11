// Carrusel de la portada: avanza solo cada 5 s con fundido, con flechas, puntos, teclado y deslizamiento táctil.
// Solo se detiene con el botón de pausa (WCAG 2.2.2), al navegarlo con el teclado o con la pestaña oculta.
// Con «reducir movimiento» del sistema sigue avanzando, pero el cambio es directo, sin fundido ni zoom (store-plus.css).
(() => {
  const root = document.getElementById('hero-carousel');
  if (!root) return;
  const slides = [...root.querySelectorAll('.hero-slide')];
  const dots = [...root.querySelectorAll('[data-hero-go]')];
  const pauseButton = document.getElementById('hero-pause');
  const delay = 5000;
  let index = 0, timer = 0, userPaused = false, focused = false;

  function show(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, position) => {
      const active = position === index;
      slide.classList.toggle('is-active', active);
      // Solo la imagen visible se puede enfocar y la leen los lectores de pantalla.
      slide.inert = !active;
    });
    dots.forEach((dot, position) => dot.toggleAttribute('aria-current', position === index));
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (userPaused || focused || document.hidden || slides.length < 2) return;
    timer = setTimeout(() => show(index + 1), delay);
  }

  function setPaused(paused) {
    userPaused = paused;
    root.classList.toggle('is-paused', paused);
    pauseButton.textContent = paused ? '▶' : '❚❚';
    pauseButton.setAttribute('aria-label', paused ? 'Reanudar carrusel' : 'Pausar carrusel');
    schedule();
  }

  root.addEventListener('click', event => {
    const step = event.target.closest('[data-hero-step]');
    const go = event.target.closest('[data-hero-go]');
    if (step) show(index + Number(step.dataset.heroStep));
    else if (go) show(Number(go.dataset.heroGo));
    else if (event.target.closest('#hero-pause')) setPaused(!userPaused);
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
  });
  // Solo el foco de teclado pausa: un clic con el mouse también enfoca, pero no debe dejar el carrusel quieto.
  root.addEventListener('focusin', () => { focused = root.matches(':focus-within:has(:focus-visible)'); schedule(); });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) { focused = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);

  // Deslizar con el dedo: más de 40 px en horizontal cambia de imagen (sin bloquear el desplazamiento vertical).
  let startX = null, startY = 0;
  root.addEventListener('touchstart', event => { startX = event.touches[0].clientX; startY = event.touches[0].clientY; }, { passive: true });
  root.addEventListener('touchend', event => {
    if (startX === null) return;
    const dx = event.changedTouches[0].clientX - startX, dy = event.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  setPaused(userPaused);
  show(0);
})();
