/**
 * publications.js
 * Reads BibTeX from <script type="text/bibtex" id="publications-bib">,
 * parses it, and renders into <ol id="publications-list">.
 *
 * Usage:
 *   - Add your papers to the <script type="text/bibtex"> block in index.html
 *   - Set data-highlight="Your Name" on the <ol> to auto-bold your name
 *   - Papers are sorted by year (newest first) automatically
 */

(function () {

  /* ─── BibTeX Parser ──────────────────────────────────────────────── */

  function parseBibtex(raw) {
    const entries = [];
    raw = raw.replace(/%[^\n]*/g, '');   // strip line comments

    let i = 0;
    while (i < raw.length) {
      const atIdx = raw.indexOf('@', i);
      if (atIdx === -1) break;

      const braceIdx = raw.indexOf('{', atIdx);
      if (braceIdx === -1) break;

      const type = raw.slice(atIdx + 1, braceIdx).trim().toLowerCase();
      if (type === 'string' || type === 'preamble' || type === 'comment') {
        i = braceIdx + 1;
        continue;
      }

      // Walk balanced braces to find the entry boundary
      let depth = 0, j = braceIdx;
      while (j < raw.length) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') { depth--; if (depth === 0) break; }
        j++;
      }

      const inner   = raw.slice(braceIdx + 1, j);
      const comma   = inner.indexOf(',');
      const key     = inner.slice(0, comma).trim();
      const fields  = parseFields(inner.slice(comma + 1));

      entries.push({ type, key, ...fields });
      i = j + 1;
    }
    return entries;
  }

  function parseFields(str) {
    const fields = {};
    let i = 0;

    while (i < str.length) {
      // skip whitespace / commas
      while (i < str.length && /[\s,]/.test(str[i])) i++;
      if (i >= str.length) break;

      // field name
      const nameStart = i;
      while (i < str.length && str[i] !== '=') i++;
      const name = str.slice(nameStart, i).trim().toLowerCase();
      if (!name || i >= str.length) break;
      i++; // skip '='

      while (i < str.length && /\s/.test(str[i])) i++;

      // field value
      let value = '';
      if (str[i] === '{') {
        // brace-delimited — walk balanced
        let depth = 0, start = i;
        while (i < str.length) {
          if (str[i] === '{') depth++;
          else if (str[i] === '}') { depth--; if (depth === 0) { i++; break; } }
          i++;
        }
        value = str.slice(start + 1, i - 1);
      } else if (str[i] === '"') {
        i++;
        const start = i;
        while (i < str.length && str[i] !== '"') i++;
        value = str.slice(start, i);
        i++;
      } else {
        // bare token (e.g. year = 2025)
        const start = i;
        while (i < str.length && str[i] !== ',' && str[i] !== '}') i++;
        value = str.slice(start, i).trim();
      }

      fields[name] = cleanLatex(value);
    }
    return fields;
  }

  /* ─── LaTeX → HTML cleanup ───────────────────────────────────────── */

  function cleanLatex(s) {
    return s
      .replace(/\\textbf\{([^}]+)\}/g,  '<strong>$1</strong>')
      .replace(/\\textit\{([^}]+)\}/g,  '<em>$1</em>')
      .replace(/\\emph\{([^}]+)\}/g,    '<em>$1</em>')
      .replace(/\{([^{}]+)\}/g,          '$1')   // strip remaining braces
      .replace(/\\&/g, '&').replace(/~~/g, ' ').replace(/~/g, ' ')
      .replace(/---/g, '—').replace(/--/g, '–')
      .replace(/\\newblock/g, '').trim();
  }

  /* ─── Author formatting ──────────────────────────────────────────── */

  function formatAuthors(raw, highlight) {
    if (!raw) return '';
    return raw.split(/\s+and\s+/i)
      .map(a => {
        const name = normalizeAuthor(a.trim());
        return (highlight && name.toLowerCase().includes(highlight.toLowerCase()))
          ? `<strong>${name}</strong>` : name;
      })
      .join(', ');
  }

  function normalizeAuthor(a) {
    // "Last, First M." → "First M. Last"
    if (a.includes(',')) {
      const [last, first] = a.split(',').map(s => s.trim());
      return `${first} ${last}`.trim();
    }
    return a;
  }

  /* ─── Render one entry ───────────────────────────────────────────── */

  function renderEntry(e, highlight) {
    const title   = e.title || 'Untitled';
    const authors = formatAuthors(e.author, highlight);
    const year    = e.year  || '';

    // Venue: prefer journal > booktitle > school > howpublished
    const venueName = e.journal || e.booktitle || e.school || e.howpublished || '';

    let venueDetail = '';
    if (e.volume) venueDetail += `, ${e.volume}`;
    if (e.number) venueDetail += `(${e.number})`;
    if (e.pages)  venueDetail += `, ${e.pages}`;

    const venueStr = venueName
      ? `<em><strong>${venueName}${venueDetail}</strong>${year ? `, ${year}` : ''}</em>`
      : (year ? `<em>${year}</em>` : '');

    // Links: url / doi / pdf / code / slides / poster
    const linkDefs = [
      { key: 'url',    label: 'Paper' },
      { key: 'doi',    label: 'DOI',  prefix: 'https://doi.org/' },
      { key: 'pdf',    label: 'PDF' },
      { key: 'code',   label: 'Code' },
      { key: 'slides', label: 'Slides' },
      { key: 'poster', label: 'Poster' },
    ];
    const links = linkDefs
      .filter(d => e[d.key])
      .map(d => {
        const href = d.prefix ? d.prefix + e[d.key] : e[d.key];
        return `<a href="${href}" target="_blank" rel="noopener">${d.label}</a>`;
      });

    return `
      <li>
        <div class="pub-row">
          <div class="pub-content">
            <div class="title">${title}</div>
            <div class="author">${authors}</div>
            ${venueStr ? `<div class="periodical">${venueStr}</div>` : ''}
            ${links.length ? `<div class="links">${links.join(' / ')}</div>` : ''}
          </div>
        </div>
      </li>`;
  }

  /* ─── Entry point ────────────────────────────────────────────────── */

  function run() {
    const bibScript = document.getElementById('publications-bib');
    const list      = document.getElementById('publications-list');
    if (!bibScript || !list) return;

    const highlight = list.dataset.highlight || '';
    const entries   = parseBibtex(bibScript.textContent);

    // Sort: newest first; within same year preserve declaration order
    entries.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));

    list.innerHTML = entries.length
      ? entries.map(e => renderEntry(e, highlight)).join('')
      : '<li><em>No publications found.</em></li>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
