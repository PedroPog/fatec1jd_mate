import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ForumService } from '../../core/forum.service';
import { Resposta, Topico } from '../../core/modelos';
import { mensagemErro, quando } from '../../core/util';

@Component({
  selector: 'app-topico',
  imports: [RouterLink],
  template: `
    <div class="pagina estreita">
      <p><a [routerLink]="['/forum']" [queryParams]="topico() ? { materia: topico()!.materia } : {}">← Fórum{{ topico() ? ' · ' + topico()!.materia : '' }}</a></p>

      @if (erro()) {
        <p class="aviso">{{ erro() }}</p>
      } @else if (topico() === undefined) {
        <p class="carregando">Carregando…</p>
      } @else if (topico() === null) {
        <p class="aviso">Este tópico não existe mais.</p>
      } @else {
        @let t = topico()!;
        <article class="cartao principal">
          <h1>{{ t.titulo }}</h1>
          <div class="msg">
            @if (t.autorFoto) { <img class="avatar" [src]="t.autorFoto" alt="" referrerpolicy="no-referrer"> }
            @else { <span class="avatar">{{ t.autorNome[0] }}</span> }
            <span class="quem"><b>{{ t.autorNome }}</b> · {{ quando(t.criadoEm) }}</span>
            <p class="texto">{{ t.texto }}</p>
            <div class="acoes">
              @if (t.origem) {
                <a [routerLink]="['/c', t.origem.conteudoId]" [fragment]="t.origem.secaoId === '__pagina' ? undefined : t.origem.secaoId">Ver a seção de origem</a>
              }
              @if (podeExcluir(t.autorUid)) {
                @if (confirmando() === 'topico') {
                  <span>Excluir o tópico?</span>
                  <button class="btn link perigo" (click)="excluirTopico()">Sim, excluir</button>
                  <button class="btn link" (click)="confirmando.set(null)">Não</button>
                } @else {
                  <button class="btn link perigo" (click)="confirmando.set('topico')">Excluir tópico</button>
                }
              }
            </div>
          </div>
        </article>

        <h2 class="contagem">{{ t.totalRespostas }} {{ t.totalRespostas === 1 ? 'resposta' : 'respostas' }}</h2>
        <div class="respostas">
          @for (r of respostas(); track r.id) {
            <div class="msg cartao">
              @if (r.autorFoto) { <img class="avatar" [src]="r.autorFoto" alt="" referrerpolicy="no-referrer"> }
              @else { <span class="avatar">{{ r.autorNome[0] }}</span> }
              <span class="quem"><b>{{ r.autorNome }}</b> · {{ quando(r.criadoEm) }}</span>
              <p class="texto">{{ r.texto }}</p>
              @if (podeExcluir(r.autorUid)) {
                <div class="acoes"><button class="btn link perigo" (click)="excluirResposta(r)">Excluir</button></div>
              }
            </div>
          }
        </div>

        @if (auth.logado()) {
          <form class="pilha responder" (submit)="$event.preventDefault(); responder()">
            <label class="campo">Sua resposta
              <textarea rows="4" maxlength="8000" [value]="texto()" (input)="texto.set($any($event.target).value)"></textarea>
            </label>
            @if (erroForm()) { <p class="erro">{{ erroForm() }}</p> }
            <button class="btn" type="submit" [disabled]="enviando() || !texto().trim()">{{ enviando() ? 'Enviando…' : 'Responder' }}</button>
          </form>
        } @else {
          <div class="cartao linha entre responder">
            <span>Entre para responder este tópico.</span>
            <button class="btn sec" (click)="entrar()">Entrar com Google</button>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .principal h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); }
    .principal .msg { margin-top: 8px; }
    .contagem { font-size: 1.2rem; margin: 28px 0 10px; color: var(--ink); }
    .respostas { display: grid; gap: 10px; }
    .responder { margin-top: 20px; }
    .perigo { color: var(--red); }
    .msg .texto { margin: 4px 0 0; }
  `,
})
export class TopicoPagina {
  readonly id = input.required<string>();

  protected auth = inject(AuthService);
  private forum = inject(ForumService);
  private router = inject(Router);
  private titulo = inject(Title);

  protected topico = signal<Topico | null | undefined>(undefined);
  protected respostas = signal<Resposta[]>([]);
  protected erro = signal('');
  protected texto = signal('');
  protected enviando = signal(false);
  protected erroForm = signal('');
  protected confirmando = signal<string | null>(null);
  protected quando = quando;

  private paradas: (() => void)[] = [];

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.paradas.forEach((p) => p());
        this.paradas = [
          this.forum.observarTopico(id, (t) => {
            this.topico.set(t);
            if (t) this.titulo.setTitle(`${t.titulo} · Fórum`);
          }, (e) => this.erro.set(mensagemErro(e))),
          this.forum.observarRespostas(id, (r) => this.respostas.set(r)),
        ];
      });
    });
    inject(DestroyRef).onDestroy(() => this.paradas.forEach((p) => p()));
  }

  protected podeExcluir(autorUid: string) {
    return this.auth.admin() || this.auth.usuario()?.uid === autorUid;
  }

  protected async responder() {
    this.enviando.set(true);
    this.erroForm.set('');
    try {
      await this.forum.responder(this.id(), this.texto());
      this.texto.set('');
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    } finally {
      this.enviando.set(false);
    }
  }

  protected async excluirTopico() {
    try {
      const materia = this.topico()?.materia;
      await this.forum.excluirTopico(this.id());
      this.router.navigate(['/forum'], { queryParams: materia ? { materia } : {} });
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    }
  }

  protected async excluirResposta(r: Resposta) {
    try {
      await this.forum.excluirResposta(this.id(), r.id);
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    }
  }

  protected entrar() {
    this.auth.entrar().catch((e) => this.erroForm.set(mensagemErro(e)));
  }
}
