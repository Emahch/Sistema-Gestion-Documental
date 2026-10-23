import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ActivityService } from '../../../core/activity.service';
import type { ActivityAffectedItem } from '../../../models/activity.model';

@Component({
  selector: 'app-activity-affected',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule, TagModule],
  templateUrl: './affected.html',
  styleUrl: './affected.css',
})
export class ActivityAffected implements OnInit {
  private readonly activity = inject(ActivityService);
  private readonly cdr = inject(ChangeDetectorRef);

  items: ActivityAffectedItem[] = [];
  total = 0;
  page = 1;
  limit = 50;
  loading = false;

  ngOnInit(): void {
    this.page = 1;
    this.items = [];
    this.total = 0;
    this.loading = true;
    this.cdr.detectChanges();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.activity.affected({ page: this.page, limit: this.limit }).subscribe({
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

  goToResource(item: ActivityAffectedItem): string {
    if (item.resourceType === 'folder') {
      return `${item.resourceId}`;
    }
    return `file/${item.resourceId}`;
  }
}
