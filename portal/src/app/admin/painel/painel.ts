import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConteudoService } from '../../core/conteudo.service';
import { Conteudo } from '../../core/modelos';
import { mensagemErro, tamanhoLegivel } from '../../core/util';

@Component({
  selector: 'app-painel',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="pagina">
      <div class="linha entre cabeca">
        <div>
          <h1>Admin</h1>
          <p class="muted">Conteúdos publicados e rascunhos. Só administradores veem esta área.</p>
        </div>
        <div class="linha">
          <a class="btn sec" routerLink="/admin/materiais">Material de apoio</a>
          <a class="btn" routerLink="/admin/novo">Novo conteúdo</a>
        </div>
      </div>

      @if (erro()) { <p class="erro" role="alert">{{ erro() }}</p> }

      @if (lista() === null) {
        <p class="carregando">Carregando…</p>
      } @else if (!lista()!.length) {
        <div class="cartao pilha" style="max-width:560px">
          <p><b>Nenhum conteúdo ainda.</b> Comece enviando o HTML de uma matéria, por exemplo o resumo de Conjuntos e Lógica.</p>
          <a class="btn" routerLink="/admin/novo" style="justify-self:start">Novo conteúdo</a>
        </div>
      } @else {
        <div class="tabela">
          <table>
            <thead>
              <tr><th>Título</th><th>Matéria</th><th>Situação</th><th class="num">Versão</th><th class="num">Tamanho</th><th>Atualizado</th><th>Ações</th></tr>
            </thead>
            <tbody>
              @for (c of lista(); track c.slug) {
                <tr>
                  <td><b>{{ c.titulo }}</b><br><span class="small muted mono">/c/{{ c.slug }}</span></td>
                  <td>{{ c.materia }}</td>
                  <td>
                    @if (c.publicado) { <span class="selo ok">publicado</span> } @else { <span class="selo rascunho">rascunho</span> }
                  </td>
                  <td class="num">{{ c.versao }}</td>
                  <td class="num">{{ tamanho(c.tamanho) }}</td>
                  <td class="small">{{ c.atualizadoEm?.toDate() | date: 'dd/MM/yy HH:mm' }}</td>
                  <td>
                    <div class="linha acoes">
                      <a [routerLink]="['/c', c.slug]">Abrir</a>
                      <a [routerLink]="['/admin/editar', c.slug]">Editar</a>
                      <button class="btn link" (click)="alternar(c)">{{ c.publicado ? 'Despublicar' : 'Publicar' }}</button>
                      @if (confirmando() === c.slug) {
                        <button class="btn link perigo" (click)="excluir(c)">Excluir mesmo</button>
                        <button class="btn link" (click)="confirmando.set(null)">Cancelar</button>
                      } @else {
                        <button class="btn link perigo" (click)="confirmando.set(c.slug)">Excluir</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="small muted">Excluir remove o conteúdo e as versões antigas. As dúvidas ligadas a ele ficam no Firestore, mas deixam de aparecer.</p>
      }
    </div>
  `,
  styles: `
    .cabeca { margin-bottom: 20px; align-items: flex-end; }
    .acoes { gap: 12px; font-size: .88rem; }
    .perigo { color: var(--red) !important; }
  `,
})
export class Painel {
  private conteudos = inject(ConteudoService);
  protected lista = signal<Conteudo[] | null>(null);
  protected erro = signal('');
  protected confirmando = signal<string | null>(null);
  protected tamanho = tamanhoLegivel;

  constructor() {
    this.carregar();
  }

  private carregar() {
    this.conteudos.listarTodos().then((l) => this.lista.set(l)).catch((e) => this.erro.set(mensagemErro(e)));
  }

  protected async alternar(c: Conteudo) {
    try {
      await this.conteudos.definirPublicado(c.slug, !c.publicado);
      this.carregar();
    } catch (e) {
      this.erro.set(mensagemErro(e));
    }
  }

  protected async excluir(c: Conteudo) {
    this.confirmando.set(null);
    try {
      await this.conteudos.excluir(c.slug);
      this.carregar();
    } catch (e) {
      this.erro.set(mensagemErro(e));
    }
  }
}
