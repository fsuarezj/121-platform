import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PaymentRowDetail, PayoutDetails } from 'src/app/models/payment.model';
import { Person } from 'src/app/models/person.model';
import { Program } from 'src/app/models/program.model';
import { Transaction } from 'src/app/models/transaction.model';
import { PastPaymentsService } from 'src/app/services/past-payments.service';
import { ProgramsServiceApiService } from 'src/app/services/programs-service-api.service';
import { PaymentUtils } from 'src/app/shared/payment.utils';
import { FspName } from '../../../../../../services/121-service/src/fsp/enum/fsp-name.enum';
import { PaymentHistoryAccordionComponent } from '../payment-history-accordion/payment-history-accordion.component';
import { StatusEnum } from './../../models/status.enum';
@Component({
  selector: 'app-payment-history-popup',
  templateUrl: './payment-history-popup.component.html',
  styleUrls: ['./payment-history-popup.component.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    TranslateModule,
    PaymentHistoryAccordionComponent,
  ],
})
export class PaymentHistoryPopupComponent implements OnInit {
  @Input()
  public person: Person;

  @Input()
  public program: Program;

  @Input()
  public paymentRows: PaymentRowDetail[] = [];

  @Input()
  private canViewPersonalData = false;

  @Input()
  private canViewPaymentData = false;

  @Input()
  public canViewVouchers = false;

  @Input()
  private canDoSinglePayment = false;

  public firstPaymentToShow = 1;
  public lastPaymentId: number;
  public content: any;
  public payoutDetails: PayoutDetails;
  public paymentInProgress = false;
  public isInProgress = false;
  public paDisplayName: string;
  private programId: number;
  private pastTransactions: Transaction[] = [];

  constructor(
    private modalController: ModalController,
    private programsService: ProgramsServiceApiService,
    private translate: TranslateService,
    private pastPaymentsService: PastPaymentsService,
  ) {}

  async ngOnInit() {
    this.programId = this.program?.id;
    this.paDisplayName = `PA #${this.person?.registrationProgramId}`;

    if (this.canViewPersonalData) {
      this.paDisplayName = this.person?.name;
    }

    if (this.canViewPaymentData) {
      this.lastPaymentId = await this.pastPaymentsService.getLastPaymentId(
        this.programId,
      );
      this.pastTransactions = await this.programsService.getTransactions(
        this.programId,
        this.firstPaymentToShow,
        this.person?.referenceId,
      );
      this.fillPaymentRows();
      this.paymentRows.reverse();
    }
  }

  public closeModal() {
    this.modalController.dismiss();
  }

  public resetProgress(): void {
    this.isInProgress = false;
  }

  public hasError(paymentRow: PaymentRowDetail): boolean {
    return PaymentUtils.hasError(paymentRow);
  }

  public hasWaiting(paymentRow: PaymentRowDetail): boolean {
    return PaymentUtils.hasWaiting(paymentRow);
  }

  public hasVoucherSupport(fsp: string): boolean {
    return PaymentUtils.hasVoucherSupport(fsp as FspName);
  }

  public enableSinglePayment(paymentRow: PaymentRowDetail): boolean {
    return PaymentUtils.enableSinglePayment(
      paymentRow,
      this.canDoSinglePayment,
      this.person,
      this.lastPaymentId,
      this.paymentInProgress,
    );
  }

  private fillPaymentRows() {
    const nrOfPayments = this.program?.distributionDuration;
    const lastPaymentToShow = Math.min(this.lastPaymentId, nrOfPayments);

    for (
      let index = this.firstPaymentToShow;
      index <= lastPaymentToShow;
      index++
    ) {
      const transaction = PaymentUtils.getTransactionOfPaymentForRegistration(
        index,
        this.person.referenceId,
        this.pastTransactions,
      );
      let paymentRowValue: PaymentRowDetail = {
        paymentIndex: index,
        text: '',
      };
      if (!transaction) {
        paymentRowValue.text = this.translate.instant(
          'page.program.program-people-affected.transaction.do-single-payment',
        );
      } else {
        paymentRowValue = PaymentUtils.getPaymentRowInfo(
          transaction,
          this.program,
          index,
        );
        if (transaction.status === StatusEnum.success) {
          /* empty */
        } else if (transaction.status === StatusEnum.waiting) {
          paymentRowValue.errorMessage = this.translate.instant(
            'page.program.program-people-affected.transaction.waiting-message',
          );
          paymentRowValue.waiting = true;
        } else {
          paymentRowValue.errorMessage = transaction.errorMessage;
        }

        paymentRowValue.status = transaction.status;
      }
      if (
        paymentRowValue.transaction ||
        PaymentUtils.enableSinglePayment(
          paymentRowValue,
          this.canDoSinglePayment,
          this.person,
          this.lastPaymentId,
          false,
        )
      ) {
        this.paymentRows.push(paymentRowValue);
      }
    }
  }
}
