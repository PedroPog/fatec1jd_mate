import { Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensagemErro } from '../../core/util';

@Component({
  selector: 'app-entrar',
  template: `
    <div class="pagina estreita">
      <div class="cartao pilha caixa">
        <h1>Entrar</h1>
        @if (auth.logado() && !auth.admin() && voltar()?.startsWith('/admin')) {
          <p>Você entrou como <b>{{ auth.usuario()?.email }}</b>, mas esta conta não é administradora.</p>
          <p class="small muted">Para liberar, crie no Firestore o documento <code>admins/{{ auth.usuario()?.uid }}</code> (pode ficar vazio). Depois recarregue a página.</p>
          <button class="btn sec" (click)="copiar()">{{ copiado() ? 'UID copiado' : 'Copiar meu UID' }}</button>
        } @else {
          <p>Use sua conta Google para perguntar, comentar no fórum e salvar seu progresso nos exercícios.</p>
          <button class="btn" (click)="entrar()">Entrar com Google</button>
        }
        @if (erro()) { <p class="erro">{{ erro() }}</p> }
      </div>
    </div>
  `,
  styles: `.caixa { max-width: 520px; margin: 24px auto; justify-items: start; }`,
})
export class Entrar {
  readonly voltar = input<string | undefined>();
  protected auth = inject(AuthService);
  private router = inject(Router);
  protected erro = signal('');
  protected copiado = signal(false);

  constructor() {
    effect(() => {
      if (!this.auth.pronto() || !this.auth.logado()) return;
      const destino = this.voltar() ?? '/';
      if (!destino.startsWith('/admin') || this.auth.admin()) this.router.navigateByUrl(destino);
    });
  }

  protected async entrar() {
    this.erro.set('');
    try {
      await this.auth.entrar();
    } catch (e) {
      this.erro.set(mensagemErro(e));
    }
  }

  protected copiar() {
    const uid = this.auth.usuario()?.uid ?? '';
    navigator.clipboard?.writeText(uid).then(() => this.copiado.set(true)).catch(() => {});
  }
}
