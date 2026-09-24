/* Treino interativo da Unit 2 (Work and Leisure).
   No portal, o localStorage é salvo na conta de quem estiver logado. */
(function () {
  'use strict';

  var QUIZZES = {
    preposicoes: {
      titulo: 'at, on, in ou nada?',
      tipo: 'opcoes',
      opcoes: ['at', 'on', 'in', '—'],
      itens: [
        { antes: 'The meeting starts', depois: '9:15.', r: 'at', dica: 'hora → at' },
        { antes: 'We have a staff party', depois: 'December.', r: 'in', dica: 'mês → in' },
        { antes: 'I visit my parents', depois: 'Sundays.', r: 'on', dica: 'dia da semana → on' },
        { antes: 'She is on holiday', depois: 'the moment.', r: 'at', dica: 'at the moment é expressão fixa' },
        { antes: 'They travel to Rio', depois: 'next week.', r: '—', dica: 'antes de next não vai preposição' },
        { antes: 'He usually goes jogging', depois: 'the morning.', r: 'in', dica: 'parte do dia → in' },
        { antes: 'The office is closed', depois: 'Friday afternoon.', r: 'on', dica: 'com o dia (Friday) manda o on' },
        { antes: 'My sister was born', depois: '2003.', r: 'in', dica: 'ano → in' },
        { antes: 'I never work', depois: 'the weekend.', r: 'at', dica: 'at the weekend (inglês britânico)' },
        { antes: 'We go to the gym', depois: 'every Tuesday.', r: '—', dica: 'antes de every não vai preposição' },
        { antes: 'The train leaves', depois: 'ten minutes.', r: 'in', dica: 'in + período = daqui a' },
        { antes: 'My exam is', depois: '4 June.', r: 'on', dica: 'data → on' },
        { antes: 'I can’t sleep', depois: 'night.', r: 'at', dica: 'at night é expressão fixa' },
        { antes: 'It is very cold here', depois: 'the winter.', r: 'in', dica: 'estação → in' }
      ]
    },
    ortografia: {
      titulo: 'Escreva o verbo com he / she / it',
      tipo: 'escrever',
      itens: [
        { antes: 'She', verbo: 'watch', depois: 'the news every evening.', r: 'watches', dica: '-ch → -es' },
        { antes: 'My brother', verbo: 'study', depois: 'at night.', r: 'studies', dica: 'consoante + y → -ies' },
        { antes: 'He', verbo: 'play', depois: 'chess on Saturdays.', r: 'plays', dica: 'vogal + y → só -s' },
        { antes: 'The bus', verbo: 'go', depois: 'to the city centre.', r: 'goes', dica: 'go → goes' },
        { antes: 'Anna', verbo: 'have', depois: 'lunch at one.', r: 'has', dica: 'have → has' },
        { antes: 'The shop', verbo: 'close', depois: 'at 6 p.m.', r: 'closes', dica: 'regra geral: + s' },
        { antes: 'He', verbo: 'finish', depois: 'work at five.', r: 'finishes', dica: '-sh → -es' },
        { antes: 'She', verbo: 'enjoy', depois: 'her job.', r: 'enjoys', dica: 'vogal + y → só -s' },
        { antes: 'Tom', verbo: 'fly', depois: 'to Lisbon twice a month.', r: 'flies', dica: 'consoante + y → -ies' },
        { antes: 'My boss', verbo: 'discuss', depois: 'the plans with us.', r: 'discusses', dica: '-ss → -es' },
        { antes: 'He', verbo: 'do', depois: 'the shopping on Fridays.', r: 'does', dica: 'do → does' },
        { antes: 'She', verbo: 'relax', depois: 'in the garden.', r: 'relaxes', dica: '-x → -es' }
      ]
    },
    ordem: {
      titulo: 'Qual frase está certa?',
      tipo: 'lista',
      itens: [
        { opcoes: ['She works always late.', 'She always works late.', 'Always she work late.'], r: 1, dica: 'advérbio antes do verbo principal' },
        { opcoes: ['They are never at home on Sundays.', 'They never are at home on Sundays.', 'They are at home never on Sundays.'], r: 0, dica: 'com am/is/are, o advérbio vem depois' },
        { opcoes: ['He doesn’t works on Mondays.', 'He don’t work on Mondays.', 'He doesn’t work on Mondays.'], r: 2, dica: 'doesn’t + verbo base' },
        { opcoes: ['What time you get up?', 'What time do you get up?', 'What time does you get up?'], r: 1, dica: 'palavra de pergunta + do + sujeito + verbo' },
        { opcoes: ['How often does she travel abroad?', 'How often she travels abroad?', 'How often does she travels abroad?'], r: 0, dica: 'does + verbo base (sem -s)' },
        { opcoes: ['I have often lunch with colleagues.', 'I often have lunch with colleagues.', 'Often I lunch have with colleagues.'], r: 1, dica: 'sujeito + frequência + verbo + resto' },
        { opcoes: ['We go to the gym twice a week.', 'We twice a week go to the gym.', 'We go twice to the gym a week.'], r: 0, dica: 'expressão longa de frequência vai no fim' },
        { opcoes: ['I enjoy to sail at the weekend.', 'I enjoy sailing at the weekend.', 'I enjoy sail at the weekend.'], r: 1, dica: 'enjoy + -ing' },
        { opcoes: ['Do you usually go to work by car?', 'Do you go usually to work by car?', 'Usually do you go to work by car?'], r: 0, dica: 'na pergunta, o advérbio fica entre o sujeito e o verbo' }
      ]
    }
  };

  // ---- recorde salvo (localStorage pode não existir: tudo em try/catch) ----
  var CHAVE = 'unit2-treino';
  function lerRecordes() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch (e) { return {}; }
  }
  function salvarRecorde(id, pontos) {
    var r = lerRecordes();
    if (!r[id] || pontos > r[id]) {
      r[id] = pontos;
      try { localStorage.setItem(CHAVE, JSON.stringify(r)); } catch (e) { /* segue sem salvar */ }
    }
  }

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return n;
  }

  function normalizar(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function montar(caixa) {
    var id = caixa.getAttribute('data-quiz');
    var q = QUIZZES[id];
    if (!q) return;
    caixa.innerHTML = '';
    var total = q.itens.length;
    var respondidos = 0;
    var acertos = 0;

    var placar = el('span', { class: 'placar' });
    function atualizarPlacar() {
      var rec = lerRecordes()[id];
      placar.textContent = acertos + ' de ' + total + ' certas' +
        (respondidos === total ? ' · terminou!' : '') +
        (rec ? ' · recorde: ' + rec : '');
    }
    caixa.appendChild(el('div', { class: 'treino-topo' }, [el('h4', { text: q.titulo }), placar]));

    function registrar(certo, fb, dica, resposta) {
      respondidos++;
      if (certo) acertos++;
      fb.className = 'fb ' + (certo ? 'certo' : 'errado');
      fb.textContent = certo ? 'Certo! ' + dica + '.' : 'Resposta: ' + resposta + ' (' + dica + ').';
      if (respondidos === total) salvarRecorde(id, acertos);
      atualizarPlacar();
    }

    q.itens.forEach(function (it, i) {
      var item = el('div', { class: 'item' });
      var fb = el('p', { class: 'fb', 'aria-live': 'polite' });

      if (q.tipo === 'opcoes') {
        var lacuna = el('span', { class: 'lacuna', text: '___' });
        item.appendChild(el('div', { class: 'frase' }, [(i + 1) + '. ' + it.antes + ' ', lacuna, ' ' + it.depois]));
        var grupo = el('div', { class: 'opcoes', role: 'group', 'aria-label': 'Opções da frase ' + (i + 1) });
        q.opcoes.forEach(function (op) {
          var b = el('button', { type: 'button', text: op });
          b.addEventListener('click', function () {
            var certo = op === it.r;
            Array.prototype.forEach.call(grupo.children, function (x) {
              x.disabled = true;
              if (x.textContent === it.r) x.classList.add('certo');
            });
            if (!certo) b.classList.add('errado');
            lacuna.textContent = it.r;
            registrar(certo, fb, it.dica, it.r);
          });
          grupo.appendChild(b);
        });
        item.appendChild(grupo);
      } else if (q.tipo === 'escrever') {
        var idCampo = 'q-' + id + '-' + i;
        item.appendChild(el('label', { class: 'frase', for: idCampo }, [(i + 1) + '. ' + it.antes + ' (' + it.verbo + ') ' + it.depois]));
        var campo = el('input', { id: idCampo, type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: it.verbo + '…' });
        var botao = el('button', { type: 'button', text: 'Conferir' });
        function conferir() {
          if (campo.disabled || !campo.value.trim()) return;
          var certo = normalizar(campo.value) === it.r;
          campo.disabled = true;
          botao.disabled = true;
          campo.classList.add(certo ? 'certo' : 'errado');
          registrar(certo, fb, it.dica, it.r);
        }
        botao.addEventListener('click', conferir);
        campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') conferir(); });
        item.appendChild(el('div', { class: 'escrever' }, [campo, botao]));
      } else {
        item.appendChild(el('div', { class: 'frase', text: (i + 1) + '.' }));
        var lista = el('div', { class: 'opcoes lista', role: 'group', 'aria-label': 'Frases do item ' + (i + 1) });
        it.opcoes.forEach(function (op, j) {
          var b = el('button', { type: 'button', text: op });
          b.addEventListener('click', function () {
            var certo = j === it.r;
            Array.prototype.forEach.call(lista.children, function (x, k) {
              x.disabled = true;
              if (k === it.r) x.classList.add('certo');
            });
            if (!certo) b.classList.add('errado');
            registrar(certo, fb, it.dica, it.opcoes[it.r]);
          });
          lista.appendChild(b);
        });
        item.appendChild(lista);
      }
      item.appendChild(fb);
      caixa.appendChild(item);
    });

    var refazer = el('button', { type: 'button', class: 'refazer', text: 'Refazer' });
    refazer.addEventListener('click', function () { montar(caixa); });
    caixa.appendChild(refazer);
    atualizarPlacar();
  }

  function iniciar() {
    Array.prototype.forEach.call(document.querySelectorAll('.treino[data-quiz]'), montar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
