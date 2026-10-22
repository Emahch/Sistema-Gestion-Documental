import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DataViewModule } from 'primeng/dataview';
import { TagModule } from 'primeng/tag';

export interface DriveViewItem {
  id: string;
  kind: 'folder' | 'file';
  name: string;
  updatedAt?: string;
  meta?: string;
  tag?: string;
  showMenu?: boolean;
  data?: unknown;
}

export interface DriveViewAction {
  id: string;
  icon: string;
  label: string;
  severity?: string;
}

@Component({
  selector: 'app-drive-view',
  imports: [DatePipe, ButtonModule, DataViewModule, TagModule],
  templateUrl: './drive-view.html',
  styleUrl: './drive-view.css',
})
export class DriveView {
  readonly items = input.required<DriveViewItem[]>();
  readonly layout = input<'list' | 'grid'>('grid');
  readonly loading = input(false);
  readonly emptyText = input('Esta carpeta está vacía.');
  readonly actions = input<(item: DriveViewItem) => DriveViewAction[]>(() => []);
  readonly activate = output<DriveViewItem>();
  readonly menu = output<{ event: MouseEvent; item: DriveViewItem }>();
  readonly action = output<{ item: DriveViewItem; actionId: string }>();
}
