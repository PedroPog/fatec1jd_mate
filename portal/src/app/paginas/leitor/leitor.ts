import {
  Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AcessibilidadeService } from '../../core/acessibilidade.service';
import { AnotacaoService } from '../../core/anotacao.service';
import { AuthService } from '../../core/auth.service';
import { ConteudoService } from '../../core/conteudo.service';
import { montarDocumento } from '../../core/documento';
import { ForumService } from '../../core/forum.service';
import { MaterialService } from '../../core/material.service';
import { Anotacao, Conteudo, Material, Resposta, Secao, TipoAnotacao, Visibilidade } from '../../core/modelos';
import { ProgressoService } from '../../core/progresso.service';
import { mensagemErro, quando, tamanhoLegivel } from '../../core/util';

export const PAGINA_INTEIRA: Secao = { id: '__pagina', titulo: 'Página inteira' };

@Component({
  selector: 'app-leitor',
  imports: [RouterLink],
  templateUrl: './leitor.html',
  styleUrl: './leitor.css',
})
export class Leitor {
  /** vem da rota c/:slug */
  readonly slug = input.required<string>();

  protected auth = inject(AuthService);
  private conteudos = inject(ConteudoService);
  private anotacoesSrv = inject(AnotacaoService);
  private forum = inject(ForumService);
  private materiaisSrv = inject(MaterialService);
  private progresso = inject(ProgressoService);
  private sanitizer = inject(DomSanitizer);
  private titulo = inject(Title);
  private location = inject(Location);
  private router = inject(Router);
  private rota = inject(ActivatedRoute);
  private acessibilidade = inject(AcessibilidadeService);

  private quadro = viewChild<ElementRef<HTMLIFrameElement>>('quadro');

  protected conteudo = signal<Conteudo | null>(null);
  protected srcdoc = signal<SafeHtml | null>(null);
  protected erro = signal('');
  protected secoesVivas = signal<Secao[] | null>(null);
  protected anotacoes = signal<Anotacao[]>([]);
  protected materiais = signal<Material[]>([]);

  protected painel = signal<'duvidas' | 'material' | null>(null);
  /** null = todas as seções */
  protected secaoAtiva = signal<string | null>(null);

  // formulário
  protected tipo = signal<TipoAnotacao>('duvida');
  protected visibilidade = signal<Visibilidade>('privada');
  protected texto = signal('');
  protected enviando = signal(false);
  protected erroForm = signal('');

  // respostas
  protected expandida = signal<string | null>(null);
  protected respostas = signal<Resposta[]>([]);
  protected textoResposta = signal('');
  protected confirmando = signal<string | null>(null);

  protected quando = quando;
  protected tamanho = tamanhoLegivel;

  protected secoes = computed<Secao[]>(() => {
    const vivas = this.secoesVivas() ?? this.conteudo()?.secoes ?? [];
    return [...vivas, PAGINA_INTEIRA];
  });

  protected contagens = computed(() => {
    const mapa: Record<string, number> = {};
    for (const a of this.anotacoes()) mapa[a.secaoId] = (mapa[a.secaoId] ?? 0) + 1;
    return mapa;
  });

  protected abertasTotal = computed(() => this.anotacoes().filter((a) => a.tipo === 'duvida' && !a.resolvida).length);

  protected visiveis = computed(() => {
    const s = this.secaoAtiva();
    return s ? this.anotacoes().filter((a) => a.secaoId === s) : this.anotacoes();
  });

  protected nomeSecao = (id: string) => this.secoes().find((s) => s.id === id)?.titulo ?? id;

  private pararAnotacoes: (() => void) | null = null;
  private pararRespostas: (() => void) | null = null;

