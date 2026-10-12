import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ButtonModule, CardModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  constructor(protected readonly auth: AuthService) {}
}
