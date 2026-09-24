import { Timestamp } from 'firebase/firestore';

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function quando(ts: Timestamp | null | undefined): string {
  if (!ts) return 'agora';
  const d = ts.toDate();
  const seg = (Date.now() - d.getTime()) / 1000;
  if (seg < 60) return 'agora';
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  return fmt.format(d);
}

export function porData<T extends { criadoEm?: Timestamp }>(a: T, b: T): number {
  return (a.criadoEm?.toMillis() ?? Date.now()) - (b.criadoEm?.toMillis() ?? Date.now());
}

export function mensagemErro(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'Sem permissão para isso. Confira se você entrou com a conta certa.';
  if (code.includes('unavailable')) return 'Sem conexão com o Firebase. Tente de novo em instantes.';
  if (code.includes('popup-closed')) return 'A janela de login foi fechada antes de terminar.';
  if (code.includes('unauthorized-domain')) return 'Este domínio não está autorizado no Firebase Authentication.';
  return (e as Error)?.message ?? 'Algo deu errado.';
}