  constructor() {
    const destroy = inject(DestroyRef);

    // Carrega quando muda o conteúdo ou a pessoa logada.
    effect(() => {
      const slug = this.slug();
      if (!this.auth.pronto()) return;
      const uid = this.auth.usuario()?.uid ?? null;
      untracked(() => this.carregar(slug, uid));
    });

    // Mantém os marcadores dentro do iframe atualizados.
    effect(() => {
      const mapa = this.contagens();
      this.secoesVivas();
      this.enviar({ tipo: 'contagens', mapa });
    });
    effect(() => this.enviar({ tipo: 'ativa', secao: this.painel() === 'duvidas' ? this.secaoAtiva() : null }));

    // Preferências do Allyada (fonte, espaçamento, contraste...) também dentro do conteúdo.
    effect(() => {
      const estado = this.acessibilidade.estado();
      this.secoesVivas(); // reenvia quando o conteúdo recarrega
      if (estado) this.enviar({ tipo: 'acessibilidade', ...estado });
    });

    // Respostas da dúvida aberta.
    effect(() => {
      const id = this.expandida();
      untracked(() => {
        this.pararRespostas?.();
        this.pararRespostas = null;
        this.respostas.set([]);
        this.textoResposta.set('');
        if (id) this.pararRespostas = this.anotacoesSrv.observarRespostas(id, (r) => this.respostas.set(r));
      });
    });

    const ouvir = (e: MessageEvent) => this.aoReceber(e);
    window.addEventListener('message', ouvir);
    const textoConteudo = () => this.pedirTexto();
    this.acessibilidade.registrarLeitor(textoConteudo);
    destroy.onDestroy(() => {
      this.acessibilidade.removerLeitor(textoConteudo);
      window.removeEventListener('message', ouvir);
      this.pararAnotacoes?.();
      this.pararRespostas?.();
    });
  }

  private async carregar(slug: string, uid: string | null) {
    this.erro.set('');
    this.pararAnotacoes?.();
    this.secoesVivas.set(null);
    try {
      const [meta, corpo] = await Promise.all([this.conteudos.obter(slug), this.conteudos.obterCorpo(slug)]);
      if (!meta || !corpo) {
        this.erro.set('Conteúdo não encontrado. Ele pode ter sido removido ou ainda ser um rascunho.');
        this.conteudo.set(null);
        return;
      }
      this.conteudo.set(meta);
      this.titulo.setTitle(`${meta.titulo} · Caderno Central`);

      const storage = await this.progresso.carregar(slug);
      const secaoInicial = this.rota.snapshot.fragment;
      if (secaoInicial) {
        this.secaoAtiva.set(secaoInicial);
        this.painel.set('duvidas');
      }
      this.srcdoc.set(this.sanitizer.bypassSecurityTrustHtml(montarDocumento(corpo, { storage, secaoInicial })));

      this.pararAnotacoes = this.anotacoesSrv.observar(
        slug,
        uid,
        (l) => this.anotacoes.set(l),
        (e) => this.erro.set(mensagemErro(e)),
      );
      this.materiaisSrv
        .listar()
        .then((l) => this.materiais.set(l.filter((m) => m.conteudoId === slug || (!m.conteudoId && m.materia === meta.materia))))
        .catch(() => this.materiais.set([]));
    } catch (e) {
      const negado = (e as { code?: string })?.code === 'permission-denied';
      this.erro.set(negado ? 'Conteúdo não encontrado. Ele pode ter sido removido ou ainda ser um rascunho.' : mensagemErro(e));
      this.conteudo.set(null);
    }
  }

  // ---- leitura em voz alta: o texto está dentro do iframe ----

  private pedidosTexto = new Map<number, (texto: string) => void>();
  private proximoPedido = 1;

  private pedirTexto(): Promise<string> {
    if (!this.quadro()?.nativeElement.contentWindow) return Promise.resolve('');
    const id = this.proximoPedido++;
    return new Promise((resolver) => {
      this.pedidosTexto.set(id, resolver);
      this.enviar({ tipo: 'pedir-texto', id });
      setTimeout(() => {
        if (this.pedidosTexto.delete(id)) resolver('');
      }, 1500);
    });
  }

  // ---- ponte com o iframe ----

  private enviar(msg: Record<string, unknown>) {
    this.quadro()?.nativeElement.contentWindow?.postMessage({ cc: 1, ...msg }, '*');
  }

