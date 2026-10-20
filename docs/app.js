'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const burger = document.querySelector('.navbar-burger');
  const menu = document.getElementById('main-nav');

  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = burger.classList.toggle('is-active');
      menu.classList.toggle('is-active', open);
      burger.setAttribute('aria-expanded', String(open));
    });

    for (const link of menu.querySelectorAll('a')) {
      link.addEventListener('click', () => {
        burger.classList.remove('is-active');
        menu.classList.remove('is-active');
        burger.setAttribute('aria-expanded', 'false');
      });
    }
  }

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
});
