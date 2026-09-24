import { analisar, montarDocumento, removerLigacoesLocais } from './documento';

describe('documento', () => {
  const completo = `<!doctype html><html><head><title>Conjuntos</title>
    <meta name="materia" content="Matemática Discreta"><meta name="tags" content="conjuntos, lógica"><meta name="ordem" content="2"></head>
    <body><header>x</header><section id="c1"><h3><span>1.1</span>O que é</h3></section>
    <script>var a = 1;</script></body></html>`;

  it('lê título, metas e seções', () => {
    const a = analisar({ html: completo, css: '', js: '' });
    expect(a.titulo).toBe('Conjuntos');
    expect(a.materia).toBe('Matemática Discreta');
    expect(a.tags).toEqual(['conjuntos', 'lógica']);
    expect(a.ordem).toBe(2);
    expect(a.completo).toBe(true);
    expect(a.secoes).toEqual([{ id: 'c1', titulo: '1.1 O que é' }]);
  });

  it('gera ids a partir de h2/h3 quando não há seções', () => {
    const a = analisar({ html: '<h2>Explicação</h2><h2>Explicação</h2><section id="card"></section>', css: '', js: '' });
    expect(a.secoes.map((s) => s.id)).toEqual(['sec-explicacao', 'sec-explicacao-2']);
  });

  it('avisa sobre caminhos relativos e uso de localStorage', () => {
    const a = analisar({ html: '<img src="img/foto.png"><img src="https://x.com/a.png">', css: '', js: 'localStorage.getItem("k")' });
    expect(a.avisos.some((t) => t.includes('img/foto.png'))).toBe(true);
    expect(a.avisos.some((t) => t.includes('x.com'))).toBe(false);
    expect(a.infos.some((t) => t.includes('localStorage'))).toBe(true);
  });

  it('põe a ponte no <head> (não no <header>), CSS antes de </head> e JS antes de </body>', () => {
    const doc = montarDocumento({ html: completo, css: 'body{color:red}', js: 'console.log(1)</script>' }, { storage: { k: '$&' }, secaoInicial: 'c1' });
    const head = doc.indexOf('<head>');
    const ponte = doc.indexOf('var CFG =');
    expect(ponte).toBeGreaterThan(head);
    expect(ponte).toBeLessThan(doc.indexOf('<header>'));
    expect(doc.indexOf('<style>body{color:red}</style>')).toBeLessThan(doc.indexOf('</head>'));
    expect(doc.lastIndexOf('console.log(1)<\\/script>')).toBeLessThan(doc.lastIndexOf('</body>'));
    expect(doc).toContain('"k":"$&"');
    expect(doc).toContain('"secaoInicial":"c1"');
  });

  it('embrulha trechos de HTML num documento', () => {
    const doc = montarDocumento({ html: '<p>oi</p>', css: '', js: '' }, { storage: {}, secaoInicial: null });
    expect(doc.startsWith('<!doctype html>')).toBe(true);
    expect(doc).toContain('<body><p>oi</p></body>');
  });

  it('remove ligações locais para CSS/JS, mas mantém as externas', () => {
    const html = '<head><link rel="stylesheet" href="estilo.css"><link href="https://fonts.googleapis.com/x" rel="stylesheet">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com"><script src="app.js" defer></script>' +
      '<script src="https://cdn.example.com/lib.js"></script></head>';
    const r = removerLigacoesLocais(html);
    expect(r).not.toContain('estilo.css');
    expect(r).not.toContain('app.js');
    expect(r).toContain('fonts.googleapis.com');
    expect(r).toContain('lib.js');
    expect(r).toContain('preconnect');
  });

  it('pede os campos CSS/JS quando o HTML aponta para arquivos locais', () => {
    const html = '<head><link rel="stylesheet" href="a.css"><script src="a.js"></script></head><body></body>';
    expect(analisar({ html, css: '', js: '' }).avisos.length).toBe(2);
    const ok = analisar({ html, css: 'body{}', js: 'var x;' });
    expect(ok.avisos.length).toBe(0);
    expect(ok.infos.some((t) => t.includes('a.css'))).toBe(true);
  });
});