  private aoReceber(e: MessageEvent) {
    const janela = this.quadro()?.nativeElement.contentWindow;
    if (!janela || e.source !== janela) return;
    const d = e.data as { cc?: number; tipo?: string; [k: string]: unknown };
    if (!d?.cc) return;
    switch (d.tipo) {
      case 'secoes':
        this.secoesVivas.set(((d['lista'] as Secao[]) ?? []).slice(0, 300));
        this.enviar({ tipo: 'contagens', mapa: this.contagens() });
        {
          const estado = this.acessibilidade.estado();
          if (estado) this.enviar({ tipo: 'acessibilidade', ...estado });
        }
        break;
      case 'texto-leitura': {
        const resolver = this.pedidosTexto.get(Number(d['id']));
        if (resolver) {
          this.pedidosTexto.delete(Number(d['id']));
          resolver(String(d['texto'] ?? ''));
        }
        break;
      }
      case 'atalho-acessibilidade':
        this.acessibilidade.alternarPainel();
        break;
      case 'abrir':
        this.abrirSecao(String(d['secao']));
        break;
      case 'storage':
        this.progresso.salvar(this.slug(), (d['dados'] as Record<string, string>) ?? {}).catch(() => {});
        break;
      case 'navegar': {
        const href = String(d['href'] ?? '');
        if (href.startsWith('/') && !href.startsWith('//')) this.router.navigateByUrl(href);
        break;
      }
    }
  }

  // ---- painel ----

  protected abrirSecao(id: string | null) {
    this.secaoAtiva.set(id);
    this.painel.set('duvidas');
    this.expandida.set(null);
    this.location.replaceState(`/c/${this.slug()}${id && id !== PAGINA_INTEIRA.id ? '#' + id : ''}`);
  }

  protected irParaSecao(id: string) {
    if (id !== PAGINA_INTEIRA.id) this.enviar({ tipo: 'rolar', secao: id });
  }

  protected alternarPainel(qual: 'duvidas' | 'material') {
    this.painel.set(this.painel() === qual ? null : qual);
  }

  protected escolherSecao(valor: string) {
    this.abrirSecao(valor || null);
    if (valor) this.irParaSecao(valor);
  }

  protected podeGerir(a: Anotacao): boolean {
    return this.auth.admin() || a.autorUid === this.auth.usuario()?.uid;
  }

  protected async publicar() {
    const texto = this.texto().trim();
    if (!texto) return;
    const secaoId = this.secaoAtiva() ?? PAGINA_INTEIRA.id;
    this.enviando.set(true);
    this.erroForm.set('');
    try {
      await this.anotacoesSrv.criar({
        conteudoId: this.slug(),
        secaoId,
        secaoTitulo: this.nomeSecao(secaoId),
        tipo: this.tipo(),
        visibilidade: this.visibilidade(),
        texto,
      });
      this.texto.set('');
      if (!this.secaoAtiva()) this.secaoAtiva.set(secaoId);
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    } finally {
      this.enviando.set(false);
    }
  }

  protected async responder(a: Anotacao) {
    const t = this.textoResposta().trim();
    if (!t) return;
    try {
      await this.anotacoesSrv.responder(a.id, t);
      this.textoResposta.set('');
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    }
  }

  protected async resolver(a: Anotacao) {
    try {
      await this.anotacoesSrv.marcarResolvida(a.id, !a.resolvida);
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    }
  }

  protected async excluir(a: Anotacao) {
    this.confirmando.set(null);
    try {
      await this.anotacoesSrv.excluir(a.id);
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    }
  }

  protected async excluirResposta(a: Anotacao, r: Resposta) {
    try {
      await this.anotacoesSrv.excluirResposta(a.id, r.id);
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    }
  }

  protected async levarAoForum(a: Anotacao) {
    const c = this.conteudo();
    if (!c) return;
    try {
      const titulo = `${a.secaoTitulo} (${c.titulo})`.slice(0, 200);
      const texto = `${a.texto}\n\nDúvida original na seção "${a.secaoTitulo}" de ${c.titulo}.`;
      const id = await this.forum.criarTopico({
        materia: c.materia,
        titulo,
        texto,
        origem: { conteudoId: c.slug, secaoId: a.secaoId, anotacaoId: a.id },
      });
      await this.anotacoesSrv.ligarTopico(a.id, id);
    } catch (e) {
      this.erroForm.set(mensagemErro(e));
    }
  }

  protected entrar() {
    this.auth.entrar().catch((e) => this.erroForm.set(mensagemErro(e)));
  }
}
