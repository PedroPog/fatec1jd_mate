import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConteudoService } from '../../core/conteudo.service';
import { Conteudo } from '../../core/modelos';
import { mensagemErro } from '../../core/util';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <header class="cabeca">
        <h1>Conteúdos</h1>
        <p class="lead">Resumos e exercícios das matérias. Em cada seção dá para deixar uma dúvida, e o fórum reúne as conversas maiores.</p>
      </header>

      <div class="filtros">
        <label class="campo busca">
          <span>Buscar</span>
          <input type="search" [value]="busca()" (input)="busca.set($any($event.target).value)" placeholder="título, tag ou descrição">
        </label>
        @if (materias().length > 1) {
          <div class="linha" role="group" aria-label="Matéria">
            <button class="chip" [attr.aria-pressed]="!materia()" (click)="materia.set(null)">Todas as matérias</button>
            @for (m of materias(); track m) {
              <button class="chip" [attr.aria-pressed]="materia() === m" (click)="materia.set(m)">{{ m }}</button>
            }
          </div>
        }
        @if (tags().length) {
          <div class="linha" role="group" aria-label="Tags">
            @for (t of tags(); track t) {
              <button class="chip" [attr.aria-pressed]="tag() === t" (click)="tag.set(tag() === t ? null : t)">#{{ t }}</button>
            }
          </div>
        }
      </div>

      @if (erro()) {
        <p class="erro">{{ erro() }}</p>
      } @else if (lista() === null) {
        <p class="carregando">Carregando conteúdos…</p>
      } @else if (!lista()!.length) {
        <div class="cartao vazio-cartao">
          <p><b>Nenhum conteúdo publicado ainda.</b></p>
          @if (auth.admin()) {
            <a class="btn" routerLink="/admin/novo">Publicar o primeiro conteúdo</a>
          } @else {
            <p class="muted small">Assim que houver material, ele aparece aqui.</p>
          }
        </div>
      } @else {
        @for (grupo of grupos(); track grupo.materia) {
          <section class="grupo">
            <h2>{{ grupo.materia }}</h2>
            <div class="cards">
              @for (c of grupo.itens; track c.slug) {
                <a class="card" [routerLink]="['/c', c.slug]">
                  <span class="t">{{ c.titulo }}</span>
                  @if (c.descricao) { <span class="small muted">{{ c.descricao }}</span> }
                  <span class="linha">
                    @for (t of c.tags; track t) { <span class="tag">{{ t }}</span> }
                  </span>
                  <span class="rodape small muted">{{ c.secoes.length }} seções</span>
                </a>
              }
            </div>
          </section>
        } @empty {
          <p class="vazio">Nada encontrado com esse filtro.</p>
        }
      }
    </div>
  `,
  styles: `
    .cabeca { margin-bottom: 20px; }
    .filtros { display: grid; gap: 10px; margin-bottom: 28px; }
    .busca { max-width: 420px; }
    .grupo { margin-bottom: 36px; }
    .cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .card {
      display: grid; gap: 8px; align-content: start; text-decoration: none; color: var(--ink);
      background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 16px 18px;
      transition: border-color .15s, transform .15s;
    }
    .card:hover { border-color: var(--pen); transform: translateY(-2px); }
    .card .t { font-family: Kalam, cursive; font-weight: 700; font-size: 1.3rem; line-height: 1.15; color: var(--pen); }
    .rodape { margin-top: 2px; }
    .vazio-cartao { max-width: 520px; display: grid; gap: 8px; justify-items: start; }
  `,
})
export class Inicio {
  protected auth = inject(AuthService);
  private conteudos = inject(ConteudoService);

  protected lista = signal<Conteudo[] | null>(null);
  protected erro = signal('');
  protected busca = signal('');
  protected materia = signal<string | null>(null);
  protected tag = signal<string | null>(null);

  protected materias = computed(() => [...new Set((this.lista() ?? []).map((c) => c.materia))].sort());
  protected tags = computed(() => {
    const base = (this.lista() ?? []).filter((c) => !this.materia() || c.materia === this.materia());
    return [...new Set(base.flatMap((c) => c.tags))].sort();
  });

  protected filtrados = computed(() => {
    const q = this.busca().trim().toLowerCase();
    return (this.lista() ?? []).filter(
      (c) =>
        (!this.materia() || c.materia === this.materia()) &&
        (!this.tag() || c.tags.includes(this.tag()!)) &&
        (!q || [c.titulo, c.descricao, ...c.tags].join(' ').toLowerCase().includes(q)),
    );
  });

  protected grupos = computed(() => {
    const mapa = new Map<string, Conteudo[]>();
    for (const c of this.filtrados()) mapa.set(c.materia, [...(mapa.get(c.materia) ?? []), c]);
    return [...mapa.entries()].map(([materia, itens]) => ({ materia, itens }));
  });

  constructor() {
    this.conteudos
      .carregarPublicados(true)
      .then((l) => this.lista.set(l))
      .catch((e) => this.erro.set(mensagemErro(e)));
  }
}
