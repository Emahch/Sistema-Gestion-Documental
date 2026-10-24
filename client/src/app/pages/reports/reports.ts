import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ReportService } from '../../core/report.service';
import { formatBytes } from '../../shared/format';
import type {
  FilesByCategoryResult,
  FilesByDateResult,
  OperationsByActionResult,
  OperationsByPeriodResult,
  ReceivedByUserResult,
  ReportUser,
  SharedByUserResult,
  TopFileRow,
  TopSharedFileRow,
  TopUserByFilesRow,
  TopUserBySharedRow,
  UserActivityResult,
} from '../../models/report.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    CardModule,
    DatePickerModule,
    SelectModule,
    TableModule,
    TabsModule,
    TagModule,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  private readonly reports = inject(ReportService);

  protected readonly users = signal<ReportUser[]>([]);
  protected readonly loadingUsers = signal(false);

  protected readonly filesByCategory = signal<FilesByCategoryResult | null>(null);
  protected readonly loadingCat = signal(false);

  protected readonly topUsersByFiles = signal<TopUserByFilesRow[]>([]);
  protected readonly loadingTopUsers = signal(false);

  protected readonly topUsersByShared = signal<TopUserBySharedRow[]>([]);
  protected readonly loadingTopSharedUsers = signal(false);

  protected readonly topSharedFiles = signal<TopSharedFileRow[]>([]);
  protected readonly loadingTopSharedFiles = signal(false);

  protected readonly topFiles = signal<TopFileRow[]>([]);
  protected readonly loadingTopFiles = signal(false);
  protected readonly topFilesFrom = signal<Date | null>(null);
  protected readonly topFilesTo = signal<Date | null>(null);

  protected readonly filesByDate = signal<FilesByDateResult | null>(null);
  protected readonly loadingFilesByDate = signal(false);
  protected readonly filesFrom = signal<Date | null>(this.lastDays(30));
  protected readonly filesTo = signal<Date | null>(new Date());

  protected readonly sharedByUser = signal<SharedByUserResult | null>(null);
  protected readonly loadingSharedByUser = signal(false);
  protected readonly sharedUserId = signal<string>('');
  protected readonly sharedPage = signal(1);

  protected readonly receivedByUser = signal<ReceivedByUserResult | null>(null);
  protected readonly loadingReceivedByUser = signal(false);
  protected readonly receivedUserId = signal<string>('');
  protected readonly receivedPage = signal(1);

  protected readonly userActivity = signal<UserActivityResult | null>(null);
  protected readonly loadingUserActivity = signal(false);
  protected readonly activityUserId = signal<string>('');
  protected readonly activityFrom = signal<Date | null>(this.lastDays(30));
  protected readonly activityTo = signal<Date | null>(new Date());
  protected readonly activityPage = signal(1);

  protected readonly operationsByAction = signal<OperationsByActionResult | null>(null);
  protected readonly loadingOpsAction = signal(false);

  protected readonly operationsByPeriod = signal<OperationsByPeriodResult | null>(null);
  protected readonly loadingOpsPeriod = signal(false);
  protected readonly periodGranularity = signal<'day' | 'week' | 'month'>('day');
  protected readonly periodFrom = signal<Date | null>(this.lastDays(30));
  protected readonly periodTo = signal<Date | null>(new Date());

  protected readonly userOptions = signal<{ label: string; value: string }[]>([]);
  protected readonly activeTab = signal('0');
  protected readonly filesPage = signal(1);

  ngOnInit(): void {
    this.loadUsers();
    this.loadGeneral();
  }

  private lastDays(days: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days + 1);
    return d;
  }

  private startOfDay(value: Date): string {
    const copy = new Date(value);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString();
  }

  private endOfDay(value: Date): string {
    const copy = new Date(value);
    copy.setHours(23, 59, 59, 999);
    return copy.toISOString();
  }

  private loadUsers(): void {
    this.loadingUsers.set(true);
    this.reports.users().subscribe({
      next: (users) => {
        this.users.set(users);
        const options = users.map((u) => ({ label: u.email, value: u.id }));
        this.userOptions.set(options);
        if (!this.sharedUserId() && options.length) this.sharedUserId.set(options[0].value);
        if (!this.receivedUserId() && options.length) this.receivedUserId.set(options[0].value);
        if (!this.activityUserId() && options.length) this.activityUserId.set(options[0].value);
        this.loadingUsers.set(false);
        if (this.activeTab() === '3') {
          this.loadSharedByUser(1);
          this.loadReceivedByUser(1);
        }
        if (this.activeTab() === '4') {
          this.loadUserActivity(1);
        }
      },
      error: () => this.loadingUsers.set(false),
    });
  }

  private loadGeneral(): void {
    this.loadingCat.set(true);
    this.reports.filesByCategory().subscribe({
      next: (res) => {
        this.filesByCategory.set(res);
        this.loadingCat.set(false);
      },
      error: () => this.loadingCat.set(false),
    });

    this.loadingTopUsers.set(true);
    this.reports.topUsersByFiles().subscribe({
      next: (res) => {
        this.topUsersByFiles.set(res);
        this.loadingTopUsers.set(false);
      },
      error: () => this.loadingTopUsers.set(false),
    });

    this.loadingTopSharedUsers.set(true);
    this.reports.topUsersByShared({ limit: 10 }).subscribe({
      next: (res) => {
        this.topUsersByShared.set(res);
        this.loadingTopSharedUsers.set(false);
      },
      error: () => this.loadingTopSharedUsers.set(false),
    });

    this.loadingTopSharedFiles.set(true);
    this.reports.topSharedFiles({ limit: 10 }).subscribe({
      next: (res) => {
        this.topSharedFiles.set(res);
        this.loadingTopSharedFiles.set(false);
      },
      error: () => this.loadingTopSharedFiles.set(false),
    });

  }

  protected onTabChange(value: string | number | undefined): void {
    const tab = String(value ?? '0');
    this.activeTab.set(tab);
    switch (tab) {
      case '1':
        this.loadFilesByDate(1);
        break;
      case '2':
        this.loadTopFiles();
        break;
      case '3':
        this.loadSharedByUser(1);
        this.loadReceivedByUser(1);
        break;
      case '4':
        this.loadUserActivity(1);
        break;
      case '5':
        this.loadOperationsByAction();
        this.loadOperationsByPeriod();
        break;
      default:
        break;
    }
  }

  protected loadTopFiles(): void {
    this.loadingTopFiles.set(true);
    this.reports
      .topFiles({
        limit: 10,
        from: this.topFilesFrom() ? this.startOfDay(this.topFilesFrom()!) : undefined,
        to: this.topFilesTo() ? this.endOfDay(this.topFilesTo()!) : undefined,
      })
      .subscribe({
        next: (res) => {
          this.topFiles.set(res);
          this.loadingTopFiles.set(false);
        },
        error: () => this.loadingTopFiles.set(false),
      });
  }

  protected loadFilesByDate(page = 1): void {
    const from = this.filesFrom();
    const to = this.filesTo();
    if (!from || !to) return;
    this.filesPage.set(page);
    this.loadingFilesByDate.set(true);
    this.reports
      .filesByDate({
        from: this.startOfDay(from),
        to: this.endOfDay(to),
        page,
        limit: 20,
      })
      .subscribe({
        next: (res) => {
          this.filesByDate.set(res);
          this.loadingFilesByDate.set(false);
        },
        error: () => this.loadingFilesByDate.set(false),
      });
  }

  protected loadSharedByUser(page = 1): void {
    const id = this.sharedUserId();
    if (!id) return;
    this.sharedPage.set(page);
    this.loadingSharedByUser.set(true);
    this.reports.sharedByUser(id, { page, limit: 20 }).subscribe({
      next: (res) => {
        this.sharedByUser.set(res);
        this.loadingSharedByUser.set(false);
      },
      error: () => this.loadingSharedByUser.set(false),
    });
  }

  protected loadReceivedByUser(page = 1): void {
    const id = this.receivedUserId();
    if (!id) return;
    this.receivedPage.set(page);
    this.loadingReceivedByUser.set(true);
    this.reports.receivedByUser(id, { page, limit: 20 }).subscribe({
      next: (res) => {
        this.receivedByUser.set(res);
        this.loadingReceivedByUser.set(false);
      },
      error: () => this.loadingReceivedByUser.set(false),
    });
  }

  protected loadUserActivity(page = 1): void {
    const id = this.activityUserId();
    const from = this.activityFrom();
    const to = this.activityTo();
    if (!id || !from || !to) return;
    this.activityPage.set(page);
    this.loadingUserActivity.set(true);
    this.reports
      .userActivity(id, {
        from: this.startOfDay(from),
        to: this.endOfDay(to),
        page,
        limit: 50,
      })
      .subscribe({
        next: (res) => {
          this.userActivity.set(res);
          this.loadingUserActivity.set(false);
        },
        error: () => this.loadingUserActivity.set(false),
      });
  }

  protected loadOperationsByAction(): void {
    this.loadingOpsAction.set(true);
    this.reports.operationsByAction().subscribe({
      next: (res) => {
        this.operationsByAction.set(res);
        this.loadingOpsAction.set(false);
      },
      error: () => this.loadingOpsAction.set(false),
    });
  }

  protected loadOperationsByPeriod(): void {
    const from = this.periodFrom();
    const to = this.periodTo();
    if (!from || !to) return;
    this.loadingOpsPeriod.set(true);
    this.reports
      .operationsByPeriod({
        granularity: this.periodGranularity(),
        from: this.startOfDay(from),
        to: this.endOfDay(to),
      })
      .subscribe({
        next: (res) => {
          this.operationsByPeriod.set(res);
          this.loadingOpsPeriod.set(false);
        },
        error: () => this.loadingOpsPeriod.set(false),
      });
  }

  protected formatBytesSize(bytes: number): string {
    return formatBytes(bytes);
  }

  protected actionLabel(action: string): string {
    const map: Record<string, string> = {
      UPLOAD: 'Subida',
      DOWNLOAD: 'Descarga',
      EDIT_CONTENT: 'Reemplazo de contenido',
      RENAME: 'Renombrado',
      MOVE: 'Movimiento',
      FOLDER_CREATE: 'Creación de carpeta',
      TRASH: 'Enviado a papelera',
      RESTORE: 'Restauración',
      DELETE_PERMANENT: 'Eliminación definitiva',
      SHARE: 'Compartido',
      PERMISSION_CHANGE: 'Cambio de permisos',
      UNSHARE: 'Quitar compartición',
      USER_CREATE: 'Creación de usuario',
      USER_STATUS_CHANGE: 'Cambio de estado',
      QUOTA_CHANGE: 'Cambio de cuota',
      VIEW: 'Vista previa/lectura',
    };
    return map[action] || action;
  }
}
