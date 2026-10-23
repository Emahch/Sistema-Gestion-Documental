import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ActivityService } from '../../../core/activity.service';
import type { ActivityResourceItem } from '../../../models/activity.model';

@Component({
  selector: 'app-activity-history',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule, ButtonModule, TagModule],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class ActivityHistory implements OnInit {
  private readonly activity = inject(ActivityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  resourceType: 'file' | 'folder' | null = null;
  resourceId: string | null = null;
  items: ActivityResourceItem[] = [];
  total = 0;
  page = 1;
  limit = 50;
  loading = false;

  ngOnInit(): void {
    const apply = (params: Record<string, unknown>) => {
      const rt = params['resourceType'];
      const rid = params['resourceId'];
      if ((rt === 'file' || rt === 'folder') && typeof rid === 'string' && rid) {
        this.resourceType = rt as 'file' | 'folder';
        this.resourceId = rid;
        this.page = 1;
        this.items = [];
        this.total = 0;
        this.loading = true;
        this.cdr.detectChanges();
        this.load();
        return;
      }
      this.resourceType = null;
      this.resourceId = null;
      this.items = [];
      this.total = 0;
      this.loading = false;
      this.cdr.detectChanges();
    };
    apply(this.route.snapshot.queryParams);
    this.route.queryParams.subscribe((params) => apply(params));
  }

  load(): void {
    if (!this.resourceType || !this.resourceId) {
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }
    this.loading = true;
    this.cdr.detectChanges();
    this.activity.resourceHistory(this.resourceType, this.resourceId, { page: this.page, limit: this.limit }).subscribe({
      next: (res) => {
        this.items = res.data || [];
        this.total = res.total || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.items = [];
        this.total = 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/drive']);
  }
}
