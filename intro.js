/* Una bienvenida por sesión de pestaña. Nunca retrasa el cálculo ni el archivo. */
(function () {
  'use strict';
  const intro = document.getElementById('welcome-intro');
  if (!intro || window.self !== window.top) return;
  const key = 'cimagraf-intro-seen-v1';
  let seen = false, returning = false;
  try {
    seen = sessionStorage.getItem(key) === '1';
    returning = Boolean(sessionStorage.getItem('cimagraf-pdf-pending-v1'));
    sessionStorage.setItem(key, '1');
  } catch (_) { /* Si el almacenamiento está bloqueado, la calculadora sigue disponible. */ }
  if (seen || returning || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // El HTML permanece oculto si el script o la hoja de estilos no cargan.
  if (window.getComputedStyle(intro).position !== 'fixed') return;
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    intro.classList.add('is-leaving');
    setTimeout(() => { intro.hidden = true; }, 220);
  }
  document.getElementById('welcome-intro-skip').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  intro.hidden = false;
  // Reutiliza el símbolo del logo oficial sin incorporar otro archivo de imagen.
  function addMark() {
    const source = document.querySelector('.brand-logo');
    if (!source || closed) return;
    const image = document.createElement('img');
    image.src = source.src;
    image.alt = '';
    document.querySelector('.welcome-intro-mark').append(image);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addMark, { once: true });
  else addMark();
  setTimeout(close, 1650);
})();
