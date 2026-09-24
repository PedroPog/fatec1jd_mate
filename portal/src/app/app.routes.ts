import { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';

export const routes: Routes = [
  { path: '', title: 'Caderno Central', loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio) },
  { path: 'c/:slug', loadComponent: () => import('./paginas/leitor/leitor').then((m) => m.Leitor) },
  { path: 'forum', title: 'Fórum · Caderno Central', loadComponent: () => import('./paginas/forum/forum').then((m) => m.Forum) },
  { path: 'forum/t/:id', title: 'Fórum · Caderno Central', loadComponent: () => import('./paginas/topico/topico').then((m) => m.TopicoPagina) },
  { path: 'apoio', title: 'Material de apoio · Caderno Central', loadComponent: () => import('./paginas/materiais/materiais').then((m) => m.Materiais) },
  { path: 'entrar', title: 'Entrar · Caderno Central', loadComponent: () => import('./paginas/entrar/entrar').then((m) => m.Entrar) },
  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      { path: '', title: 'Admin · Caderno Central', loadComponent: () => import('./admin/painel/painel').then((m) => m.Painel) },
      { path: 'novo', title: 'Novo conteúdo · Admin', loadComponent: () => import('./admin/editor/editor').then((m) => m.Editor) },
      { path: 'editar/:slug', title: 'Editar conteúdo · Admin', loadComponent: () => import('./admin/editor/editor').then((m) => m.Editor) },
      { path: 'materiais', title: 'Materiais · Admin', loadComponent: () => import('./admin/materiais/admin-materiais').then((m) => m.AdminMateriais) },
    ],
  },
  { path: '**', redirectTo: '' },
];
