import { Routes } from '@angular/router';
import { Shell } from './layout/shell';
import { adminGuard, authGuard, visitorGuard } from './core/auth.guard';
import { Drive } from './pages/drive/drive';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { Shared } from './pages/shared/shared';
import { Trash } from './pages/trash/trash';
import { Users } from './pages/users/users';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [visitorGuard] },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', component: Home },
      { path: 'drive', component: Drive },
      { path: 'shared-with-me', component: Shared, data: { mode: 'with-me' } },
      { path: 'shared-by-me', component: Shared, data: { mode: 'by-me' } },
      { path: 'trash', component: Trash },
      { path: 'users', component: Users, canActivate: [adminGuard] },
    ],
  },
  { path: '**', redirectTo: '' },
];
