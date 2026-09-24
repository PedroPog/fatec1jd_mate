# Caderno Central

Portal de estudos em Angular 22 + Firebase. Cada conteúdo é uma página criada na hora a partir do HTML/CSS/JS enviado na área de admin. Em cada seção dá para deixar dúvidas e anotações, o fórum pede login para escrever e os PDFs das aulas sobem pelo admin para o Cloud Storage.

## O que tem

| Rota | Tela |
| --- | --- |
| `/` | Conteúdos publicados, agrupados por matéria, com busca e filtro por tag |
| `/c/:slug` | Leitor: a página da matéria num iframe isolado + painel de dúvidas e material de apoio |
| `/forum`, `/forum/t/:id` | Tópicos por matéria e respostas |
| `/apoio` | PDFs, links e vídeos por matéria |
| `/admin` | Lista de conteúdos, publicar/despublicar, excluir |
| `/admin/novo`, `/admin/editar/:slug` | Envio de HTML/CSS/JS, verificação, pré-visualização, versões, imagens |
| `/admin/materiais` | Envio de PDFs (vários de uma vez, com progresso), links e vídeos |

## Requisitos

- Node `22.22.3+` ou `24.15+` (exigência do Angular 22). Veja com `node -v`.
- Um projeto Firebase no plano **Blaze** (o Cloud Storage exige).

## Configurar pela primeira vez

1. **Instalar dependências**

   ```bash
   npm install
   ```

