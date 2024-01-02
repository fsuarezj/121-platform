import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { map, Subscription } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import Permission from 'src/app/auth/permission.enum';
import { ExportType } from 'src/app/models/export-type.model';
import { ProgramsServiceApiService } from 'src/app/services/programs-service-api.service';
import { RegistrationStatusEnum } from '../../../../../../services/121-service/src/registration/enum/registration-status.enum';
import RegistrationStatus from '../../enums/registration-status.enum';
import {
  FilterService,
  PaginationFilter,
  PaginationSort,
} from '../../services/filter.service';
import { LatestActionService } from '../../services/latest-action.service';
import { RegistrationsService } from '../../services/registrations.service';
import { actionResult } from '../../shared/action-result';
import { DuplicateAttributesProps } from '../../shared/confirm-prompt/confirm-prompt.component';
import { DatetimeProps } from '../../shared/datetime-picker/datetime-picker.component';

@Component({
  selector: 'app-export-list',
  templateUrl: './export-list.component.html',
  styleUrls: ['./export-list.component.scss'],
})
export class ExportListComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  public programId: number;

  @Input()
  public exportType: ExportType;

  @Input()
  public minPayment: number;

  @Input()
  public maxPayment: number;

  @Input()
  public disabled: boolean;

  @Input()
  public message: string;

  @Input()
  public exportFilteredTable: boolean;

  public allPeopleAffectedOptions: {
    limit: number;
    page: number;
    referenceId?: string;
    filterOnPayment?: number;
    attributes?: string[];
    statuses?: RegistrationStatus[];
    filters?: PaginationFilter[];
    sort?: PaginationSort;
  } = {
    limit: 10,
    page: 1,
  };

  public isInProgress = false;

  public btnText: string;
  public subHeader: string;

  public duplicateAttributesProps: DuplicateAttributesProps;
  public datetimeProps: DatetimeProps;

  private textFilterSubscription: Subscription;
  private statusFilterSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private programsService: ProgramsServiceApiService,
    private translate: TranslateService,
    private alertController: AlertController,
    private latestActionService: LatestActionService,
    private filterService: FilterService,
    private registrationService: RegistrationsService,
  ) {
    this.textFilterSubscription = this.filterService.textFilter$.subscribe(
      this.onTextFilterChange,
    );
    this.statusFilterSubscription = this.filterService.statusFilter$.subscribe(
      this.onStatusFilterChange,
    );
  }
  ngOnDestroy(): void {
    this.textFilterSubscription.unsubscribe();
    this.statusFilterSubscription.unsubscribe();
  }
  ngOnInit(): void {
    if (!this.exportFilteredTable) {
      return;
    }

    this.filterService.statusFilter$.pipe(
      map((filter) => (this.allPeopleAffectedOptions.statuses = filter)),
    );

    const { itemsPerPage, currentPage } =
      this.registrationService.getPageMetadata();
    this.allPeopleAffectedOptions.limit = itemsPerPage;
    this.allPeopleAffectedOptions.page = currentPage + 1;

    this.allPeopleAffectedOptions.sort = this.registrationService.getSortBy();
  }

  private onTextFilterChange = (filter: PaginationFilter[]) => {
    this.allPeopleAffectedOptions.filters = filter;
  };

  private onStatusFilterChange = (filter: RegistrationStatusEnum[]) => {
    this.allPeopleAffectedOptions.statuses = filter;
  };

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.exportType && typeof changes.exportType === 'object') {
      this.updateBtnText();
      await this.updateHeaderAndMessage();
    }
  }

  private updateBtnText() {
    this.btnText = this.translate.instant(
      'page.program.export-list.' + this.exportType + '.btn-text',
    );
  }

  private async updateDisplayMessage(): Promise<void> {
    let actionTimestamp;
    if (this.authService.hasPermission(this.programId, Permission.ActionREAD)) {
      actionTimestamp = await this.latestActionService.getLatestActionTime(
        this.exportType,
        this.programId,
      );
      this.message = actionTimestamp
        ? this.translate.instant('page.program.export-list.timestamp', {
            dateTime: actionTimestamp,
          })
        : '';
    }
    if (this.exportType === ExportType.duplicates) {
      this.duplicateAttributesProps = {
        attributes: await this.programsService.getDuplicateCheckAttributes(
          this.programId,
        ),
        timestamp: actionTimestamp,
      };
    }
    if (this.exportType === ExportType.paDataChanges) {
      this.datetimeProps = {
        dateFrom: null,
        dateTo: null,
      };
    }
  }

  private async updateHeaderAndMessage() {
    this.subHeader = this.translate.instant(
      'page.program.export-list.' + this.exportType + '.confirm-message',
    );

    await this.updateDisplayMessage();
  }

  public async getExportList() {
    this.isInProgress = true;

    const dateFrom = this.datetimeProps?.dateFrom
      ? new Date(this.datetimeProps?.dateFrom).toISOString()
      : null;
    const dateTo = this.datetimeProps?.dateTo
      ? new Date(this.datetimeProps?.dateTo)
      : null;
    let dateToAdjusted: string;
    if (dateTo) {
      dateToAdjusted = new Date(
        dateTo.setDate(dateTo.getDate() + 1),
      ).toISOString(); // Add one day to include the selected date as the time is otherwise set to 00:00:00
    }

    let exportType = this.exportType;
    if (this.exportType === ExportType.filteredTable) {
      exportType = ExportType.allPeopleAffected;
    }

    this.programsService
      .exportList(
        Number(this.programId),
        exportType,
        dateFrom,
        dateToAdjusted,
        Number(this.minPayment),
        Number(this.maxPayment),
        this.allPeopleAffectedOptions,
      )
      .then(
        (res) => {
          this.isInProgress = false;
          if (!res.data || res.data.length === 0) {
            actionResult(
              this.alertController,
              this.translate,
              this.translate.instant('page.program.export-list.no-data'),
            );
            return;
          }
          this.updateHeaderAndMessage();
        },
        (err) => {
          this.isInProgress = false;
          console.log('err: ', err);
          actionResult(
            this.alertController,
            this.translate,
            this.translate.instant('common.export-error'),
          );
        },
      );
  }
}
