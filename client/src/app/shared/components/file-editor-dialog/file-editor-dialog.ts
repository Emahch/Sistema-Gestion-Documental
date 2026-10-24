import { Component, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FolderService } from '../../../core/folder.service';

@Component({
  selector: 'app-file-editor-dialog',
  imports: [ButtonModule, DialogModule, FormsModule, InputTextModule],
  templateUrl: './file-editor-dialog.html',
  styleUrl: './file-editor-dialog.css',
})
export class FileEditorDialog {
  private readonly foldersApi = inject(FolderService);

  readonly visible = model(false);
  readonly mode = model<'create' | 'edit'>('create');
  readonly fileId = model<string>('');
  readonly fileName = model<string>('');
  readonly folderId = model<string | null>(null);
  readonly readOnly = model(false);

  protected readonly content = signal('');
  protected readonly createName = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  openCreate(folderId: string) {
    this.mode.set('create');
    this.fileId.set('');
    this.fileName.set('');
    this.folderId.set(folderId);
    this.readOnly.set(false);
    this.content.set('');
    this.createName.set('nuevo.txt');
    this.error.set(null);
    this.visible.set(true);
  }

  openEdit(fileId: string, fileName: string, content: string) {
    this.openPreview(fileId, fileName, content, false);
  }

  openPreview(fileId: string, fileName: string, content: string, readOnly = true) {
    this.mode.set('edit');
    this.fileId.set(fileId);
    this.fileName.set(fileName);
    this.folderId.set(null);
    this.readOnly.set(readOnly);
    this.content.set(content);
    this.createName.set(fileName);
    this.error.set(null);
    this.visible.set(true);
  }

  save() {
    if (this.readOnly()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    if (this.mode() === 'create') {
      const name = (this.createName() || '').trim();
      if (!name) {
        this.error.set('Nombre obligatorio');
        this.saving.set(false);
        return;
      }
      const lower = name.toLowerCase();
      if (!lower.endsWith('.txt') && !lower.endsWith('.md')) {
        this.error.set('Solo se permiten archivos .txt o .md');
        this.saving.set(false);
        return;
      }
      const folderId = this.folderId();
      if (!folderId) {
        this.error.set('Carpeta destino obligatoria');
        this.saving.set(false);
        return;
      }
      const blob = new Blob([this.content()], { type: 'text/plain;charset=utf-8' });
      const file = new File([blob], name);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folderId', folderId);
      this.foldersApi.uploadFile(folderId, file).subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'No se pudo crear el archivo');
        },
      });
      return;
    }

    const id = this.fileId();
    if (!id) {
      this.saving.set(false);
      return;
    }
    const name = (this.createName() || this.fileName() || '').trim() || this.fileName();
    const lower = name.toLowerCase();
    if (!lower.endsWith('.txt') && !lower.endsWith('.md')) {
      this.error.set('Solo se permiten archivos .txt o .md');
      this.saving.set(false);
      return;
    }
    const blob = new Blob([this.content()], { type: 'text/plain;charset=utf-8' });
    const file = new File([blob], name);
    this.foldersApi.editContent(id, file).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'No se pudo guardar el archivo');
      },
    });
  }

  close() {
    this.visible.set(false);
  }
}
