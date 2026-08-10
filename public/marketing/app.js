const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const modalBackdrop = document.querySelector('.modal-backdrop');
const modal = document.querySelector('.modal');
const demoPanel = document.querySelector('.modal-demo');
const signupPanel = document.querySelector('.modal-signup');
const thanksPanel = document.querySelector('.modal-thanks');
const modalClose = document.querySelector('.modal-close');

function showModal(kind) {
  modalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  demoPanel.hidden = kind !== 'demo';
  signupPanel.hidden = kind !== 'signup';
  thanksPanel.hidden = true;
  modalClose.hidden = false;
  modal.querySelector('input, button, select')?.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-open-modal]').forEach((button) => {
  button.addEventListener('click', () => showModal(button.dataset.openModal));
});

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (event) => {
  if (event.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modalBackdrop.hidden) closeModal();
});

document.querySelector('.lead-form').addEventListener('submit', (event) => {
  event.preventDefault();
  demoPanel.hidden = true;
  signupPanel.hidden = true;
  thanksPanel.hidden = false;
  modalClose.hidden = false;
  thanksPanel.querySelector('.modal-done').focus();
});

document.querySelector('.modal-done').addEventListener('click', closeModal);

menuToggle.addEventListener('click', () => {
  const isOpen = header.classList.toggle('nav-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});
document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  header.classList.remove('nav-open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

const billingButtons = document.querySelectorAll('[data-billing]');
const prices = document.querySelectorAll('[data-monthly]');
billingButtons.forEach((button) => {
  button.addEventListener('click', () => {
    billingButtons.forEach((item) => item.classList.toggle('active', item === button));
    const annual = button.dataset.billing === 'annual';
    prices.forEach((price) => {
      price.textContent = annual ? price.dataset.annual : price.dataset.monthly;
      const suffix = price.parentElement.querySelector('[data-price-suffix]');
      const note = price.parentElement.nextElementSibling;
      if (suffix) suffix.textContent = annual ? suffix.dataset.annualSuffix : suffix.dataset.monthlySuffix;
      if (note?.matches('[data-monthly-note]')) {
        note.textContent = annual ? note.dataset.annualNote : note.dataset.monthlyNote;
      }
    });
  });
});

const revealItems = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
revealItems.forEach((item) => observer.observe(item));
