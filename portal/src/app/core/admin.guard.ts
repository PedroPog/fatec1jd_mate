import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Esconde as telas de admin de quem não é admin.
 * A proteção real dos dados está em firestore.rules e storage.rules.
 */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarPronto();
  if (auth.admin()) return true;
  return router.createUrlTree(['/entrar'], { queryParams: { voltar: state.url } });
};
