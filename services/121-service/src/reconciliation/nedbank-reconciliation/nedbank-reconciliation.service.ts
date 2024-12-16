import { Injectable } from '@nestjs/common';
import { In, IsNull, Not } from 'typeorm';

import { NedbankVoucherStatus } from '@121-service/src/payments/fsp-integration/nedbank/enums/nedbank-voucher-status.enum';
import { NedbankService } from '@121-service/src/payments/fsp-integration/nedbank/nedbank.service';
import { NedbankVoucherScopedRepository } from '@121-service/src/payments/fsp-integration/nedbank/repositories/nedbank-voucher.scoped.repository';
import { TransactionStatusEnum } from '@121-service/src/payments/transactions/enums/transaction-status.enum';
import { TransactionScopedRepository } from '@121-service/src/payments/transactions/transaction.repository';

@Injectable()
export class NedbankReconciliationService {
  public constructor(
    private readonly nedbankService: NedbankService,
    private readonly nedbankVoucherScopedRepository: NedbankVoucherScopedRepository,
    private readonly transactionScopedRepository: TransactionScopedRepository,
  ) {}

  public async doNedbankReconciliation(): Promise<void> {
    const vouchers = await this.nedbankVoucherScopedRepository.find({
      select: ['id', 'orderCreateReference', 'transactionId'],
      where: [
        { status: IsNull() },
        {
          status: Not(
            In([
              NedbankVoucherStatus.REDEEMED,
              NedbankVoucherStatus.REFUNDED,
              NedbankVoucherStatus.FAILED,
            ]),
          ),
        },
      ],
    });

    for (const voucher of vouchers) {
      const voucherStatus =
        await this.nedbankService.retrieveAndUpdateVoucherStatus(
          voucher.orderCreateReference,
        );

      switch (voucherStatus) {
        case NedbankVoucherStatus.REDEEMED:
          await this.transactionScopedRepository.update(
            { id: voucher.transactionId },
            { status: TransactionStatusEnum.success },
          );
          break;

        case NedbankVoucherStatus.REFUNDED:
          await this.transactionScopedRepository.update(
            { id: voucher.transactionId },
            {
              status: TransactionStatusEnum.error,
              errorMessage:
                'Voucher has been refunded by Nedbank. If you retry this transfer, the person will receive a new voucher.',
            },
          );
          break;

        case NedbankVoucherStatus.FAILED:
          await this.transactionScopedRepository.update(
            { id: voucher.transactionId },
            {
              status: TransactionStatusEnum.error,
              errorMessage:
                'Nedbank voucher was not found, something went wrong when creating the voucher. Please retry the transfer.',
            },
          );
          break;

        default:
          // Do nothing if another voucher status is returned
          break;
      }
    }
  }
}
