import { Injectable } from '@angular/core';
import {
  addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from './firebase';
import { Material } from './modelos';
import { slugify } from './util';

export type NovoMaterial = Omit<Material, 'id' | 'criadoEm'>;

@Injectable({ providedIn: 'root' })
export class MaterialService {
  async listar(): Promise<Material[]> {
    const snap = await getDocs(query(collection(db, 'materiais'), orderBy('criadoEm', 'desc')));
    return snap.docs.map((d) => ({ ...(d.data() as Material), id: d.id }));
  }

  /**
   * Envia o arquivo (PDF ou imagem) para o Storage e devolve URL, caminho e tamanho.
   * `progresso` recebe de 0 a 100.
   */
  enviarArquivo(arquivo: File, materia: string, progresso: (p: number) => void): Promise<{ url: string; path: string; tamanho: number }> {
    const ext = arquivo.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
    const base = slugify(arquivo.name.replace(/\.[^.]+$/, '')) || 'arquivo';
    const path = `materiais/${slugify(materia) || 'geral'}/${Date.now()}-${base}${ext}`;
    const tarefa = uploadBytesResumable(ref(storage, path), arquivo, {
      contentType: arquivo.type || 'application/pdf',
      contentDisposition: `inline; filename="${arquivo.name.replace(/"/g, '')}"`,
    });
    return new Promise((ok, falha) => {
      tarefa.on(
        'state_changed',
        (s) => progresso(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        falha,
        async () => ok({ url: await getDownloadURL(tarefa.snapshot.ref), path, tamanho: arquivo.size }),
      );
    });
  }

  async criar(m: NovoMaterial): Promise<void> {
    await addDoc(collection(db, 'materiais'), { ...m, criadoEm: serverTimestamp() });
  }

  async atualizar(id: string, dados: Partial<NovoMaterial>): Promise<void> {
    await updateDoc(doc(db, 'materiais', id), dados);
  }

  async excluir(m: Material): Promise<void> {
    if (m.storagePath) {
      try {
        await deleteObject(ref(storage, m.storagePath));
      } catch (e) {
        if ((e as { code?: string }).code !== 'storage/object-not-found') throw e;
      }
    }
    await deleteDoc(doc(db, 'materiais', m.id));
  }
}
