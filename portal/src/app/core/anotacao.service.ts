import { Injectable, inject } from '@angular/core';
import {
  addDoc, collection, deleteDoc, doc, increment, onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { db } from './firebase';
import { Anotacao, Resposta, TipoAnotacao, Visibilidade } from './modelos';
import { porData } from './util';

export interface NovaAnotacao {
  conteudoId: string;
  secaoId: string;
  secaoTitulo: string;
  tipo: TipoAnotacao;
  visibilidade: Visibilidade;
  texto: string;
}

@Injectable({ providedIn: 'root' })
export class AnotacaoService {
  private auth = inject(AuthService);

  /**
   * Escuta as dúvidas públicas do conteúdo e, se houver login, as anotações
   * privadas do usuário. Devolve a função que para de escutar.
   */
  observar(conteudoId: string, uid: string | null, cb: (lista: Anotacao[]) => void, erro: (e: unknown) => void): () => void {
    const col = collection(db, 'anotacoes');
    let publicas: Anotacao[] = [];
    let minhas: Anotacao[] = [];
    const emitir = () => {
      const mapa = new Map<string, Anotacao>();
      [...publicas, ...minhas].forEach((a) => mapa.set(a.id, a));
      cb([...mapa.values()].sort(porData));
    };
    const ler = (s: { docs: { id: string; data: () => unknown }[] }) =>
      s.docs.map((d) => ({ ...(d.data() as Anotacao), id: d.id }));

    const paradas = [
      onSnapshot(
        query(col, where('conteudoId', '==', conteudoId), where('visibilidade', '==', 'publica')),
        (s) => { publicas = ler(s); emitir(); },
        erro,
      ),
    ];
    if (uid) {
      paradas.push(
        onSnapshot(
          query(col, where('conteudoId', '==', conteudoId), where('autorUid', '==', uid)),
          (s) => { minhas = ler(s); emitir(); },
          erro,
        ),
      );
    }
    return () => paradas.forEach((p) => p());
  }

  async criar(n: NovaAnotacao): Promise<void> {
    await addDoc(collection(db, 'anotacoes'), {
      ...n,
      visibilidade: n.tipo === 'duvida' ? 'publica' : n.visibilidade,
      texto: n.texto.trim(),
      ...this.auth.autor(),
      resolvida: false,
      totalRespostas: 0,
      topicoId: null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  }

  observarRespostas(anotacaoId: string, cb: (r: Resposta[]) => void): () => void {
    return onSnapshot(
      query(collection(db, 'anotacoes', anotacaoId, 'respostas'), orderBy('criadoEm', 'asc')),
      (s) => cb(s.docs.map((d) => ({ ...(d.data() as Resposta), id: d.id }))),
    );
  }

  async responder(anotacaoId: string, texto: string): Promise<void> {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'anotacoes', anotacaoId, 'respostas')), {
      texto: texto.trim(),
      ...this.auth.autor(),
      criadoEm: serverTimestamp(),
    });
    batch.update(doc(db, 'anotacoes', anotacaoId), { totalRespostas: increment(1), atualizadoEm: serverTimestamp() });
    await batch.commit();
  }

  marcarResolvida(id: string, resolvida: boolean): Promise<void> {
    return updateDoc(doc(db, 'anotacoes', id), { resolvida, atualizadoEm: serverTimestamp() });
  }

  ligarTopico(id: string, topicoId: string): Promise<void> {
    return updateDoc(doc(db, 'anotacoes', id), { topicoId, atualizadoEm: serverTimestamp() });
  }

  excluir(id: string): Promise<void> {
    return deleteDoc(doc(db, 'anotacoes', id));
  }

  async excluirResposta(anotacaoId: string, respostaId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'anotacoes', anotacaoId, 'respostas', respostaId));
    batch.update(doc(db, 'anotacoes', anotacaoId), { totalRespostas: increment(-1) });
    await batch.commit();
  }
}
