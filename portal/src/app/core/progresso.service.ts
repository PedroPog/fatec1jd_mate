import { Injectable, inject } from '@angular/core';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { db } from './firebase';

/**
 * Guarda o que o JS de um conteúdo gravaria no localStorage.
 * Logado: Firestore (progresso/{uid}/conteudos/{slug}), acompanha a pessoa em qualquer aparelho.
 * Sem login: localStorage do próprio portal, só neste navegador.
 */
@Injectable({ providedIn: 'root' })
export class ProgressoService {
  private auth = inject(AuthService);

  private chaveLocal(slug: string) {
    return `cc-progresso:${slug}`;
  }

  async carregar(slug: string): Promise<Record<string, string>> {
    const u = this.auth.usuario();
    if (u) {
      try {
        const s = await getDoc(doc(db, 'progresso', u.uid, 'conteudos', slug));
        return (s.data()?.['dados'] as Record<string, string>) ?? {};
      } catch {
        return {};
      }
    }
    try {
      return JSON.parse(localStorage.getItem(this.chaveLocal(slug)) ?? '{}');
    } catch {
      return {};
    }
  }

  async salvar(slug: string, dados: Record<string, string>): Promise<void> {
    const u = this.auth.usuario();
    if (u) {
      await setDoc(doc(db, 'progresso', u.uid, 'conteudos', slug), { dados, atualizadoEm: serverTimestamp() });
      return;
    }
    try {
      localStorage.setItem(this.chaveLocal(slug), JSON.stringify(dados));
    } catch {
      /* navegador sem armazenamento: segue sem salvar */
    }
  }
}
