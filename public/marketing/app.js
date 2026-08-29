const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const modalBackdrop = document.querySelector('.modal-backdrop');
const modal = document.querySelector('.modal');
const signupPanel = document.querySelector('.modal-signup');
const modalClose = document.querySelector('.modal-close');

function showModal() {
  modalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  signupPanel.hidden = false;
  modalClose.hidden = false;
  modal.querySelector('input, button, select')?.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-open-modal]').forEach((button) => {
  button.addEventListener('click', showModal);
});

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (event) => {
  if (event.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modalBackdrop.hidden) closeModal();
});

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
