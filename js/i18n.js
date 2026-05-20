// i18n.js — 多言語対応
let currentLang = 'ja';

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-ja]').forEach(el => {
    el.textContent = el.dataset[lang] || el.dataset.ja;
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  document.documentElement.lang = lang;
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.lang));
});

// 初期化
setLang('ja');
