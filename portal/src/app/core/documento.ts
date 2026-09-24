import { Corpo, Secao } from './modelos';

/**
 * Tudo o que transforma o HTML/CSS/JS enviado no admin numa página que roda
 * dentro do iframe isolado do leitor.
 *
 * O iframe usa sandbox="allow-scripts ..." SEM allow-same-origin:
 *  - o CSS do conteúdo não afeta o portal;
 *  - o JS do conteúdo roda, mas não enxerga o login nem o Firestore do portal;
 *  - localStorage não existe lá dentro, então a ponte cria um substituto
 *    que o portal grava na conta do aluno.
 */

export const LIMITE_BYTES = 1_000_000; // um documento do Firestore aceita até 1 MiB (1.048.576 bytes)

export interface ConfigPonte {
  /** dados iniciais do localStorage simulado */
  storage: Record<string, string>;
  /** seção para rolar ao abrir (vem do #fragmento da URL) */
  secaoInicial: string | null;
}

export interface Analise {
  titulo: string;
  materia: string;
  tags: string[];
  descricao: string;
  /** <meta name="ordem">, ou null se não houver */
  ordem: number | null;
  completo: boolean;
  secoes: Secao[];
  bytes: number;
  avisos: string[];
  infos: string[];
}

// ---------------------------------------------------------------------------
// Seções: a mesma regra roda aqui (admin) e dentro do iframe (ponte).
// 1) [data-secao][id]  2) section[id] com título dentro  3) h2[id], h3[id]  4) h2, h3 (ids gerados)
// ---------------------------------------------------------------------------

