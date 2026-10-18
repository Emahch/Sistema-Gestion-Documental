import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ShareService } from '../../core/share.service';
import type { ShareItem } from '../../models/share.model';

@Component({
  selector: 'app-shared',
  imports: [DatePipe, RouterLink, ButtonModule, CardModule, TableModule, TagModule],
  templateUrl: './shared.html',
  styleUrl: './shared.css',
})
export class Shared implements OnInit {
  protected readonly mode = signal<'with-me' | 'by-me'>('with-me');
  protected readonly shares = signal<ShareItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly leavingId = signal<string | null>(null);

  protected readonly title = computed(() =>
    this.mode() === 'with-me' ? 'Compartidos conmigo' : 'Compartidos por mí'
  );
  protected readonly subtitle = computed(() =>
    this.mode() === 'with-me'
      ? 'Archivos y carpetas que otros te compartieron'
      : 'Lo que compartiste con otros usuarios'
  );

  constructor(
    private sharesApi: ShareService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.mode.set(data['mode'] === 'by-me' ? 'by-me' : 'with-me');
      this.reload();
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    const request =
      this.mode() === 'with-me' ? this.sharesApi.withMe(1, 50) : this.sharesApi.byMe(1, 50);
    request.subscribe({
      next: (result) => {
        this.shares.set(result.data);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los compartidos.');
        this.loading.set(false);
      },
    });
  }

  protected openResource(share: ShareItem): void {
    if (share.resourceType !== 'folder') {
      return;
    }
    this.router.navigate(['/drive'], { queryParams: { folderId: share.resourceId } });
  }

  protected unshare(share: ShareItem): void {
    if (this.mode() !== 'by-me') {
      return;
    }
    this.leavingId.set(share.id);
    this.sharesApi.remove(share.resourceId, share.sharedWithId).subscribe({
      next: () => {
        this.leavingId.set(null);
        this.reload();
      },
      error: () => {
        this.leavingId.set(null);
        this.error.set('No se pudo retirar el acceso.');
      },
    });
  }
}
