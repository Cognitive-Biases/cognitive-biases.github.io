// Shared announcement copy and markup for every generator and locale.
const messages = {
  en: ['Now part of', 'Ideas for clearer decisions, learning and action.', 'Explore Vedokrok', 'Hide Vedokrok announcement', 'Show Vedokrok announcement', 'Announcement hidden.', 'Announcement shown.'],
  ru: ['Теперь часть', 'Идеи для решений, обучения и действий.', 'Открыть Vedokrok', 'Скрыть объявление о Vedokrok', 'Показать объявление о Vedokrok', 'Объявление скрыто.', 'Объявление показано.'],
  de: ['Jetzt Teil von', 'Ideen für klarere Entscheidungen, Lernen und Handeln.', 'Vedokrok entdecken', 'Vedokrok-Hinweis ausblenden', 'Vedokrok-Hinweis anzeigen', 'Hinweis ausgeblendet.', 'Hinweis angezeigt.'],
  fr: ['Fait désormais partie de', 'Des idées pour décider, apprendre et agir.', 'Découvrir Vedokrok', 'Masquer l’annonce Vedokrok', 'Afficher l’annonce Vedokrok', 'Annonce masquée.', 'Annonce affichée.'],
  es: ['Ahora parte de', 'Ideas para decidir, aprender y actuar.', 'Explorar Vedokrok', 'Ocultar el anuncio de Vedokrok', 'Mostrar el anuncio de Vedokrok', 'Anuncio oculto.', 'Anuncio mostrado.'],
  'pt-br': ['Agora parte de', 'Ideias para decidir, aprender e agir.', 'Explorar Vedokrok', 'Ocultar o anúncio do Vedokrok', 'Mostrar o anúncio do Vedokrok', 'Anúncio oculto.', 'Anúncio exibido.'],
  it: ['Ora parte di', 'Idee per decidere, imparare e agire.', 'Scopri Vedokrok', 'Nascondi l’annuncio Vedokrok', 'Mostra l’annuncio Vedokrok', 'Annuncio nascosto.', 'Annuncio mostrato.'],
};

export function announcementCopy(language = 'en') {
  return messages[language.toLowerCase()] || messages.en;
}

export function renderVedokrokAnnouncement(language = 'en') {
  const [part, description, explore, dismiss] = announcementCopy(language);
  return `<aside class="vedokrok-banner" data-vedokrok-banner aria-label="Vedokrok"><div class="vedokrok-banner__inner"><img class="vedokrok-banner__mascot" src="/assets/vedokrok/mascot.webp" width="192" height="192" alt=""><div class="vedokrok-banner__copy"><p class="vedokrok-banner__identity"><span>${part}</span><a href="https://vedokrok.com/"><img src="/assets/vedokrok/wordmark.webp" width="320" height="77" alt="Vedokrok"></a></p><p class="vedokrok-banner__line">${description}</p></div><a class="vedokrok-banner__visit" href="https://vedokrok.com/">${explore} <span aria-hidden="true">↗</span></a><button class="vedokrok-banner__dismiss" type="button" data-vedokrok-dismiss aria-label="${dismiss}" title="${dismiss}" hidden><span aria-hidden="true">×</span></button></div></aside>`;
}

export function normalizeVedokrokAnnouncement(html) {
  const language = html.match(/<html\b[^>]*lang="([^"]+)"/)?.[1] || 'en';
  if (!html.includes('data-vedokrok-banner')) return html;
  html = html.replace(/<aside\b[^>]*\bdata-vedokrok-banner[^>]*>[\s\S]*?<\/aside>/g, renderVedokrokAnnouncement(language));
  const copy = announcementCopy(language);
  const control = `<button class="vedokrok-restore" type="button" data-vedokrok-restore data-hidden-message="${copy[5]}" data-shown-message="${copy[6]}" hidden>${copy[4]}</button><span class="vedokrok-status" role="status" aria-live="polite" data-vedokrok-status></span>`;
  // Keep the normal project link visible after dismissal, with an undo beside it.
  return html.replace(/(<p class="vedokrok-footer">)([\s\S]*?)(<\/p>)/, (_match, start, content, end) =>
    `${start}${content.replace(/<button\b[^>]*data-vedokrok-restore[^>]*>[\s\S]*?<\/button><span\b[^>]*data-vedokrok-status[^>]*>[\s\S]*?<\/span>/, '')}${control}${end}`);
}
