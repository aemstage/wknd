/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {Document} The document
 */
async function loadFragment(path) {
  if (path && path.startsWith('/')) {
    const resp = await fetch(path);
    if (resp.ok) {
      const parser = new DOMParser();
      return parser.parseFromString(await resp.text(), 'text/html');
    }
  }
  return null;
}

const getDocumentLastModified = (document) => {
  const dateTimeFormatOptions = ['en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }];
  const lastModified = document.lastModified;

  if (lastModified) {
    const [month, day, year] = new Intl.DateTimeFormat(...dateTimeFormatOptions).format(new Date(lastModified)).split('/');
    return `${year}/${month}/${day}`;
  }

  return 'unknown';
};

const DUMMY_URL_BASE = 'https://localhost.com';
/**
 * @param {HTMLElement} $block The header block element
 */
export default async function decorate($block) {
  const link = $block.querySelector('a');
  const path = link ? link.getAttribute('href') : $block.textContent.trim();
  const doc = await loadFragment(path);
  if (!doc) {
    return;
  }
  const fragmentContents = doc.querySelector('main > div');
  if (!fragmentContents || !fragmentContents.children.length) {
    return;
  }

  const fragmentPath = new URL(path, DUMMY_URL_BASE);
  const fragmentSearchParams = fragmentPath.searchParams;
  fragmentSearchParams.set('documentLastModified', getDocumentLastModified(doc));

  $block.replaceChildren(...fragmentContents.children);
  $block.setAttribute('data-fragment-src', fragmentPath.href.replace(DUMMY_URL_BASE, ''));
}
