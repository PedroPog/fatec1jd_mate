import { Timestamp } from 'firebase/firestore';

export interface Secao {
  id: string;
  titulo: string;
}

/** conteudos/{slug} — metadados que aparecem na lista. */
export interface Conteudo {
  slug: string;
  titulo: string;
  descricao: string;
  materia: string;
  tags: string[];
  ordem: number;
  secoes: Secao[];
  publicado: boolean;
  tamanho: number;
  versao: number;
  criadoEm?: Timestamp;
  atualizadoEm?: Timestamp;
}

/** corpos/{slug} — o que você enviou no admin. */
export interface Corpo {
  html: string;
  css: string;
  js: string;
}

export interface Versao extends Corpo {
  id: string;
  versao: number;
  titulo: string;
  salvoEm?: Timestamp;
}

export interface Autor {
  autorUid: string;
  autorNome: string;
  autorFoto: string | null;
}

export type TipoAnotacao = 'duvida' | 'anotacao';
export type Visibilidade = 'publica' | 'privada';

/** anotacoes/{id} */
export interface Anotacao extends Autor {
  id: string;
  conteudoId: string;
  secaoId: string;
  secaoTitulo: string;
  tipo: TipoAnotacao;
  visibilidade: Visibilidade;
  texto: string;
  resolvida: boolean;
  totalRespostas: number;
  topicoId?: string | null;
  criadoEm?: Timestamp;
}

/** respostas de anotação ou de tópico */
export interface Resposta extends Autor {
  id: string;
  texto: string;
  criadoEm?: Timestamp;
}

/** topicos/{id} */
export interface Topico extends Autor {
  id: string;
  materia: string;
  titulo: string;
  texto: string;
  totalRespostas: number;
  criadoEm?: Timestamp;
  ultimaAtividade?: Timestamp;
  origem?: { conteudoId: string; secaoId: string; anotacaoId: string } | null;
}

export type TipoMaterial = 'pdf' | 'link' | 'video' | 'imagem';

/** materiais/{id} */
export interface Material {
  id: string;
  titulo: string;
  descricao: string;
  tipo: TipoMaterial;
  url: string;
  storagePath: string | null;
  tamanho: number | null;
  materia: string;
  conteudoId: string | null;
  criadoEm?: Timestamp;
}
