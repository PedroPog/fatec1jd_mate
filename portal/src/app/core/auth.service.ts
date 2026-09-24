import { Injectable, computed, signal } from '@angular/core';
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Autor } from './modelos';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly usuario = signal<User | null>(null);
  readonly admin = signal(false);
  /** false até o Firebase dizer se há alguém logado. */
  readonly pronto = signal(false);
  readonly logado = computed(() => this.usuario() !== null);

  private resolverPronto!: () => void;
  private readonly aoFicarPronto = new Promise<void>((r) => (this.resolverPronto = r));

  constructor() {
    onAuthStateChanged(auth, async (u) => {
      this.usuario.set(u);
      this.admin.set(u ? await this.verificarAdmin(u.uid) : false);
      this.pronto.set(true);
      this.resolverPronto();
    });
  }

  /** Espera o primeiro estado de login (usado pelo guard). */
  esperarPronto(): Promise<void> {
    return this.aoFicarPronto;
  }

  async entrar(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  }

  sair(): Promise<void> {
    return signOut(auth);
  }

  /** Dados do autor gravados junto de cada dúvida, tópico ou resposta. */
  autor(): Autor {
    const u = this.usuario();
    if (!u) throw new Error('Entre com sua conta para escrever.');
    return { autorUid: u.uid, autorNome: u.displayName ?? 'Sem nome', autorFoto: u.photoURL ?? null };
  }

  private async verificarAdmin(uid: string): Promise<boolean> {
    try {
      return (await getDoc(doc(db, 'admins', uid))).exists();
    } catch {
      return false;
    }
  }
}
