import { Component, effect, input, model, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FolderService } from '../../../core/folder.service';

@Component({
  selector: 'app-file-preview-dialog',
  imports: [ButtonModule, DialogModule],
  templateUrl: './file-preview-dialog.html',
  styleUrl: './file-preview-dialog.css',
})
export class FilePreviewDialog {
  readonly visible = model(false);
  readonly fileId = input('');
  readonly fileName = input('');

  protected readonly content = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor(private readonly foldersApi: FolderService) {
    effect(() => {
      if (this.visible() && this.fileId()) {
        this.load(this.fileId());
      }
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.content.set('');
    this.foldersApi.previewFile(id).subscribe({
      next: (text) => {
        this.content.set(text);
        this.loading.set(false);
      },
      error: (err: { status?: number }) => {
        this.error.set(
          err?.status === 403
            ? 'No tienes permiso para ver este archivo.'
            : err?.status === 404
              ? 'El archivo ya no existe.'
              : 'No se pudo cargar la vista previa.'
        );
        this.loading.set(false);
      },
    });
  }
}
