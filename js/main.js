const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// mobile nav
const toggle = document.querySelector('.nav__toggle');
const links = document.querySelector('.nav__links');
if (toggle) {
  const setMenu = (open) => {
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? 'Close' : 'Menu';
  };
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenu(!links.classList.contains('open'));
  });
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('click', (e) => {
    if (links.classList.contains('open') && !e.target.closest('.nav')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  document.documentElement.classList.add('nav-ready');
  window.matchMedia('(min-width: 1081px)').addEventListener('change', () => setMenu(false));
}

// stagger — direct children of a [data-stagger] block arrive in sequence
// instead of all at once. Capped so a long list doesn't drag.
document.querySelectorAll('[data-stagger]').forEach((group) => {
  Array.from(group.children).forEach((child, i) => {
    child.classList.add('reveal');
    child.style.setProperty('--rd', Math.min(i, 5) * 70 + 'ms');
  });
});

// scroll reveal
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// scroll-linked draw — [data-draw] elements expose --draw (0 to 1) tracking how
// far the reader has moved through them, so a line can grow as you read rather
// than running out on a timer. Reference line sits below centre so the drawing
// stays just ahead of the text.
const draws = document.querySelectorAll('[data-draw]');
if (draws.length && !reduceMotion.matches) {
  let queued = false;
  const paint = () => {
    queued = false;
    const mark = window.innerHeight * 0.78;
    draws.forEach((el) => {
      const box = el.getBoundingClientRect();
      const p = box.height ? (mark - box.top) / box.height : 1;
      el.style.setProperty('--draw', Math.max(0, Math.min(1, p)).toFixed(3));
    });
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  paint();
}

// FAQ — native <details> snaps open. Animate the height instead, and hold
// the panel open until the closing animation finishes.
document.querySelectorAll('.faq details').forEach((d) => {
  const summary = d.querySelector('summary');
  let anim = null;

  summary.addEventListener('click', (e) => {
    if (reduceMotion.matches) return;
    e.preventDefault();

    const from = d.offsetHeight;
    if (anim) anim.cancel();

    const opening = !d.open;
    if (opening) d.open = true;

    const borders = d.offsetHeight - d.clientHeight;
    const to = opening ? d.offsetHeight : summary.offsetHeight + borders;

    anim = d.animate(
      { height: [from + 'px', to + 'px'] },
      { duration: opening ? 300 : 240, easing: 'cubic-bezier(.22, 1, .36, 1)' }
    );
    anim.onfinish = () => {
      if (!opening) d.open = false;
      anim = null;
    };
  });
});

// mark current page in nav
const here = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links a').forEach((a) => {
  if (a.getAttribute('href').replace(/^\//, '') === here) {
    a.classList.add('is-active');
    a.setAttribute('aria-current', 'page');
  }
});

// Package interest stays with the visitor when they move to the inquiry.
const packageSelect = document.querySelector('#package');
document.querySelectorAll('[data-package]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!packageSelect) return;
    event.preventDefault();
    packageSelect.value = link.dataset.package;
    history.replaceState(null, '', '#book');
    document.querySelector('#book').scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth' });
    packageSelect.focus({ preventScroll: true });
  });
});

const dateInput = document.querySelector('#date');
function updateDateMinimum() {
  if (!dateInput) return;
  const today = new Date();
  dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
updateDateMinimum();
dateInput?.addEventListener('focus', updateDateMinimum);

// Only a configured endpoint can enable submission. The HTML also stays safe
// when JavaScript is unavailable. No customer information is stored locally.
const form = document.querySelector('form.form');
if (form) {
  const button = form.querySelector('[type="submit"]');
  const availability = document.querySelector('#form-availability');
  const status = document.querySelector('#form-status');
  const configured = /^https:\/\/formspree\.io\/f\/[a-z0-9]+$/i.test(form.action)
    && !/replace|placeholder/i.test(form.action);
  if (configured) {
    button.disabled = false;
    availability.textContent = 'Send your preferred details below. Your date is confirmed separately after availability and pricing are agreed.';
  }
  let sending = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!configured || sending) return;
    updateDateMinimum();
    if (!form.reportValidity()) return;
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your request…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(form.action, {
        method: 'POST', body: new FormData(form),
        headers: { Accept: 'application/json' }, signal: controller.signal
      });
      if (!response.ok) throw new Error('Request failed');
      window.location.assign(new URL('thanks.html', window.location.href).href);
    } catch (error) {
      status.textContent = error.name === 'AbortError'
        ? 'We could not confirm whether your request arrived. Your details are still here. Please call or message us before trying again.'
        : 'We could not confirm your request. Your details are still here. Try again, or call or message us using the links above.';
      status.focus();
      button.disabled = false;
      button.textContent = 'Send My Request';
      sending = false;
    } finally {
      clearTimeout(timeout);
      form.removeAttribute('aria-busy');
    }
  });
}
