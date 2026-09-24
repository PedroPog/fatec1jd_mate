import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConteudoService } from '../../core/conteudo.service';
import { MaterialService } from '../../core/material.service';
import { Conteudo, Material, TipoMaterial } from '../../core/modelos';
import { mensagemErro, tamanhoLegivel } from '../../core/util';

interface Envio {
  nome: string;
  tamanho: number;
  progresso: number;
  estado: 'fila' | 'enviando' | 'ok' | 'erro';
  erro?: string;
}

const LIMITE_ARQUIVO = 50 * 1024 * 1024; // igual ao storage.rules

@Component({
  selector: 'app-admin-materiais',
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <p><a routerLink="/admin">← Admin</a></p>
      <h1>Material de apoio</h1>
      <p class="lead">PDFs e imagens vão para o Cloud Storage; links e vídeos só guardam o endereço. Tudo aparece em Material de apoio e no leitor do conteúdo ligado.</p>

      <div class="grade">
        <section class="cartao pilha">
          <h2>Adicionar</h2>
          <div class="seg" role="group" aria-label="Tipo">
            <button type="button" [attr.aria-pressed]="modo() === 'arquivo'" (click)="modo.set('arquivo')">PDF ou imagem</button>
            <button type="button" [attr.aria-pressed]="modo() === 'link'" (click)="modo.set('link')">Link</button>
            <button type="button" [attr.aria-pressed]="modo() === 'video'" (click)="modo.set('video')">Vídeo</button>
          </div>

          <div class="campos">
            <label class="campo">Matéria
              <input list="mats" [value]="materia()" (input)="materia.set($any($event.target).value)" placeholder="Ex.: Matemática Discreta">
              <datalist id="mats">@for (m of materias(); track m) { <option [value]="m"></option> }</datalist>
            </label>
            <label class="campo">Conteúdo relacionado (opcional)
              <select [value]="conteudoId()" (change)="conteudoId.set($any($event.target).value)">
                <option value="">Nenhum (vale para a matéria toda)</option>
                @for (c of conteudosDaMateria(); track c.slug) { <option [value]="c.slug">{{ c.titulo }}</option> }
              </select>
            </label>
          </div>

          @if (modo() === 'arquivo') {
            <div class="soltar" [class.sobre]="arrastando()"
                 (dragover)="$event.preventDefault(); arrastando.set(true)" (dragleave)="arrastando.set(false)"
                 (drop)="soltar($event)">
              <p>Arraste PDFs aqui ou</p>
              <label class="btn sec peq">
                Escolher arquivos
                <input type="file" accept="application/pdf,image/*" multiple (change)="escolher($event)" hidden>
              </label>
              <p class="small muted">Até 50 MB por arquivo. O título vem do nome do arquivo e pode ser trocado depois.</p>
            </div>
            @if (selecionados().length) {
              <ul class="envios">
                @for (f of selecionados(); track f.name; let i = $index) {
                  @let e = envios()[i];
                  <li>
                    <span class="nome">{{ f.name }}</span>
                    <span class="small muted num">{{ tamanho(f.size) }}</span>
                    @if (e?.estado === 'enviando') { <span class="small num">{{ e.progresso }}%</span> }
                    @if (e?.estado === 'ok') { <span class="selo ok">enviado</span> }
                    @if (e?.estado === 'erro') { <span class="erro small">{{ e.erro }}</span> }
                    <div class="barra"><span [style.width.%]="e?.progresso ?? 0"></span></div>
                  </li>
                }
              </ul>
            }
            <label class="campo">Descrição (opcional, vale para todos os arquivos)
              <input [value]="descricao()" (input)="descricao.set($any($event.target).value)">
            </label>
            <button class="btn" type="button" (click)="enviarArquivos()"
              [disabled]="enviando() || !selecionados().length || !materia().trim()">
              {{ enviando() ? 'Enviando…' : 'Enviar ' + selecionados().length + (selecionados().length === 1 ? ' arquivo' : ' arquivos') }}
            </button>
          } @else {
            <div class="campos">
              <label class="campo">Título
                <input [value]="titulo()" (input)="titulo.set($any($event.target).value)">
              </label>
              <label class="campo">Endereço (URL)
                <input type="url" [value]="url()" (input)="url.set($any($event.target).value)" placeholder="https://…">
              </label>
            </div>
            <label class="campo">Descrição (opcional)
              <input [value]="descricao()" (input)="descricao.set($any($event.target).value)">
            </label>
            <button class="btn" type="button" (click)="salvarLink()"
              [disabled]="enviando() || !titulo().trim() || !urlValida() || !materia().trim()">Adicionar</button>
          }
          @if (!materia().trim()) { <p class="small muted">Preencha a matéria para liberar o envio.</p> }
          @if (erro()) { <p class="erro" role="alert">{{ erro() }}</p> }
          @if (ok()) { <p class="sucesso" role="status">{{ ok() }}</p> }
        </section>
      </div>

      <h2 class="titulo-lista">Cadastrados</h2>
      @if (lista() === null) {
        <p class="carregando">Carregando…</p>
      } @else if (!lista()!.length) {
        <p class="vazio">Nenhum material ainda. Comece pelos PDFs das aulas 01 e 02.</p>
      } @else {
        <div class="tabela">
          <table>
            <thead><tr><th>Título</th><th>Tipo</th><th>Matéria</th><th>Conteúdo</th><th class="num">Tamanho</th><th>Ações</th></tr></thead>
            <tbody>
              @for (m of lista(); track m.id) {
                <tr>
                  <td>
                    @if (editandoId() === m.id) {
                      <input class="caixa" [value]="tituloEdicao()" (input)="tituloEdicao.set($any($event.target).value)" (keydown.enter)="salvarTitulo(m)">
                    } @else {
                      <a [href]="m.url" target="_blank" rel="noopener">{{ m.titulo }}</a>
                    }
                  </td>
                  <td>{{ m.tipo }}</td>
                  <td>{{ m.materia }}</td>
                  <td class="small">{{ tituloConteudo(m.conteudoId) }}</td>
                  <td class="num">{{ tamanho(m.tamanho) }}</td>
                  <td>
                    <div class="linha acoes">
                      @if (editandoId() === m.id) {
                        <button class="btn link" (click)="salvarTitulo(m)">Salvar</button>
                        <button class="btn link" (click)="editandoId.set(null)">Cancelar</button>
                      } @else {
                        <button class="btn link" (click)="editar(m)">Renomear</button>
                      }
                      @if (confirmando() === m.id) {
                        <button class="btn link perigo" (click)="excluir(m)">Excluir mesmo</button>
                        <button class="btn link" (click)="confirmando.set(null)">Cancelar</button>
                      } @else {
                        <button class="btn link perigo" (click)="confirmando.set(m.id)">Excluir</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .grade { display: grid; gap: 16px; max-width: 760px; }
    h2 { font-size: 1.3rem; margin: 0; }
    .titulo-lista { margin: 32px 0 12px; }
    .seg { display: flex; gap: 4px; flex-wrap: wrap; }
    .seg button { border: 1px solid var(--line); background: var(--card); border-radius: 6px; padding: 3px 12px; font-size: .88rem; }
    .seg button[aria-pressed="true"] { border-color: var(--pen); background: var(--pen-soft); color: var(--pen); font-weight: 700; }
    .soltar { border: 2px dashed var(--line); border-radius: 8px; padding: 18px; display: grid; gap: 6px; justify-items: center; text-align: center; }
    .soltar p { margin: 0; }
    .soltar.sobre { border-color: var(--pen); background: var(--pen-soft); }
    .envios { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .envios li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 4px 10px; align-items: center; }
    .envios .nome { overflow-wrap: anywhere; font-size: .92rem; }
    .envios .barra { grid-column: 1 / -1; }
    .acoes { gap: 12px; font-size: .88rem; }
    .perigo { color: var(--red) !important; }
  `,
})
export class AdminMateriais {
  private materiaisSrv = inject(MaterialService);
  private conteudosSrv = inject(ConteudoService);

  protected lista = signal<Material[] | null>(null);
  protected conteudos = signal<Conteudo[]>([]);
  protected modo = signal<'arquivo' | 'link' | 'video'>('arquivo');
  protected materia = signal('');
  protected conteudoId = signal('');
  protected titulo = signal('');
  protected url = signal('');
  protected descricao = signal('');
  protected selecionados = signal<File[]>([]);
  protected envios = signal<Envio[]>([]);
  protected arrastando = signal(false);
  protected enviando = signal(false);
  protected erro = signal('');
  protected ok = signal('');
  protected confirmando = signal<string | null>(null);
  protected editandoId = signal<string | null>(null);
  protected tituloEdicao = signal('');
  protected tamanho = tamanhoLegivel;

  protected materias = computed(() =>
    [...new Set([...this.conteudos().map((c) => c.materia), ...(this.lista() ?? []).map((m) => m.materia)])].sort(),
  );
  protected conteudosDaMateria = computed(() =>
    this.conteudos().filter((c) => !this.materia().trim() || c.materia === this.materia().trim()),
  );
  protected urlValida = computed(() => /^https?:\/\/\S+$/i.test(this.url().trim()));

  constructor() {
    this.carregar();
    this.conteudosSrv.listarTodos().then((l) => this.conteudos.set(l)).catch(() => {});
  }

  private carregar() {
    this.materiaisSrv.listar().then((l) => this.lista.set(l)).catch((e) => this.erro.set(mensagemErro(e)));
  }

  protected tituloConteudo(slug: string | null): string {
    if (!slug) return '—';
    return this.conteudos().find((c) => c.slug === slug)?.titulo ?? slug;
  }

  private adicionar(files: File[]) {
    this.erro.set('');
    this.ok.set('');
    const aceitos = files.filter((f) => f.type === 'application/pdf' || f.type.startsWith('image/'));
    const grandes = aceitos.filter((f) => f.size >= LIMITE_ARQUIVO);
    if (aceitos.length < files.length) this.erro.set('Só PDFs e imagens podem ser enviados.');
    if (grandes.length) this.erro.set(`Maior que 50 MB: ${grandes.map((f) => f.name).join(', ')}.`);
    const validos = aceitos.filter((f) => f.size < LIMITE_ARQUIVO);
    this.selecionados.update((l) => [...l.filter((a) => !validos.some((v) => v.name === a.name)), ...validos]);
    this.envios.set([]);
  }

  protected escolher(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.adicionar([...(input.files ?? [])]);
    input.value = '';
  }

  protected soltar(ev: DragEvent) {
    ev.preventDefault();
    this.arrastando.set(false);
    this.adicionar([...(ev.dataTransfer?.files ?? [])]);
  }

  protected async enviarArquivos() {
    const arquivos = this.selecionados();
    const materia = this.materia().trim();
    this.enviando.set(true);
    this.erro.set('');
    this.ok.set('');
    this.envios.set(arquivos.map((f) => ({ nome: f.name, tamanho: f.size, progresso: 0, estado: 'fila' })));
    let certos = 0;
    for (const [i, f] of arquivos.entries()) {
      const marcar = (p: Partial<Envio>) => this.envios.update((l) => l.map((e, j) => (j === i ? { ...e, ...p } : e)));
      marcar({ estado: 'enviando' });
      try {
        const r = await this.materiaisSrv.enviarArquivo(f, materia, (progresso) => marcar({ progresso }));
        await this.materiaisSrv.criar({
          titulo: f.name.replace(/\.[^.]+$/, ''),
          descricao: this.descricao().trim(),
          tipo: (f.type.startsWith('image/') ? 'imagem' : 'pdf') as TipoMaterial,
          url: r.url,
          storagePath: r.path,
          tamanho: r.tamanho,
          materia,
          conteudoId: this.conteudoId() || null,
        });
        marcar({ estado: 'ok', progresso: 100 });
        certos++;
      } catch (e) {
        marcar({ estado: 'erro', erro: mensagemErro(e) });
      }
    }
    this.enviando.set(false);
    if (certos === arquivos.length) {
      this.ok.set(certos === 1 ? 'Arquivo enviado.' : `${certos} arquivos enviados.`);
      this.selecionados.set([]);
      this.envios.set([]);
      this.descricao.set('');
    }
    this.carregar();
  }

  protected async salvarLink() {
    this.enviando.set(true);
    this.erro.set('');
    try {
      await this.materiaisSrv.criar({
        titulo: this.titulo().trim(),
        descricao: this.descricao().trim(),
        tipo: this.modo() === 'video' ? 'video' : 'link',
        url: this.url().trim(),
        storagePath: null,
        tamanho: null,
        materia: this.materia().trim(),
        conteudoId: this.conteudoId() || null,
      });
      this.titulo.set('');
      this.url.set('');
      this.descricao.set('');
      this.ok.set('Adicionado.');
      this.carregar();
    } catch (e) {
      this.erro.set(mensagemErro(e));
    } finally {
      this.enviando.set(false);
    }
  }

  protected editar(m: Material) {
    this.editandoId.set(m.id);
    this.tituloEdicao.set(m.titulo);
  }

  protected async salvarTitulo(m: Material) {
    const t = this.tituloEdicao().trim();
    if (!t) return;
    try {
      await this.materiaisSrv.atualizar(m.id, { titulo: t });
      this.editandoId.set(null);
      this.carregar();
    } catch (e) {
      this.erro.set(mensagemErro(e));
    }
  }

  protected async excluir(m: Material) {
    this.confirmando.set(null);
    try {
      await this.materiaisSrv.excluir(m);
      this.carregar();
    } catch (e) {
      this.erro.set(mensagemErro(e));
    }
  }
}
