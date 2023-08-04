import { FspName } from '../../../../../services/121-service/src/fsp/enum/fsp-name.enum';
import RegistrationStatus from '../enums/registration-status.enum';
import {
  PaymentRowDetail,
  TransactionCustomDataAttributes,
} from '../models/payment.model';
import { Person } from '../models/person.model';
import { Program } from '../models/program.model';
import { StatusEnum } from '../models/status.enum';
import { IntersolvePayoutStatus } from '../models/transaction-custom-data';
import { Transaction } from '../models/transaction.model';

export class PaymentUtils {
  static getPaymentRowInfo(
    transaction: Transaction,
    program: Program,
    person: Person,
    index: number,
  ): PaymentRowDetail {
    return {
      paymentIndex: index,
      text: transaction.paymentDate,
      transaction,
      hasMessageIcon: this.enableMessageSentIcon(transaction),
      hasMoneyIconTable: this.enableMoneySentIconTable(transaction),
      amount: `${transaction.amount} ${program?.currency}`,
      fsp: person.fsp as FspName,
      sentDate: transaction.paymentDate,
      paymentDate: transaction.paymentDate,
    };
  }

  static getTransactionOfPaymentForRegistration(
    paymentIndex: number,
    referenceId: string,
    pastTransactions: Transaction[],
  ): Transaction {
    return pastTransactions.find(
      (transaction) =>
        transaction.payment === paymentIndex &&
        transaction.referenceId === referenceId,
    );
  }

  static hasVoucherSupport(fsp: FspName): boolean {
    const voucherFsps = [
      FspName.intersolveVoucherPaper,
      FspName.intersolveVoucherWhatsapp,
    ];
    return voucherFsps.includes(fsp);
  }

  static enableSinglePayment(
    paymentRow: PaymentRowDetail,
    canDoSinglePayment: boolean,
    person: Person,
    lastPaymentId: number,
    paymentInProgress: boolean,
  ): boolean {
    if (!paymentRow) {
      return false;
    }
    const permission = canDoSinglePayment;
    const included = person.status === RegistrationStatus.included;
    const noPaymentDone = !paymentRow.transaction;
    const noFuturePayment = paymentRow.paymentIndex <= lastPaymentId;
    // Note, the number 5 is the same as allowed for the bulk payment as set in program-people-affected.component
    const onlyLast5Payments = paymentRow.paymentIndex > lastPaymentId - 5;
    const noPaymentInProgress = !paymentInProgress;

    return (
      permission &&
      included &&
      noPaymentDone &&
      noFuturePayment &&
      onlyLast5Payments &&
      noPaymentInProgress
    );
  }

  static enableMessageSentIcon(transaction: Transaction): boolean {
    return (
      transaction.customData &&
      [
        IntersolvePayoutStatus.initialMessage,
        IntersolvePayoutStatus.voucherSent,
      ].includes(transaction.customData.IntersolvePayoutStatus)
    );
  }

  static enableMoneySentIconTable(transaction: Transaction): boolean {
    return (
      (!transaction.customData.IntersolvePayoutStatus ||
        transaction.customData.IntersolvePayoutStatus ===
          IntersolvePayoutStatus.voucherSent) &&
      transaction.status === StatusEnum.success
    );
  }

  static hasWaiting(paymentRow: PaymentRowDetail): boolean {
    return !!paymentRow.waiting;
  }

  static hasError(paymentRow: PaymentRowDetail): boolean {
    if (paymentRow.errorMessage) {
      return true;
    }

    if (paymentRow.status === StatusEnum.error) {
      return true;
    }

    return false;
  }

  static getCustomDataAttributesToShow(paymentRow: PaymentRowDetail) {
    if (paymentRow.transaction?.fsp === FspName.intersolveVisa) {
      return [TransactionCustomDataAttributes.intersolveVisaWalletTokenCode];
    } else {
      return [];
    }
  }
}
