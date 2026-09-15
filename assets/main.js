async function loadPartial(url, containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  const res = await fetch(url);
  el.innerHTML = await res.text();
}

function initHeaderFooter(){
  const header = document.getElementById('site-header');
  const toTop = document.getElementById('to-top');
  if(header && toTop){
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 8);
      toTop.classList.toggle('show', window.scrollY > 600);
    });
    toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  }

  const navToggle = document.getElementById('nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if(navToggle && mobileMenu){
    navToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      navToggle.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('open')));
  }

  // active nav link based on <body data-page="...">
  const page = document.body.dataset.page;
  if(page){
    document.querySelectorAll('[data-nav]').forEach(a => {
      if(a.dataset.nav === page) a.classList.add('active');
    });
  }
}

function initReveal(){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  document.querySelectorAll('.reveal, .reveal-stagger, .reveal-img').forEach(el => io.observe(el));
}

function initCounters(){
  const counters = document.querySelectorAll('.num[data-count]');
  if(!counters.length) return;
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.count, 10);
      const duration = 1200;
      const start = performance.now();
      function tick(now){
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if(p < 1) requestAnimationFrame(tick);
        else el.textContent = target;
      }
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach(el => countIO.observe(el));
}

function initParallax(){
  const parallaxEl = document.getElementById('hero-parallax');
  if(!parallaxEl) return;
  window.addEventListener('scroll', () => {
    const y = Math.min(window.scrollY, 500);
    parallaxEl.style.transform = `translateY(${y * 0.12}px) scale(1.06)`;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadPartial('partials/header.html', 'header-placeholder'),
    loadPartial('partials/footer.html', 'footer-placeholder')
  ]);
  initHeaderFooter();
  initReveal();
  initCounters();
  initParallax();
});
