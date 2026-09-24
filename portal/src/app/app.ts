import { Component, afterNextRender, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AcessibilidadeService } from './core/acessibilidade.service';
import { AuthService } from './core/auth.service';
import { firebaseConfigurado } from './core/firebase';
import { mensagemErro } from './core/util';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topo">
      <a routerLink="/" class="marca">Caderno Central</a>
      <nav aria-label="Principal">
        <a routerLink="/" routerLinkActive="ativo" [routerLinkActiveOptions]="{ exact: true }">Conteúdos</a>
        <a routerLink="/forum" routerLinkActive="ativo">Fórum</a>
        <a routerLink="/apoio" routerLinkActive="ativo">Material de apoio</a>
        @if (auth.admin()) {
          <a routerLink="/admin" routerLinkActive="ativo" class="adm">Admin</a>
        }
      </nav>
      <div class="conta">
        @if (!auth.pronto()) {
          <span class="muted small">…</span>
        } @else if (auth.usuario(); as u) {
          @if (u.photoURL) {
            <img class="avatar" [src]="u.photoURL" alt="" referrerpolicy="no-referrer">
          } @else {
            <span class="avatar">{{ (u.displayName || '?')[0] }}</span>
          }
          <span class="nome small">{{ u.displayName }}</span>
          <button class="btn sec peq" (click)="sair()">Sair</button>
        } @else {
          <button class="btn sec peq" (click)="entrar()">Entrar com Google</button>
        }
      </div>
    </header>
    @if (!configurado) {
      <p class="aviso" style="margin:0">
        Firebase ainda não configurado. Preencha <code>src/environments/environment.ts</code> com os dados do seu projeto (veja o README).
      </p>
    }
    @if (acessibilidade.aviso()) {
      <p class="aviso info linha entre" style="margin:0" role="status">
        <span>{{ acessibilidade.aviso() }}</span>
        <button class="btn link" (click)="acessibilidade.aviso.set('')">Fechar</button>
      </p>
    }
    @if (erro()) {
      <p class="aviso" style="margin:0" role="alert">{{ erro() }}</p>
    }
    <main><router-outlet /></main>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100%; }
    main { flex: 1; display: flex; flex-direction: column; }
    .topo {
      position: sticky; top: 0; z-index: 20; min-height: var(--topo);
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px;
      padding: 8px 16px; padding-top: calc(8px + env(safe-area-inset-top, 0px));
      background: var(--card); border-bottom: 1px solid var(--line);
    }
    .marca { font-family: Kalam, cursive; font-weight: 700; font-size: 1.4rem; color: var(--pen); text-decoration: none; margin-right: auto; }
    nav { display: flex; gap: 2px; flex-wrap: wrap; }
    nav a { padding: 5px 11px; border-radius: 6px; color: var(--muted); text-decoration: none; font-size: .95rem; }
    nav a:hover { color: var(--pen); }
    nav a.ativo { background: var(--pen-soft); color: var(--pen); font-weight: 700; }
    nav a.adm { color: var(--red); }
    nav a.adm.ativo { background: var(--red-soft); color: var(--red); }
    .conta { display: flex; align-items: center; gap: 8px; }
    @media (max-width: 640px) { .nome { display: none; } }
  `,
})
export class App {
  protected auth = inject(AuthService);
  private router = inject(Router);
  protected configurado = firebaseConfigurado;
  protected erro = signal('');

  protected acessibilidade = inject(AcessibilidadeService);

  constructor() {
    afterNextRender(() => this.acessibilidade.iniciar());
  }

  async entrar() {
    this.erro.set('');
    try {
      await this.auth.entrar();
    } catch (e) {
      this.erro.set(mensagemErro(e));
    }
  }

  async sair() {
    await this.auth.sair();
    if (this.router.url.startsWith('/admin')) this.router.navigateByUrl('/');
  }
}
