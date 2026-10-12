import { Routes } from '@angular/router';
import { Shell } from './layout/shell';
import { adminGuard, authGuard, visitorGuard } from './core/auth.guard';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { Users } from './pages/users/users';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [visitorGuard] },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', component: Home },
      { path: 'users', component: Users, canActivate: [adminGuard] },
    ],
  },
  { path: '**', redirectTo: '' },
];