export function slugTexto(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function textoDe(el: Element): string {
  return Array.from(el.childNodes)
    .map((n) => n.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function encontrarSecoes(doc: Document): Secao[] {
  let els = Array.from(doc.querySelectorAll('[data-secao][id]'));
  if (!els.length) els = Array.from(doc.querySelectorAll('section[id]')).filter((el) => el.querySelector('h1,h2,h3,h4'));
  if (!els.length) els = Array.from(doc.querySelectorAll('h2[id],h3[id]'));
  if (!els.length) {
    els = Array.from(doc.querySelectorAll('h2,h3'));
    const usados = new Set<string>();
    for (const el of els) {
      const base = 'sec-' + (slugTexto(el.textContent ?? '') || 'secao');
      let id = base;
      let n = 2;
      while (usados.has(id) || doc.getElementById(id)) id = `${base}-${n++}`;
      usados.add(id);
      el.id = id;
    }
  }
  return els.map((el) => {
    const h = /^H[1-6]$/.test(el.tagName) ? el : el.querySelector('h1,h2,h3,h4');
    return { id: el.id, titulo: (h ? textoDe(h) : '') || el.id };
  });
}

// ---------------------------------------------------------------------------
// Análise feita no admin antes de publicar
// ---------------------------------------------------------------------------

export function bytesDe(corpo: Corpo): number {
  const enc = new TextEncoder();
  return enc.encode(corpo.html).length + enc.encode(corpo.css).length + enc.encode(corpo.js).length;
}

export function analisar(corpo: Corpo): Analise {
  const doc = new DOMParser().parseFromString(corpo.html, 'text/html');
  const meta = (n: string) => doc.querySelector(`meta[name="${n}"]`)?.getAttribute('content')?.trim() ?? '';
  const avisos: string[] = [];
  const infos: string[] = [];
  const bytes = bytesDe(corpo);

  if (!corpo.html.trim()) avisos.push('Envie ao menos o arquivo HTML.');
  if (bytes > LIMITE_BYTES) {
    avisos.push('O conteúdo passa de 1 MB, o limite de um documento do Firestore. Tire imagens em base64 do HTML e envie-as como imagem do conteúdo.');
  } else if (bytes > LIMITE_BYTES * 0.8) {
    infos.push('O conteúdo está perto do limite de 1 MB.');
  }

  // <link rel="stylesheet" href="x.css"> e <script src="x.js"> locais são removidos na montagem
  // (servem só para abrir o arquivo fora do portal); o conteúdo deles vai nos campos CSS e JS.
  const locaisCss: string[] = [];
  const locaisJs: string[] = [];
  doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach((el) => {
    const v = el.getAttribute('href')!.trim();
    if (ehLocal(v)) locaisCss.push(v);
  });
  doc.querySelectorAll('script[src]').forEach((el) => {
    const v = el.getAttribute('src')!.trim();
    if (ehLocal(v)) locaisJs.push(v);
  });
  if (locaisCss.length && !corpo.css.trim()) {
    avisos.push(`O HTML usa ${locaisCss.join(', ')}, que não carrega no portal. Envie esse arquivo no campo CSS.`);
  }
  if (locaisJs.length && !corpo.js.trim()) {
    avisos.push(`O HTML usa ${locaisJs.join(', ')}, que não carrega no portal. Envie esse arquivo no campo JS.`);
  }
  if ((locaisCss.length && corpo.css.trim()) || (locaisJs.length && corpo.js.trim())) {
    infos.push(`As ligações locais (${[...locaisCss, ...locaisJs].join(', ')}) são ignoradas no portal; vale o que foi enviado nos campos CSS e JS.`);
  }

  const relativos = new Set<string>();
  doc.querySelectorAll('[src],link[href]').forEach((el) => {
    if (el.matches('link[rel~="stylesheet"], script[src]')) return;
    const v = (el.getAttribute('src') ?? el.getAttribute('href') ?? '').trim();
    if (v && ehLocal(v)) relativos.add(v);
  });
  if (relativos.size) {
    avisos.push(
      `Arquivos com caminho relativo não carregam dentro do portal: ${[...relativos].slice(0, 4).join(', ')}${relativos.size > 4 ? '…' : ''}. Use URLs completas ou envie as imagens pelo botão de imagens.`,
    );
  }

  const secoes = encontrarSecoes(doc);
  if (!secoes.length) infos.push('Nenhuma seção encontrada: as dúvidas ficarão na página inteira.');

  const todoJs = corpo.js + Array.from(doc.scripts).map((s) => s.textContent).join('\n');
  if (/\blocalStorage\b|\bsessionStorage\b/.test(todoJs)) {
    infos.push('O JS usa localStorage: no portal isso é salvo na conta de quem estiver logado.');
  }
  if (corpo.css.trim()) infos.push('CSS separado será colocado no <head>.');
  if (corpo.js.trim()) infos.push('JS separado será colocado no fim do <body>.');

  return {
    titulo: doc.title.trim(),
    materia: meta('materia'),
    tags: meta('tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    descricao: meta('descricao') || meta('description'),
    ordem: meta('ordem') && !isNaN(Number(meta('ordem'))) ? Number(meta('ordem')) : null,
    completo: /<html(\s[^>]*)?>/i.test(corpo.html) || /<head(\s[^>]*)?>/i.test(corpo.html),
    secoes,
    bytes,
    avisos,
    infos,
  };
}

// ---------------------------------------------------------------------------
// Montagem do documento do iframe
// ---------------------------------------------------------------------------

/** Caminho que só existe na pasta do autor (não é URL completa, data:, âncora etc.). */
export function ehLocal(v: string): boolean {
  return !!v && !/^(https?:|data:|blob:|\/\/|#|mailto:|tel:|javascript:)/i.test(v);
}

/** Tira <link rel="stylesheet"> e <script src> que apontam para arquivos locais. */
export function removerLigacoesLocais(html: string): string {
  const attr = (tag: string, nome: string) => tag.match(new RegExp(`\\b${nome}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  const valor = (m: RegExpMatchArray | null) => (m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : '');
  return html
    .replace(/<link\b[^>]*>/gi, (tag) => {
      const rel = valor(attr(tag, 'rel')).toLowerCase().split(/\s+/);
      return rel.includes('stylesheet') && ehLocal(valor(attr(tag, 'href'))) ? '' : tag;
    })
    .replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script\s*>/gi, (tag) => (ehLocal(valor(attr(tag, 'src'))) ? '' : tag));
}

const RE_HEAD = /<head(\s[^>]*)?>/i;
const RE_HTML = /<html(\s[^>]*)?>/i;

function inserirAntesDoUltimo(html: string, tag: RegExp, trecho: string): string | null {
  let ultimo = -1;
  for (const m of html.matchAll(tag)) ultimo = m.index ?? -1;
  if (ultimo < 0) return null;
  return html.slice(0, ultimo) + trecho + html.slice(ultimo);
}

export function montarDocumento(corpo: Corpo, cfg: ConfigPonte): string {
  const cfgJson = JSON.stringify(cfg).replace(/</g, '\\u003c');
  const ponte = `<script>${PONTE_JS.replace('__CONFIG__', () => cfgJson)}</script>`;
  const css = corpo.css.trim() ? `<style>${corpo.css.replace(/<\/style/gi, '<\\/style')}</style>` : '';
  const js = corpo.js.trim() ? `<script>${corpo.js.replace(/<\/script/gi, '<\\/script')}</script>` : '';

  let html = removerLigacoesLocais(corpo.html);
  if (RE_HEAD.test(html)) {
    html = html.replace(RE_HEAD, (m) => m + ponte);
  } else if (RE_HTML.test(html)) {
    html = html.replace(RE_HTML, (m) => `${m}<head>${ponte}</head>`);
  } else {
    html =
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      `${ponte}</head><body>${html}</body></html>`;
  }

  if (css) html = inserirAntesDoUltimo(html, /<\/head>/gi, css) ?? css + html;
  if (js) html = inserirAntesDoUltimo(html, /<\/body>/gi, js) ?? html + js;
  return html;
}

// ---------------------------------------------------------------------------
// ponte.js — roda dentro do iframe ANTES do JS do conteúdo.
// Mensagens para o portal: {cc:1, tipo:'secoes'|'abrir'|'storage'|'navegar'|'atalho-acessibilidade'|'texto-leitura'}
// Mensagens do portal:     {cc:1, tipo:'contagens'|'rolar'|'ativa'|'acessibilidade'|'pedir-texto'}
// ---------------------------------------------------------------------------

export const PONTE_JS = String.raw`(function(){
  var CFG = __CONFIG__;
  var pai = window.parent;
  function enviar(m){ m.cc = 1; try { pai.postMessage(m, '*'); } catch (e) {} }

  /* localStorage/sessionStorage substitutos */
  function criarStorage(inicial, persistir){
    var dados = {};
    Object.keys(inicial || {}).forEach(function(k){ dados[k] = String(inicial[k]); });
    var t = null;
    function agendar(){ if (!persistir) return; clearTimeout(t); t = setTimeout(function(){ enviar({ tipo: 'storage', dados: dados }); }, 400); }
    return {
      getItem: function(k){ k = String(k); return Object.prototype.hasOwnProperty.call(dados, k) ? dados[k] : null; },
      setItem: function(k, v){ dados[String(k)] = String(v); agendar(); },
      removeItem: function(k){ delete dados[String(k)]; agendar(); },
      clear: function(){ dados = {}; agendar(); },
      key: function(i){ var ks = Object.keys(dados); return i < ks.length ? ks[i] : null; },
      get length(){ return Object.keys(dados).length; }
    };
  }
  var ls = criarStorage(CFG.storage, true), ss = criarStorage({}, false);
  try { Object.defineProperty(window, 'localStorage', { configurable: true, get: function(){ return ls; } }); } catch (e) {}
  try { Object.defineProperty(window, 'sessionStorage', { configurable: true, get: function(){ return ss; } }); } catch (e) {}

  /* history.pushState/replaceState falham num iframe isolado: ignora o erro */
  ['pushState', 'replaceState'].forEach(function(nome){
    var orig = history[nome];
    history[nome] = function(){ try { return orig.apply(history, arguments); } catch (e) {} };
  });

  /* seções e marcadores */
  function slug(t){
    return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function textoDe(el){
    return Array.prototype.map.call(el.childNodes, function(n){ return n.textContent || ''; })
      .join(' ').replace(/\s+/g, ' ').trim();
  }
  function encontrar(){
    var els = document.querySelectorAll('[data-secao][id]');
    if (!els.length) els = Array.prototype.filter.call(document.querySelectorAll('section[id]'), function(el){ return el.querySelector('h1,h2,h3,h4'); });
    if (!els.length) els = document.querySelectorAll('h2[id],h3[id]');
    if (!els.length) {
      els = document.querySelectorAll('h2,h3');
      var usados = {};
      Array.prototype.forEach.call(els, function(el){
        var base = 'sec-' + (slug(el.textContent || '') || 'secao'), id = base, n = 2;
        while (usados[id] || document.getElementById(id)) id = base + '-' + (n++);
        usados[id] = 1; el.id = id;
      });
    }
    return Array.prototype.map.call(els, function(el){
      var h = /^H[1-6]$/.test(el.tagName) ? el : el.querySelector('h1,h2,h3,h4');
      return { el: el, h: h, id: el.id, titulo: (h ? textoDe(h) : '') || el.id };
    });
  }

  var CSS = '.cc-marca{all:initial;display:inline-flex;align-items:center;gap:3px;vertical-align:middle;margin-left:10px;'
    + 'height:24px;padding:0 9px;border-radius:13px 13px 13px 3px;border:1px solid rgba(127,127,127,.55);'
    + 'background:rgba(127,127,127,.10);color:inherit;font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;'
    + 'cursor:pointer;opacity:.75;transition:opacity .15s}'
    + '.cc-marca:hover,.cc-marca:focus-visible{opacity:1;outline:2px solid #1E3F9A;outline-offset:2px}'
    + '.cc-marca.cc-tem{background:#C3363F;border-color:#C3363F;color:#fff;opacity:1}'
    + '.cc-bloco{display:flex;justify-content:flex-end;margin:0 0 6px}'
    + '.cc-ativa{outline:3px solid rgba(195,54,63,.45);outline-offset:6px;border-radius:4px}';

  var secoes = [], marcas = {};
  function rotulo(n){ return n > 0 ? '? ' + n : '+ dúvida'; }

  function montar(){
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    secoes = encontrar();
    secoes.forEach(function(s){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cc-marca'; b.textContent = rotulo(0);
      b.setAttribute('aria-label', 'Dúvidas da seção ' + s.titulo);
      b.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); enviar({ tipo: 'abrir', secao: s.id }); });
      if (s.h) { s.h.appendChild(b); }
      else { var w = document.createElement('div'); w.className = 'cc-bloco'; w.appendChild(b); s.el.insertBefore(w, s.el.firstChild); }
      marcas[s.id] = b;
    });
    enviar({ tipo: 'secoes', lista: secoes.map(function(s){ return { id: s.id, titulo: s.titulo }; }) });
    if (CFG.secaoInicial) rolar(CFG.secaoInicial);
  }

  function rolar(id){
    var el = document.getElementById(id);
    if (!el) return;
    if (el.closest('[hidden]')) return;
    el.scrollIntoView({ block: 'start' });
  }

  window.addEventListener('message', function(e){
    if (e.source !== pai) return;
    var d = e.data; if (!d || !d.cc) return;
    if (d.tipo === 'contagens') {
      Object.keys(marcas).forEach(function(id){
        var n = d.mapa[id] || 0;
        marcas[id].textContent = rotulo(n);
        marcas[id].classList.toggle('cc-tem', n > 0);
      });
    } else if (d.tipo === 'rolar') {
      rolar(d.secao);
    } else if (d.tipo === 'ativa') {
      secoes.forEach(function(s){ s.el.classList.toggle('cc-ativa', s.id === d.secao); });
    } else if (d.tipo === 'acessibilidade') {
      aplicarAcessibilidade(d);
    } else if (d.tipo === 'pedir-texto') {
      var texto = '';
      try { texto = textoParaLer(); } catch (err) {}
      enviar({ tipo: 'texto-leitura', id: d.id, texto: texto });
    }
  });

  /* Texto para o "Ouvir página": a seleção, ou a página a partir da seção que está na tela.
     Pula sumário, botões, marcadores de dúvida e o que está escondido (ex.: gabaritos fechados). */
  var BLOCO = /^(P|LI|H[1-6]|DIV|SECTION|ARTICLE|HEADER|FOOTER|TR|TD|TH|SUMMARY|FIGCAPTION|BLOCKQUOTE|DT|DD|PRE|TABLE|UL|OL|LABEL)$/;
  var PULAR = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|IFRAME|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA|NAV)$/;
  function textoParaLer(){
    var sel = window.getSelection ? String(window.getSelection() || '').trim() : '';
    if (sel) return sel.replace(/\s+/g, ' ').slice(0, 20000);
    var raiz = document.body;
    var inicio = null;
    if ((window.scrollY || document.documentElement.scrollTop) > 80) {
      for (var i = 0; i < secoes.length; i++) {
        var r = secoes[i].el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > 80) { inicio = secoes[i].el; break; }
      }
    }
    var partes = [], comecou = !inicio;
    (function andar(n){
      if (n === inicio) comecou = true;
      if (n.nodeType === 3) { if (comecou) partes.push(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName.toUpperCase();
      if (PULAR.test(tag)) return;
      if (n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true') return;
      if (n.classList && n.classList.contains('cc-marca')) return;
      if (tag === 'DETAILS' && !n.open) {
        /* gabarito fechado: lê só a pergunta do <summary>, nunca a resposta */
        var sm = n.querySelector('summary');
        var tx = sm ? sm.textContent.trim() : '';
        if (comecou && tx && !/^ver respostas?$/i.test(tx)) partes.push(' ' + tx + '. ');
        return;
      }
      if (n.getClientRects().length === 0) return;
      if (tag === 'IMG') { var alt = (n.getAttribute('alt') || '').trim(); if (alt && comecou) partes.push(' Imagem: ' + alt + '. '); return; }
      if (tag === 'SVG') { var rot = (n.getAttribute('aria-label') || '').trim(); if (rot && comecou) partes.push(' ' + rot + '. '); return; }
      for (var c = n.firstChild; c; c = c.nextSibling) andar(c);
      if (comecou && BLOCO.test(tag)) partes.push('. ');
    })(raiz);
    return partes.join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/([.!?:;,])(\s*\.)+/g, '$1')
      .replace(/^[\s.]+/, '')
      .trim()
      .slice(0, 20000);
  }

  /* Preferências do painel Allyada do portal (fonte, espaçamento, contraste, foco...) */
  var classesAlly = [];
  function aplicarAcessibilidade(d){
    var html = document.documentElement;
    classesAlly.forEach(function(c){ html.classList.remove(c); });
    classesAlly = (d.classes || []).filter(function(c){ return /^ally-[a-z0-9-]+$/.test(c); });
    classesAlly.forEach(function(c){ html.classList.add(c); });
    var st = document.getElementById('cc-ally-css');
    if (!st) { st = document.createElement('style'); st.id = 'cc-ally-css'; document.head.appendChild(st); }
    var css = String(d.css || '') + '\n' + String(d.dinamico || '');
    if (st.textContent !== css) st.textContent = css;
    html.style.setProperty('--allyada-highlight-color', String(d.cor || '#f59e0b'));
    escalarFonte(Number(d.fator) || 1);
  }
  var SELETOR_TEXTO = 'p, h1, h2, h3, h4, h5, h6, a, span, li, button, input, textarea, select, label, blockquote, figcaption, td, th, kbd, dt, dd, summary, code, pre, div';
  var fatorAtual = 1;
  function temTextoProprio(el){
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  }
  function escalarFonte(f){
    if (f === 1 && fatorAtual === 1) return;
    fatorAtual = f;
    var marcados = document.body.querySelectorAll('[data-cc-fonte]');
    /* 1) volta todos ao tamanho original, para medir os novos sem somar o aumento do pai */
    Array.prototype.forEach.call(marcados, function(el){ el.style.fontSize = el.dataset.ccFonteInline || ''; });
    if (f === 1) {
      Array.prototype.forEach.call(marcados, function(el){ delete el.dataset.ccFonte; delete el.dataset.ccFonteInline; });
      return;
    }
    /* 2) mede os elementos que ainda não foram medidos */
    var todos = Array.prototype.filter.call(document.body.querySelectorAll(SELETOR_TEXTO), function(el){
      if (el.classList.contains('cc-marca')) return false;
      return el.tagName !== 'DIV' || temTextoProprio(el);
    });
    todos.forEach(function(el){
      if (!el.dataset.ccFonte) { el.dataset.ccFonteInline = el.style.fontSize || ''; el.dataset.ccFonte = getComputedStyle(el).fontSize; }
    });
    /* 3) aplica o fator sobre o tamanho original de cada um */
    todos.forEach(function(el){
      var px = parseFloat(el.dataset.ccFonte);
      if (px > 0) el.style.fontSize = (px * f).toFixed(1) + 'px';
    });
  }
  /* Conteúdo criado depois (ex.: treinos em JS) também recebe o tamanho escolhido */
  var fonteAgendada = null;
  new MutationObserver(function(){
    if (fatorAtual === 1 || fonteAgendada) return;
    fonteAgendada = setTimeout(function(){ fonteAgendada = null; escalarFonte(fatorAtual); }, 150);
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* Alt + A abre o painel de acessibilidade do portal mesmo com o foco no conteúdo */
  document.addEventListener('keydown', function(e){
    if (e.altKey && !e.ctrlKey && !e.metaKey && String(e.key).toLowerCase() === 'a') {
      e.preventDefault();
      enviar({ tipo: 'atalho-acessibilidade' });
    }
  });

  /* links: externos em nova aba, internos (/c/...) pelo roteador do portal */
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') {
      /* O srcdoc herda o endereço do portal: sem isto, "#c3" carregaria o portal dentro do iframe. */
      e.preventDefault();
      var id = href.slice(1);
      try { id = decodeURIComponent(id); } catch (err) {}
      var alvo = id ? (document.getElementById(id) || document.getElementsByName(id)[0]) : null;
      if (alvo) alvo.scrollIntoView();
      else if (!id) window.scrollTo(0, 0);
      return;
    }
    if (/^(https?:)?\/\//i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; return; }
    if (href.charAt(0) === '/') { e.preventDefault(); enviar({ tipo: 'navegar', href: href }); }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();`;
