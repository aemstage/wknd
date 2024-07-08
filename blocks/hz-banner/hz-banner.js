import html from './hz-banner-html.js';

export default function decorate(block) {
  let hydratedHTML = html;
  [...block.children].forEach((row, i) => {
    [...row.children].forEach((rowChild, j) => {
      hydratedHTML = hydratedHTML.replace(`{{${j}}}`, rowChild.innerText.trim());
    });
  });
  block.innerHTML = hydratedHTML; 
};
