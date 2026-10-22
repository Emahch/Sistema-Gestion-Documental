import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FolderService } from './folder.service';

export interface FolderTreeOption {
  label: string;
  value: string;
}

export interface FolderTreeRequest {
  includeRoot?: boolean;
  /** Carpetas que no se listan ni se recorren (por ejemplo, la carpeta que se está moviendo). */
  skipIds?: string[];
  /** Carpetas que no se listan pero cuyos descendientes sí se listan (por ejemplo, la carpeta actual). */
  hideIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class FolderTreeService {
  constructor(private folders: FolderService) {}

  async options(request: FolderTreeRequest = {}): Promise<FolderTreeOption[]> {
    const skipIds = request.skipIds ?? [];
    const hideIds = request.hideIds ?? [];
    const options: FolderTreeOption[] = [];
    let prefix = '';
    if (request.includeRoot) {
      const root = await firstValueFrom(this.folders.root());
      options.push({ label: root.name, value: root.id });
      prefix = `${root.name} / `;
    }
    const walk = async (currentId: string | null, currentPrefix: string): Promise<void> => {
      const page = await firstValueFrom(this.folders.children(currentId, 1, 100));
      for (const folder of page.folders) {
        if (skipIds.includes(folder.id)) {
          continue;
        }
        if (!hideIds.includes(folder.id)) {
          options.push({ label: `${currentPrefix}${folder.name}`, value: folder.id });
        }
        await walk(folder.id, `${currentPrefix}${folder.name} / `);
      }
    };
    await walk(null, prefix);
    return options;
  }
}
