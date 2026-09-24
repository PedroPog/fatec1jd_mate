import { Injectable, computed, signal } from '@angular/core';
import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import { Conteudo, Corpo, Versao } from './modelos';
import { slugify } from './util';

export type NovoConteudo = Omit<Conteudo, 'criadoEm' | 'atualizadoEm' | 'versao'>;

function ordenar(a: Conteudo, b: Conteudo): number {
  return a.materia.localeCompare(b.materia, 'pt-BR') || (a.ordem ?? 0) - (b.ordem ?? 0) || a.titulo.localeCompare(b.titulo, 'pt-BR');
}

@Injectable({ providedIn: 'root' })
export class ConteudoService {
  /** Conteúdos publicados (cache da página inicial). */
  readonly publicados = signal<Conteudo[] | null>(null);
  readonly materias = computed(() => [...new Set((this.publicados() ?? []).map((c) => c.materia))].sort());

  async carregarPublicados(forcar = false): Promise<Conteudo[]> {
    if (this.publicados() && !forcar) return this.publicados()!;
    const snap = await getDocs(query(collection(db, 'conteudos'), where('publicado', '==', true)));
    const lista = snap.docs.map((d) => ({ ...(d.data() as Conteudo), slug: d.id })).sort(ordenar);
    this.publicados.set(lista);
    return lista;
  }

  /** Admin: inclui rascunhos. */
  async listarTodos(): Promise<Conteudo[]> {
    const snap = await getDocs(collection(db, 'conteudos'));
    return snap.docs.map((d) => ({ ...(d.data() as Conteudo), slug: d.id })).sort(ordenar);
  }

  async obter(slug: string): Promise<Conteudo | null> {
    const s = await getDoc(doc(db, 'conteudos', slug));
    return s.exists() ? { ...(s.data() as Conteudo), slug: s.id } : null;
  }

  async obterCorpo(slug: string): Promise<Corpo | null> {
    const s = await getDoc(doc(db, 'corpos', slug));
    if (!s.exists()) return null;
    const d = s.data() as Partial<Corpo>;
    return { html: d.html ?? '', css: d.css ?? '', js: d.js ?? '' };
  }

  /**
   * Cria ou atualiza. Se já existia, a versão anterior (metadados + corpo)
   * vai para conteudos/{slug}/versoes antes de ser substituída.
   */
  async salvar(meta: NovoConteudo, corpo: Corpo): Promise<number> {
    const slug = meta.slug;
    const refMeta = doc(db, 'conteudos', slug);
    const refCorpo = doc(db, 'corpos', slug);
    const [antigo, corpoAntigo] = await Promise.all([getDoc(refMeta), getDoc(refCorpo)]);
    const batch = writeBatch(db);
    let versao = 1;

    if (antigo.exists()) {
      const a = antigo.data() as Conteudo;
      versao = (a.versao ?? 1) + 1;
      if (corpoAntigo.exists()) {
        const c = corpoAntigo.data() as Corpo;
        batch.set(doc(collection(refMeta, 'versoes')), {
          versao: a.versao ?? 1,
          titulo: a.titulo,
          html: c.html ?? '',
          css: c.css ?? '',
          js: c.js ?? '',
          salvoEm: serverTimestamp(),
        });
      }
    }

    batch.set(refMeta, {
      ...meta,
      versao,
      atualizadoEm: serverTimestamp(),
      ...(antigo.exists() ? {} : { criadoEm: serverTimestamp() }),
    }, { merge: true });
    batch.set(refCorpo, { ...corpo, atualizadoEm: serverTimestamp() });
    await batch.commit();
    this.publicados.set(null);
    return versao;
  }

  async definirPublicado(slug: string, publicado: boolean): Promise<void> {
    const batch = writeBatch(db);
    batch.update(doc(db, 'conteudos', slug), { publicado, atualizadoEm: serverTimestamp() });
    await batch.commit();
    this.publicados.set(null);
  }

  async listarVersoes(slug: string): Promise<Versao[]> {
    const snap = await getDocs(query(collection(db, 'conteudos', slug, 'versoes'), orderBy('versao', 'desc')));
    return snap.docs.map((d) => ({ ...(d.data() as Versao), id: d.id }));
  }

  async excluir(slug: string): Promise<void> {
    const versoes = await getDocs(collection(db, 'conteudos', slug, 'versoes'));
    const batch = writeBatch(db);
    versoes.docs.forEach((v) => batch.delete(v.ref));
    batch.delete(doc(db, 'corpos', slug));
    batch.delete(doc(db, 'conteudos', slug));
    await batch.commit();
    this.publicados.set(null);
  }

  async excluirVersao(slug: string, id: string): Promise<void> {
    await deleteDoc(doc(db, 'conteudos', slug, 'versoes', id));
  }

  async slugLivre(slug: string): Promise<boolean> {
    return !(await getDoc(doc(db, 'conteudos', slug))).exists();
  }

  /** Imagem usada dentro de um conteúdo; devolve a URL para colar no HTML. */
  async enviarImagem(slug: string, arquivo: File): Promise<string> {
    const nome = `${Date.now()}-${slugify(arquivo.name.replace(/\.[^.]+$/, ''))}${arquivo.name.match(/\.[^.]+$/)?.[0] ?? ''}`;
    const r = ref(storage, `conteudos/${slug}/${nome}`);
    await uploadBytes(r, arquivo, { contentType: arquivo.type });
    return getDownloadURL(r);
  }
}