2. **No console do Firebase** (<https://console.firebase.google.com>), no seu projeto:
   - *Authentication* → *Método de login* → ative **Google**.
   - *Firestore Database* → criar banco em **modo de produção** (região sugerida: `southamerica-east1`).
   - *Storage* → criar bucket (mesma região).
   - *Configurações do projeto* → *Seus apps* → adicione um **App da Web** e copie o objeto `firebaseConfig`.

3. **Colar a configuração** em `src/environments/environment.ts` e trocar o id em `.firebaserc`:

   ```json
   { "projects": { "default": "id-do-seu-projeto" } }
   ```

4. **Publicar as regras de segurança** (Firestore, índices e Storage):

   ```bash
   npx firebase-tools@15 login
   npm run deploy:regras
   ```

   As regras do Storage consultam o Firestore para saber quem é admin. Na primeira vez o CLI pergunta se pode dar essa permissão: responda **sim**.

5. **Rodar localmente**

   ```bash
   npm start
   ```

   Abra <http://localhost:4200> e clique em **Entrar com Google**.

6. **Virar admin**: acesse `/admin`. Como sua conta ainda não é admin, a tela mostra o botão **Copiar meu UID**. No Firestore, crie a coleção `admins` com um documento cujo ID é esse UID (sem campos). Recarregue a página: a aba **Admin** aparece.

7. **Migrar o que já existe** na pasta `mate`:
   - *Admin → Novo conteúdo*: envie `conteudo/Conjuntos e Lógica Proposicional_ resumo para estudar.html`. O título vem do `<title>`; preencha a matéria (ex.: *Matemática Discreta*) e publique. Repita com `Conjuntos e Lógica_ início.html`.
   - *Admin → Material de apoio*: arraste os dois PDFs de `pdf/matematica/`, escolha a matéria e, se quiser, o conteúdo relacionado.

8. **Publicar o site** no Firebase Hosting:

   ```bash
   npm run deploy
   ```

   O endereço fica `https://id-do-seu-projeto.web.app`. Se usar um domínio próprio, adicione-o em *Authentication → Configurações → Domínios autorizados*.

## Como escrever um conteúdo

Qualquer HTML funciona, inclusive com CSS e JS dentro dele, como os resumos atuais. Alguns detalhes ajudam o portal:

```html
<head>
  <title>Conjuntos e Lógica Proposicional</title>
  <!-- opcionais: preenchem o formulário do admin -->
  <meta name="materia"   content="Matemática Discreta">
  <meta name="tags"      content="conjuntos, lógica, resumo">
  <meta name="descricao" content="Resumo das aulas 01 e 02 com exercícios.">
  <meta name="ordem"     content="1"> <!-- posição dentro da matéria -->
</head>
```

- **Seções para dúvidas**: o portal procura, nesta ordem, elementos com `data-secao` e `id`; `<section id="…">` que tenham um título dentro; `h2`/`h3` com `id`; e por fim todos os `h2`/`h3` (gerando ids como `sec-explicacao`). Cada seção ganha um marcador na margem.
- **Mantenha os ids entre versões.** As dúvidas ficam presas ao `id` da seção.
- **Links**: `#c3` rola dentro da página (índices e sumários funcionam); `https://…` abre em nova aba; `/c/outro-conteudo` navega pelo portal.
- **Imagens**: caminhos relativos (`img/foto.png`) não carregam. Envie em *Imagens do conteúdo* no editor e use a URL gerada, ou use URLs completas.
- **localStorage** funciona: a ponte do portal salva esses dados na conta de quem está logado (`progresso/{uid}`), ou no navegador para quem não entrou.
- **Tamanho**: até 1 MB por conteúdo (limite de um documento do Firestore). O editor mostra a barra de uso.

## Como funciona o leitor

O conteúdo roda num `<iframe sandbox="allow-scripts …">` **sem** `allow-same-origin`:

- o CSS do conteúdo não mexe no portal;
- o JS do conteúdo roda, mas não enxerga o login nem o Firestore;
- `src/app/core/documento.ts` monta o documento e injeta a **ponte** (`PONTE_JS`) antes de tudo. A ponte cria os marcadores, substitui o `localStorage`, ignora `history.pushState` (que falha nesse tipo de iframe) e conversa com o Angular por `postMessage`.

## Acessibilidade (Allyada)

O portal traz o painel de acessibilidade [Allyada](https://github.com/sarinha156/allyada) (licença MIT). O botão fica no canto inferior esquerdo e também abre com **Alt + A**.

- A biblioteca fica em `public/vendor/allyada/`, numa versão fixa (commit anotado em `VERSAO.md`), junto com a licença.
- Ela é carregada no `src/index.html` com `data-auto-init="false"` e iniciada pelo `AcessibilidadeService` (`src/app/core/acessibilidade.service.ts`) com as cores do portal.
- Dentro dos conteúdos (iframe do leitor), a ponte aplica as mesmas escolhas: tamanho do texto, espaçamento, fonte Lexend, alinhamento, contraste escuro/claro, destaque de links, foco reforçado, cursor maior e menos movimento. Tons de cinza, inversão e filtros de daltonismo já passam por cima do iframe, então não são repetidos.
- Alt + A funciona mesmo com o foco dentro do conteúdo.
- Ainda **não** alcançam o texto dos conteúdos: "Ouvir página" (lê só o portal), régua/máscara de leitura e teclado virtual.

Para atualizar a biblioteca: troque `public/vendor/allyada/allyada.js` pela nova versão do `dist/`, teste o painel no `/forum` e num conteúdo (`/c/...`) e atualize o `VERSAO.md`.

## Dados no Firebase

| Onde | O quê | Quem escreve |
| --- | --- | --- |
| `conteudos/{slug}` | título, matéria, tags, seções, publicado, versão | admin |
| `corpos/{slug}` | html, css, js | admin |
| `conteudos/{slug}/versoes` | versões anteriores | admin |
| `anotacoes` (+ `/respostas`) | dúvidas (públicas) e anotações (públicas ou privadas) por seção | logado; editar/excluir o autor ou admin |
| `topicos` (+ `/respostas`) | fórum | logado; excluir o autor ou admin |
| `materiais` | PDFs, imagens, links, vídeos | admin |
| `progresso/{uid}/conteudos/{slug}` | o que o JS do conteúdo salvou | o próprio usuário |
| `admins/{uid}` | quem é admin | só pelo console |
| Storage `materiais/…`, `conteudos/{slug}/…` | PDFs e imagens | admin (PDF/imagem até 50 MB) |

As regras estão em `firestore.rules` e `storage.rules`. O guard do Angular só esconde as telas; quem protege os dados são as regras.

## Emuladores (opcional)

Para testar sem mexer nos dados reais: em `environment.ts` coloque `usarEmuladores: true`, rode `npm run emuladores` num terminal e `npm start` em outro. Precisa de Java instalado. No emulador, crie `admins/{uid}` pela interface em <http://localhost:4000>.

## Testes

```bash
npm test
```

Testa a análise e a montagem dos documentos (`src/app/core/documento.spec.ts`).
