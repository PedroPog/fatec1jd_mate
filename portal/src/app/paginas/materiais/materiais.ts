import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConteudoService } from '../../core/conteudo.service';
import { MaterialService } from '../../core/material.service';
import { Material } from '../../core/modelos';
import { mensagemErro, tamanhoLegivel } from '../../core/util';

const ROTULO: Record<string, string> = { pdf: 'PDF', link: 'Link', video: 'Vídeo', imagem: 'Imagem' };

@Component({
  selector: 'app-materiais',
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <h1>Material de apoio</h1>
      <p class="lead">PDFs das aulas, links e vídeos organizados por matéria.</p>

      @if (materias().length > 1) {
        <div class="linha filtros" role="group" aria-label="Matéria">
          <button class="chip" [attr.aria-pressed]="!materia()" (click)="materia.set(null)">Todas</button>
          @for (m of materias(); track m) {
            <button class="chip" [attr.aria-pressed]="materia() === m" (click)="materia.set(m)">{{ m }}</button>
          }
        </div>
      }

      @if (erro()) {
        <p class="erro">{{ erro() }}</p>
      } @else if (lista() === null) {
        <p class="carregando">Carregando…</p>
      } @else {
        @for (g of grupos(); track g.materia) {
          <section class="grupo">
            <h2>{{ g.materia }}</h2>
            <ul class="itens">
              @for (m of g.itens; track m.id) {
                <li class="cartao item">
                  <span class="tipo" [attr.data-tipo]="m.tipo">{{ rotulo[m.tipo] }}</span>
                  <div class="info">
                    <a [href]="m.url" target="_blank" rel="noopener" class="t">{{ m.titulo }}</a>
                    @if (m.descricao) { <span class="small">{{ m.descricao }}</span> }
                    <span class="small muted">
                      @if (m.tamanho) { {{ tamanho(m.tamanho) }} }
                      @if (m.conteudoId && tituloDe(m.conteudoId)) {
                        · ligado a <a [routerLink]="['/c', m.conteudoId]">{{ tituloDe(m.conteudoId) }}</a>
                      }
                    </span>
                  </div>
                </li>
              }
            </ul>
          </section>
        } @empty {
          <p class="vazio">Nenhum material cadastrado ainda.</p>
        }
      }
    </div>
  `,
  styles: `
    .filtros { margin: 8px 0 24px; }
    .grupo { margin-bottom: 32px; }
    .itens { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .item { display: flex; gap: 14px; align-items: flex-start; }
    .tipo { font-family: "JetBrains Mono", monospace; font-size: .72rem; font-weight: 600; padding: 3px 8px; border-radius: 4px; background: var(--pen-soft); color: var(--pen); flex: none; min-width: 58px; text-align: center; }
    .tipo[data-tipo="pdf"] { background: var(--red-soft); color: var(--red); }
    .info { display: grid; gap: 2px; min-width: 0; }
    .t { font-weight: 700; overflow-wrap: anywhere; }
  `,
})
export class Materiais {
  private materiaisSrv = inject(MaterialService);
  private conteudos = inject(ConteudoService);

  protected lista = signal<Material[] | null>(null);
  protected erro = signal('');
  protected materia = signal<string | null>(null);
  protected rotulo = ROTULO;
  protected tamanho = tamanhoLegivel;

  protected materias = computed(() => [...new Set((this.lista() ?? []).map((m) => m.materia))].sort());
  protected grupos = computed(() => {
    const mapa = new Map<string, Material[]>();
    for (const m of this.lista() ?? []) {
      if (this.materia() && m.materia !== this.materia()) continue;
      mapa.set(m.materia, [...(mapa.get(m.materia) ?? []), m]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([materia, itens]) => ({ materia, itens }));
  });

  constructor() {
    this.materiaisSrv.listar().then((l) => this.lista.set(l)).catch((e) => this.erro.set(mensagemErro(e)));
    this.conteudos.carregarPublicados().catch(() => {});
  }

  protected tituloDe(slug: string): string {
    return this.conteudos.publicados()?.find((c) => c.slug === slug)?.titulo ?? '';
  }
}
