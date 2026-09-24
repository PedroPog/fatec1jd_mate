import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ConteudoService } from '../../core/conteudo.service';
import { LIMITE_BYTES, analisar, montarDocumento } from '../../core/documento';
import { Corpo, Versao } from '../../core/modelos';
import { mensagemErro, slugify, tamanhoLegivel } from '../../core/util';

type Parte = keyof Corpo;

interface Arquivo {
  nome: string;
  texto: string;
}

@Component({
  selector: 'app-editor',
  imports: [RouterLink, DatePipe],
  templateUrl: './editor.html',
  styleUrl: './editor.css',
})
export class Editor {
  /** presente em admin/editar/:slug */
  readonly slugRota = input<string | undefined>(undefined, { alias: 'slug' });

  private conteudos = inject(ConteudoService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  protected editando = computed(() => !!this.slugRota());
  protected carregando = signal(false);

  // metadados
  protected titulo = signal('');
  protected slug = signal('');
  protected slugManual = signal(false);
  protected materia = signal('');
  protected tags = signal('');
  protected descricao = signal('');
  protected ordem = signal(0);
  protected publicadoAtual = signal(false);
  protected versaoAtual = signal(0);

  // arquivos
  protected arquivos = signal<Record<Parte, Arquivo | null>>({ html: null, css: null, js: null });
  protected colar = signal<Parte | null>(null);
  protected textoColado = signal('');

  protected corpo = computed<Corpo>(() => {
    const a = this.arquivos();
    return { html: a.html?.texto ?? '', css: a.css?.texto ?? '', js: a.js?.texto ?? '' };
  });
  protected analise = computed(() => analisar(this.corpo()));
  protected pct = computed(() => Math.min(100, (this.analise().bytes / LIMITE_BYTES) * 100));

  protected bloqueios = computed(() => {
    const b: string[] = [];
    if (!this.corpo().html.trim()) b.push('Falta o arquivo HTML.');
    if (this.analise().bytes > LIMITE_BYTES) b.push('Conteúdo maior que 1 MB.');
    if (!this.titulo().trim()) b.push('Falta o título.');
    if (!this.slug().trim()) b.push('Falta o endereço.');
    if (!this.materia().trim()) b.push('Falta a matéria.');
    return b;
  });

  protected previa = signal<SafeHtml | null>(null);
  protected materiasExistentes = signal<string[]>([]);
  protected versoes = signal<Versao[]>([]);
  protected verSecoes = signal(false);

  protected salvando = signal(false);
  protected erro = signal('');
  protected ok = signal('');

  // imagens
  protected enviandoImagem = signal(false);
  protected imagens = signal<{ nome: string; url: string }[]>([]);
  protected copiada = signal<string | null>(null);

  protected tamanho = tamanhoLegivel;
  protected partes: { id: Parte; rotulo: string; aceita: string }[] = [
    { id: 'html', rotulo: 'HTML', aceita: '.html,.htm,text/html' },
    { id: 'css', rotulo: 'CSS', aceita: '.css,text/css' },
    { id: 'js', rotulo: 'JS', aceita: '.js,.mjs,text/javascript' },
  ];

  constructor() {
    this.conteudos
      .listarTodos()
      .then((l) => this.materiasExistentes.set([...new Set(l.map((c) => c.materia))].sort()))
      .catch(() => {});

    effect(() => {
      const s = this.slugRota();
      untracked(() => (s ? this.carregar(s) : this.limpar()));
    });

    // endereço acompanha o título enquanto for conteúdo novo e não editado à mão
    effect(() => {
      const t = this.titulo();
      if (!this.editando() && !untracked(this.slugManual)) this.slug.set(slugify(t));
    });
  }

  private limpar() {
    this.titulo.set('');
    this.slug.set('');
    this.slugManual.set(false);
    this.materia.set('');
    this.tags.set('');
    this.descricao.set('');
    this.ordem.set(0);
    this.arquivos.set({ html: null, css: null, js: null });
    this.versoes.set([]);
    this.previa.set(null);
  }

  private async carregar(slug: string) {
    this.carregando.set(true);
    this.erro.set('');
    try {
      const [meta, corpo, versoes] = await Promise.all([
        this.conteudos.obter(slug),
        this.conteudos.obterCorpo(slug),
        this.conteudos.listarVersoes(slug),
      ]);
      if (!meta) {
        this.erro.set('Conteúdo não encontrado.');
        return;
      }
      this.titulo.set(meta.titulo);
      this.slug.set(meta.slug);
      this.slugManual.set(true);
      this.materia.set(meta.materia);
      this.tags.set(meta.tags.join(', '));
      this.descricao.set(meta.descricao);
      this.ordem.set(meta.ordem ?? 0);
      this.publicadoAtual.set(meta.publicado);
      this.versaoAtual.set(meta.versao ?? 1);
      this.versoes.set(versoes);
      const rot = `versão ${meta.versao ?? 1} (atual)`;
      this.arquivos.set({
        html: corpo?.html ? { nome: `HTML da ${rot}`, texto: corpo.html } : null,
        css: corpo?.css ? { nome: `CSS da ${rot}`, texto: corpo.css } : null,
        js: corpo?.js ? { nome: `JS da ${rot}`, texto: corpo.js } : null,
      });
      const aviso = (history.state as { ok?: string } | null)?.ok;
      if (aviso) this.ok.set(aviso);
    } catch (e) {
      this.erro.set(mensagemErro(e));
    } finally {
      this.carregando.set(false);
    }
  }

  // ---- arquivos ----

  protected async escolherArquivo(parte: Parte, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.definir(parte, { nome: f.name, texto: await f.text() });
  }

  protected soltar(parte: Parte, ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (f) f.text().then((texto) => this.definir(parte, { nome: f.name, texto }));
  }

  protected abrirColar(parte: Parte) {
    this.colar.set(parte);
    this.textoColado.set(this.arquivos()[parte]?.texto ?? '');
  }

  protected confirmarColar() {
    const p = this.colar();
    if (!p) return;
    const t = this.textoColado();
    this.definir(p, t.trim() ? { nome: `${p.toUpperCase()} colado`, texto: t } : null);
    this.colar.set(null);
  }

  protected remover(parte: Parte) {
    this.definir(parte, null);
  }

  private definir(parte: Parte, arq: Arquivo | null) {
    this.arquivos.update((a) => ({ ...a, [parte]: arq }));
    this.ok.set('');
    if (parte === 'html' && arq) this.preencherDaAnalise();
    if (this.previa()) this.atualizarPrevia();
  }

  /** Usa <title> e as metas materia/tags/descricao do HTML para os campos vazios. */
  private preencherDaAnalise() {
    const a = this.analise();
    if (!this.titulo().trim() && a.titulo) this.titulo.set(a.titulo);
    if (!this.materia().trim() && a.materia) this.materia.set(a.materia);
    if (!this.tags().trim() && a.tags.length) this.tags.set(a.tags.join(', '));
    if (!this.descricao().trim() && a.descricao) this.descricao.set(a.descricao);
  }

  protected editarSlug(v: string) {
    this.slugManual.set(true);
    this.slug.set(slugify(v));
  }

  // ---- pré-visualização ----

  protected atualizarPrevia() {
    this.previa.set(this.sanitizer.bypassSecurityTrustHtml(montarDocumento(this.corpo(), { storage: {}, secaoInicial: null })));
  }

  protected alternarPrevia() {
    if (this.previa()) this.previa.set(null);
    else this.atualizarPrevia();
  }

  // ---- imagens ----

  protected async enviarImagens(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const arquivos = [...(input.files ?? [])];
    input.value = '';
    if (!arquivos.length || !this.slug()) return;
    this.enviandoImagem.set(true);
    this.erro.set('');
    try {
      for (const f of arquivos) {
        const url = await this.conteudos.enviarImagem(this.slug(), f);
        this.imagens.update((l) => [...l, { nome: f.name, url }]);
      }
    } catch (e) {
      this.erro.set(mensagemErro(e));
    } finally {
      this.enviandoImagem.set(false);
    }
  }

  protected copiar(url: string) {
    navigator.clipboard?.writeText(url).then(() => {
      this.copiada.set(url);
      setTimeout(() => this.copiada.set(null), 2000);
    }).catch(() => {});
  }

  // ---- versões ----

  protected restaurar(v: Versao) {
    this.arquivos.set({
      html: v.html ? { nome: `HTML da versão ${v.versao}`, texto: v.html } : null,
      css: v.css ? { nome: `CSS da versão ${v.versao}`, texto: v.css } : null,
      js: v.js ? { nome: `JS da versão ${v.versao}`, texto: v.js } : null,
    });
    this.ok.set(`Versão ${v.versao} carregada no editor. Clique em Publicar ou Salvar rascunho para aplicar.`);
    if (this.previa()) this.atualizarPrevia();
  }

  protected async excluirVersao(v: Versao) {
    try {
      await this.conteudos.excluirVersao(this.slug(), v.id);
      this.versoes.update((l) => l.filter((x) => x.id !== v.id));
    } catch (e) {
      this.erro.set(mensagemErro(e));
    }
  }

  // ---- salvar ----

  protected async salvar(publicar: boolean) {
    if (this.bloqueios().length) return;
    this.salvando.set(true);
    this.erro.set('');
    this.ok.set('');
    const slug = this.slug();
    try {
      if (!this.editando() && !(await this.conteudos.slugLivre(slug))) {
        this.erro.set(`Já existe um conteúdo no endereço /c/${slug}. Troque o endereço ou edite o existente.`);
        return;
      }
      const a = this.analise();
      const versao = await this.conteudos.salvar(
        {
          slug,
          titulo: this.titulo().trim(),
          descricao: this.descricao().trim(),
          materia: this.materia().trim(),
          tags: this.tags().split(',').map((t) => t.trim()).filter(Boolean),
          ordem: Number(this.ordem()) || 0,
          secoes: a.secoes,
          publicado: publicar,
          tamanho: a.bytes,
        },
        this.corpo(),
      );
      this.publicadoAtual.set(publicar);
      this.versaoAtual.set(versao);
      this.ok.set(publicar ? `Publicado (versão ${versao}).` : `Rascunho salvo (versão ${versao}).`);
      if (!this.editando()) {
        this.router.navigate(['/admin/editar', slug], { replaceUrl: true, state: { ok: this.ok() } });
      } else {
        this.versoes.set(await this.conteudos.listarVersoes(slug));
      }
    } catch (e) {
      this.erro.set(mensagemErro(e));
    } finally {
      this.salvando.set(false);
    }
  }
}
