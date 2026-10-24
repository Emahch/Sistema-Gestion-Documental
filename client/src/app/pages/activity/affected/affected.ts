import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ViewChild } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ActivityService } from '../../../core/activity.service';
import { FolderService } from '../../../core/folder.service';
import { FileEditorDialog } from '../../../shared/components/file-editor-dialog/file-editor-dialog';
import type { ActivityAffectedItem } from '../../../models/activity.model';

@Component({
  selector: 'app-activity-affected',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule, TagModule, FileEditorDialog],
  templateUrl: './affected.html',
  styleUrl: './affected.css',
})
export class ActivityAffected implements OnInit {
  private readonly activity = inject(ActivityService);
  private readonly folders = inject(FolderService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  items: ActivityAffectedItem[] = [];
  total = 0;
  page = 1;
  limit = 50;
  loading = false;
  error: string | null = null;

  @ViewChild(FileEditorDialog) private editor?: FileEditorDialog;

  ngOnInit(): void {
    this.page = 1;
    this.items = [];
    this.total = 0;
    this.zone.run(() => {
      this.loading = true;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
    this.load();
  }

  load(): void {
    this.error = null;
    this.zone.run(() => {
      this.loading = true;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
    this.activity.affected({ page: this.page, limit: this.limit }).subscribe({
      next: (res) => {
        this.zone.run(() => {
          this.items = res.data || [];
          this.total = res.total || 0;
          this.loading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.items = [];
          this.total = 0;
          this.loading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
    });
  }

  goToResource(item: ActivityAffectedItem): string {
    return item.resourceId;
  }

  openResource(item: ActivityAffectedItem): void {
    if (item.resourceType === 'folder') {
      return;
    }
    this.error = null;
    this.folders.getFile(item.resourceId).subscribe({
      next: (file) => {
        this.folders.previewFile(file.id).subscribe({
          next: (content) => {
            this.editor?.openPreview(file.id, file.name, content, file.permission !== 'owner' && file.permission !== 'edit');
          },
          error: () => {
            this.error = 'No se pudo cargar la vista previa del archivo.';
            this.cdr.detectChanges();
          },
        });
      },
      error: () => {
        this.error = 'El archivo ya no está disponible o no tienes permiso para verlo.';
        this.cdr.detectChanges();
      },
    });
  }
}
