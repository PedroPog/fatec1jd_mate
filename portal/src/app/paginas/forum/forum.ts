import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConteudoService } from '../../core/conteudo.service';
import { ForumService, MATERIA_GERAL } from '../../core/forum.service';
import { Topico } from '../../core/modelos';
import { mensagemErro, quando } from '../../core/util';

@Component({
  selector: 'app-forum',
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <h1>Fórum</h1>
      <p class="lead">Conversas por matéria. Qualquer pessoa lê; para criar tópico ou comentar é preciso entrar com Google.</p>

      <div class="linha filtros" role="group" aria-label="Matéria">
        <button class="chip" [attr.aria-pressed]="!materia()" (click)="filtrar(null)">Todas</button>
        @for (m of materias(); track m) {
          <button class="chip" [attr.aria-pressed]="materia() === m" (click)="filtrar(m)">{{ m }}</button>
        }
      </div>

      <div class="grade">
        <section class="lista">
          @if (erro()) {
            <p class="erro">{{ erro() }}</p>
          } @else if (topicos() === null) {
            <p class="carregando">Carregando tópicos…</p>
          } @else {
            @for (t of topicos(); track t.id) {
              <a class="topico" [routerLink]="['/forum/t', t.id]">
                <span class="t">{{ t.titulo }}</span>
                <span class="small muted">{{ t.materia }} · {{ t.autorNome }} · {{ quando(t.ultimaAtividade) }}</span>
                <span class="resp num"><b>{{ t.totalRespostas }}</b>{{ t.totalRespostas === 1 ? 'resposta' : 'respostas' }}</span>
              </a>
            } @empty {
              <p class="vazio">Nenhum tópico {{ materia() ? 'em ' + materia() : '' }} ainda.</p>
            }
          }
        </section>

        <aside class="cartao novo">
          <h2>Novo tópico</h2>
          @if (auth.logado()) {
            <form class="pilha" (submit)="$event.preventDefault(); criar()">
              <label class="campo">Matéria
                <select [value]="materiaNovo()" (change)="materiaNovo.set($any($event.target).value)">
                  @for (m of materias(); track m) { <option [value]="m" [selected]="m === materiaNovo()">{{ m }}</option> }
                </select>
              </label>
              <label class="campo">Título
                <input maxlength="200" [value]="titulo()" (input)="titulo.set($any($event.target).value)" placeholder="Ex.: lista 2, questão 5">
              </label>
              <label class="campo">Mensagem
                <textarea rows="5" maxlength="8000" [value]="texto()" (input)="texto.set($any($event.target).value)"></textarea>
              </label>
              @if (erroForm()) { <p class="erro">{{ erroForm() }}</p> }
              <button class="btn" type="submit" [disabled]="enviando() || !titulo().trim() || !texto().trim()">
                {{ enviando() ? 'Criando…' : 'Criar tópico' }}
              </button>
            </form>
          } @else {
            <p class="small">Entre com sua conta Google para criar tópicos e responder.</p>
            <button class="btn sec" (click)="entrar()">Entrar com Google</button>
            @if (erroForm()) { <p class="erro">{{ erroForm() }}</p> }
          }
        </aside>
      </div>
    </div>
  `,
  styles: `
    .filtros { margin: 8px 0 20px; }
    .grade { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); align-items: start; }
    @media (min-width: 900px) { .grade { grid-template-columns: minmax(0, 1fr) 340px; } }
    .lista { display: grid; gap: 10px; }
    .topico {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 14px; align-items: center;
      background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px;
      text-decoration: none; color: var(--ink);
    }
    .topico:hover { border-color: var(--pen); }
    .topico .t { font-weight: 700; overflow-wrap: anywhere; }
    .resp { grid-row: 1 / span 2; grid-column: 2; text-align: right; font-size: .8rem; color: var(--muted); }
    .resp b { display: block; font-size: 1.15rem; color: var(--ink); }
    .novo { display: grid; gap: 10px; }
    @media (min-width: 900px) { .novo { position: sticky; top: calc(var(--topo) + 16px); } }
  `,
})
export class Forum {
  /** ?materia=... */
  readonly materiaQuery = input<string | undefined>(undefined, { alias: 'materia' });

  protected auth = inject(AuthService);
  private forum = inject(ForumService);
  private conteudos = inject(ConteudoService);
  private router = inject(Router);

  protected materia = computed(() => this.materiaQuery() || null);
  protected topicos = signal<Topico[] | null>(null);
  protected erro = signal('');
  protected materias = computed(() => [MATERIA_GERAL, ...this.conteudos.materias().filter((m) => m !== MATERIA_GERAL)]);

  protected materiaNovo = signal(MATERIA_GERAL);
  protected titulo = signal('');
  protected texto = signal('');
  protected enviando = signal(false);
  protected erroForm = signal('');
  protected quando = quando;

  private parar: (() => void) | null = null;

  constructor() {
    this.conteudos.carregarPublicados().catch(() => {});
    effect(() => {
      const m = this.materia();
      untracked(() => {
        if (m) this.materiaNovo.set(m);
        this.parar?.();
        this.topicos.set(null);
        this.erro.set('');
        this.parar = this.forum.observarTopicos(m, (l) => this.topicos.set(l), (e) => this.erro.set(mensagemErro(e)));
      });
    });
    inject(DestroyRef).onDestroy(() => this.parar?.());
  }

  protected filtrar(m: string | null) {
    this.router.navigate(['/forum'], { queryParams: m ? { materia: m } : {} });
  }

  protected async criar() {
    this.enviando.set(true);
    this.erroForm.set('');
    try {
      const id = await this.forum.criarTopico({ materia: this.materiaNovo(), titulo: this.titulo(), texto: this.texto() });
      this.titulo.set('');
      this.texto.set('');
      this.router.navigate(['/forum/t', id]);
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    } finally {
      this.enviando.set(false);
    }
  }

  protected entrar() {
    this.auth.entrar().catch((e) => this.erroForm.set(mensagemErro(e)));
  }
}
