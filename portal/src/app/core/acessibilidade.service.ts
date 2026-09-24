import { Injectable, signal } from '@angular/core';

/**
 * Integração com o Allyada (public/vendor/allyada), painel de acessibilidade.
 *
 * O Allyada age na página do portal. Os conteúdos rodam num iframe isolado,
 * então este service copia as preferências (classes ally-* do <html> e o CSS
 * que a biblioteca gera) e o leitor repassa para dentro do conteúdo pela ponte.
 */

interface AllyadaApi {
  hostContainer: unknown;
  state: { fontSizeLevel?: number } & Record<string, unknown>;
  init(opcoes: Record<string, unknown>): AllyadaApi;
  applyAllStateChanges(): void;
  togglePanel(): void;
}

declare global {
  interface Window {
    Allyada?: AllyadaApi;
  }
}

export interface EstadoAcessibilidade {
  /** classes ally-* que devem valer dentro do conteúdo */
  classes: string[];
  /** CSS base da biblioteca (#allyada-host-styles) */
  css: string;
  /** CSS gerado conforme as escolhas (cursor etc.) */
  dinamico: string;
  /** cor usada em "destacar links" */
  cor: string;
  /** multiplicador do tamanho do texto */
  fator: number;
}

/** Mesmos níveis de fonte do Allyada (100% a 200%). */
const FATORES = [1.0, 1.15, 1.3, 1.45, 1.6, 1.8, 2.0];

/**
 * Filtros aplicados no <body> do portal (tons de cinza, inversão, daltonismo)
 * já aparecem por cima do iframe. Repassar faria o efeito dobrar.
 */
const SO_NO_PORTAL = /^ally-(contrast-(monochrome|invert)|filter-)/;

@Injectable({ providedIn: 'root' })
export class AcessibilidadeService {
  readonly estado = signal<EstadoAcessibilidade | null>(null);
  readonly disponivel = signal(false);
  private iniciado = false;

  iniciar(): void {
    const ally = window.Allyada;
    if (this.iniciado || !ally) return;
    this.iniciado = true;
    try {
      if (!ally.hostContainer) {
        ally.init({
          position: 'left', // à direita fica o painel de dúvidas do leitor
          primaryColor: '#1E3F9A',
          accentColor: '#C3363F',
          shortcutKey: 'a',
        });
      }
      const original = ally.applyAllStateChanges.bind(ally);
      ally.applyAllStateChanges = () => {
        original();
        this.capturar();
      };
      this.disponivel.set(true);
      this.capturar();
    } catch (e) {
      console.warn('[Caderno Central] Não foi possível iniciar o Allyada:', e);
    }
  }

  alternarPainel(): void {
    window.Allyada?.togglePanel();
  }

  private capturar(): void {
    const html = document.documentElement;
    const ally = window.Allyada;
    const nivel = Number(ally?.state?.fontSizeLevel ?? 0);
    this.estado.set({
      classes: [...html.classList].filter((c) => c.startsWith('ally-') && !SO_NO_PORTAL.test(c)),
      css: document.getElementById('allyada-host-styles')?.textContent ?? '',
      dinamico: document.getElementById('allyada-dynamic-styles')?.textContent ?? '',
      cor: html.style.getPropertyValue('--allyada-highlight-color') || '#f59e0b',
      fator: FATORES[nivel] ?? 1,
    });
  }
}
