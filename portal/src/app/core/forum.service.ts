import { Injectable, inject } from '@angular/core';
import {
  addDoc, collection, deleteDoc, doc, increment, limit, onSnapshot, orderBy, query, serverTimestamp,
  where, writeBatch,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { db } from './firebase';
import { Resposta, Topico } from './modelos';

export const MATERIA_GERAL = 'Geral';

@Injectable({ providedIn: 'root' })
export class ForumService {
  private auth = inject(AuthService);

  observarTopicos(materia: string | null, cb: (t: Topico[]) => void, erro: (e: unknown) => void): () => void {
    const col = collection(db, 'topicos');
    const q = materia
      ? query(col, where('materia', '==', materia), orderBy('ultimaAtividade', 'desc'), limit(100))
      : query(col, orderBy('ultimaAtividade', 'desc'), limit(100));
    return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Topico), id: d.id }))), erro);
  }

  observarTopico(id: string, cb: (t: Topico | null) => void, erro: (e: unknown) => void): () => void {
    return onSnapshot(doc(db, 'topicos', id), (s) => cb(s.exists() ? { ...(s.data() as Topico), id: s.id } : null), erro);
  }

  async criarTopico(t: { materia: string; titulo: string; texto: string; origem?: Topico['origem'] }): Promise<string> {
    const r = await addDoc(collection(db, 'topicos'), {
      materia: t.materia,
      titulo: t.titulo.trim(),
      texto: t.texto.trim(),
      origem: t.origem ?? null,
      ...this.auth.autor(),
      totalRespostas: 0,
      criadoEm: serverTimestamp(),
      ultimaAtividade: serverTimestamp(),
    });
    return r.id;
  }

  observarRespostas(topicoId: string, cb: (r: Resposta[]) => void): () => void {
    return onSnapshot(
      query(collection(db, 'topicos', topicoId, 'respostas'), orderBy('criadoEm', 'asc')),
      (s) => cb(s.docs.map((d) => ({ ...(d.data() as Resposta), id: d.id }))),
    );
  }

  async responder(topicoId: string, texto: string): Promise<void> {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'topicos', topicoId, 'respostas')), {
      texto: texto.trim(),
      ...this.auth.autor(),
      criadoEm: serverTimestamp(),
    });
    batch.update(doc(db, 'topicos', topicoId), { totalRespostas: increment(1), ultimaAtividade: serverTimestamp() });
    await batch.commit();
  }

  excluirTopico(id: string): Promise<void> {
    return deleteDoc(doc(db, 'topicos', id));
  }

  async excluirResposta(topicoId: string, respostaId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'topicos', topicoId, 'respostas', respostaId));
    batch.update(doc(db, 'topicos', topicoId), { totalRespostas: increment(-1) });
    await batch.commit();
  }
}
