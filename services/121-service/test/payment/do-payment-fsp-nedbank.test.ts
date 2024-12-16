import { HttpStatus } from '@nestjs/common';

import { ExportType } from '@121-service/src/metrics/enum/export-type.enum';
import { NedbankVoucherStatus } from '@121-service/src/payments/fsp-integration/nedbank/enums/nedbank-voucher-status.enum';
import { TransactionStatusEnum } from '@121-service/src/payments/transactions/enums/transaction-status.enum';
import { ImportRegistrationsDto } from '@121-service/src/registration/dto/bulk-import.dto';
import { SeedScript } from '@121-service/src/scripts/enum/seed-script.enum';
import { adminOwnerDto } from '@121-service/test/fixtures/user-owner';
import {
  doPayment,
  exportList,
  getTransactions,
  retryPayment,
  waitForPaymentTransactionsToComplete,
} from '@121-service/test/helpers/program.helper';
import {
  seedIncludedRegistrations,
  seedPaidRegistrations,
  updateRegistration,
} from '@121-service/test/helpers/registration.helper';
import {
  getAccessToken,
  resetDB,
  runCronjobUpdateNedbankVoucherStatus,
} from '@121-service/test/helpers/utility.helper';
import { registrationNedbank } from '@121-service/test/registrations/pagination/pagination-data';

const programId = 1;
const payment = 1;
const amount = 200;

enum NedbankMockNumber {
  failDebitorAccountIncorrect = '27000000001',
  failTimoutSimulate = '27000000002',
}

enum NebankGetOrderMockReference {
  orderNotFound = 'mock-order-not-found',
  mock = 'mock',
}

describe('Do payment to PA(s)', () => {
  describe('with FSP: Nedbank', () => {
    let accessToken: string;

    beforeEach(async () => {
      await resetDB(SeedScript.nedbankProgram);
      accessToken = await getAccessToken();
    });

    describe('when create order API call gives a valid response', () => {
      it('should succesfully pay-out', async () => {
        // Arrange
        const paymentReferenceIds = [registrationNedbank.referenceId];
        await seedIncludedRegistrations(
          [registrationNedbank],
          programId,
          accessToken,
        );

        // Act
        const doPaymentResponse = await doPayment(
          programId,
          payment,
          amount,
          paymentReferenceIds,
          accessToken,
        );

        await waitForPaymentTransactionsToComplete(
          programId,
          paymentReferenceIds,
          accessToken,
          30_000,
          [
            TransactionStatusEnum.success,
            TransactionStatusEnum.error,
            TransactionStatusEnum.waiting,
          ],
        );

        const getTransactionsBeforeCronjob = await getTransactions(
          programId,
          payment,
          registrationNedbank.referenceId,
          accessToken,
        );
        const transactionBeforeCronJob = getTransactionsBeforeCronjob.body[0];

        // Cronjob should update the status of the transaction
        await runCronjobUpdateNedbankVoucherStatus();
        await waitForPaymentTransactionsToComplete(
          programId,
          paymentReferenceIds,
          accessToken,
          6_000,
          [TransactionStatusEnum.success, TransactionStatusEnum.error],
        );

        const getTransactionsAfterCronjob = await getTransactions(
          programId,
          payment,
          registrationNedbank.referenceId,
          accessToken,
        );
        const transactionAfterCronJob = getTransactionsAfterCronjob.body[0];

        const exportPaymentResponse = await exportList({
          programId,
          exportType: ExportType.payment,
          accessToken,
          options: {
            minPayment: 0,
            maxPayment: 1,
          },
        });
        const exportPayment = exportPaymentResponse.body.data[0];

        // Assert
        expect(doPaymentResponse.status).toBe(HttpStatus.ACCEPTED);
        expect(doPaymentResponse.body.applicableCount).toBe(
          paymentReferenceIds.length,
        );
        expect(doPaymentResponse.body.totalFilterCount).toBe(
          paymentReferenceIds.length,
        );
        expect(doPaymentResponse.body.nonApplicableCount).toBe(0);
        expect(doPaymentResponse.body.sumPaymentAmountMultiplier).toBe(
          registrationNedbank.paymentAmountMultiplier,
        );
        expect(transactionBeforeCronJob.status).toBe(
          TransactionStatusEnum.waiting,
        );
        expect(transactionBeforeCronJob.errorMessage).toBe(null);
        expect(transactionBeforeCronJob.user).toMatchObject(adminOwnerDto);
        expect(transactionAfterCronJob.status).toBe(
          TransactionStatusEnum.success,
        );
        expect(exportPayment.nedbankVoucherStatus).toBe(
          NedbankVoucherStatus.REDEEMED,
        );
        expect(exportPayment.nedbankOrderCreateReference).toBeDefined();
      });

      it('should fail pay-out when debitor account number is missing', async () => {
        const registrationFailDebitorAccount = {
          ...registrationNedbank,
          phoneNumber: NedbankMockNumber.failDebitorAccountIncorrect,
        };
        const paymentReferenceIds = [
          registrationFailDebitorAccount.referenceId,
        ];
        await seedIncludedRegistrations(
          [registrationFailDebitorAccount],
          programId,
          accessToken,
        );

        // Act
        await doPayment(
          programId,
          payment,
          amount,
          paymentReferenceIds,
          accessToken,
        );

        await waitForPaymentTransactionsToComplete(
          programId,
          paymentReferenceIds,
          accessToken,
          30_000,
          [
            TransactionStatusEnum.success,
            TransactionStatusEnum.error,
            TransactionStatusEnum.waiting,
          ],
        );

        const getTransactionsBody = (
          await getTransactions(
            programId,
            payment,
            registrationFailDebitorAccount.referenceId,
            accessToken,
          )
        ).body;

        // Assert
        expect(getTransactionsBody[0].status).toBe(TransactionStatusEnum.error);
        expect(getTransactionsBody[0].errorMessage).toMatchSnapshot();
      });

      it('should fail pay-out when we make a payment with a payment amount of over 5000', async () => {
        const amountOver6000 = 6000;
        const paymentReferenceIds = [registrationNedbank.referenceId];
        await seedIncludedRegistrations(
          [registrationNedbank],
          programId,
          accessToken,
        );

        // Act
        await doPayment(
          programId,
          payment,
          amountOver6000,
          paymentReferenceIds,
          accessToken,
        );

        await waitForPaymentTransactionsToComplete(
          programId,
          paymentReferenceIds,
          accessToken,
          30_000,
          [
            TransactionStatusEnum.success,
            TransactionStatusEnum.error,
            TransactionStatusEnum.waiting,
          ],
        );

        const getTransactionsBody = (
          await getTransactions(
            programId,
            payment,
            registrationNedbank.referenceId,
            accessToken,
          )
        ).body;

        // Assert
        expect(getTransactionsBody[0].status).toBe(TransactionStatusEnum.error);
        expect(getTransactionsBody[0].errorMessage).toMatchSnapshot();
      });

      // This test is needed because if the Nedbank create order api is called with the same reference it will return the same response the second time
      // So we need to make sure that the order reference is different on a retry payment if the first create order failed
      it('should create a new order reference on a retry payment', async () => {
        // Arrange
        const registrationFailDebitorAccount = {
          ...registrationNedbank,
          phoneNumber: NedbankMockNumber.failDebitorAccountIncorrect,
        };
        await seedIncludedRegistrations(
          [registrationFailDebitorAccount],
          programId,
          accessToken,
        );
        await doPayment(
          programId,
          payment,
          amount,
          [registrationFailDebitorAccount.referenceId],
          accessToken,
        );
        await waitForPaymentTransactionsToComplete(
          programId,
          [registrationFailDebitorAccount.referenceId],
          accessToken,
          5_000,
          [TransactionStatusEnum.error],
        );
        const exportPaymentBeforeRetryResponse = await exportList({
          programId,
          exportType: ExportType.payment,
          accessToken,
          options: {
            minPayment: 0,
            maxPayment: 1,
          },
        });
        const orderReferenceBeforeRetry =
          exportPaymentBeforeRetryResponse.body.data[0]
            .nedbankOrderCreateReference;

        await updateRegistration(
          programId,
          registrationFailDebitorAccount.referenceId,
          { phoneNumber: '27000000000' },
          'to make payment work this time',
          accessToken,
        );
        await retryPayment(programId, payment, accessToken);
        await waitForPaymentTransactionsToComplete(
          programId,
          [registrationFailDebitorAccount.referenceId],
          accessToken,
          5_000,
          [TransactionStatusEnum.waiting],
        );
        const exportPaymentAfterRetryReponse = await exportList({
          programId,
          exportType: ExportType.payment,
          accessToken,
          options: {
            minPayment: 0,
            maxPayment: 1,
          },
        });
        const orderReferenceAfterRetry =
          exportPaymentAfterRetryReponse.body.data[0]
            .nedbankOrderCreateReference;
        expect(orderReferenceBeforeRetry).not.toBe(orderReferenceAfterRetry);
      });

      it('should return the correct TransactionStatus for each NedbankVoucherStatus', async () => {
        // Arrange
        const nedbanVoucherStatusToTransactionStatus = {
          [NedbankVoucherStatus.PENDING]: TransactionStatusEnum.waiting,
          [NedbankVoucherStatus.PROCESSING]: TransactionStatusEnum.waiting,
          [NedbankVoucherStatus.REDEEMABLE]: TransactionStatusEnum.waiting,
          [NedbankVoucherStatus.REDEEMED]: TransactionStatusEnum.success,
          [NedbankVoucherStatus.REFUNDED]: TransactionStatusEnum.error,
        };
        const registrations: ImportRegistrationsDto[] = [];
        for (const status in nedbanVoucherStatusToTransactionStatus) {
          const registration = {
            ...registrationNedbank,
            referenceId: `${NebankGetOrderMockReference.mock}-${status}`,
          };
          registrations.push(registration);
        }
        await seedPaidRegistrations(registrations, programId);

        // Act
        await runCronjobUpdateNedbankVoucherStatus();
        const getExportListResponse = await exportList({
          programId,
          exportType: ExportType.payment,
          accessToken,
          options: {
            minPayment: 0,
            maxPayment: 1,
          },
        });
        const exportListData = getExportListResponse.body.data;
        for (const exportData of exportListData) {
          const expectedStatus =
            nedbanVoucherStatusToTransactionStatus[
              exportData.nedbankVoucherStatus
            ];
          expect(exportData.status).toBe(expectedStatus);
        }
      });
    });

    describe('when the create order API call times out', () => {
      it('should update the transaction status to succes in the nedbank cronjob if the voucher is redeemed', async () => {
        // Arrange
        const registrationFailTimeout = {
          ...registrationNedbank,
          phoneNumber: NedbankMockNumber.failTimoutSimulate, // This phone number will simulate a time-out in our mock service
        };

        // Act
        await seedPaidRegistrations([registrationFailTimeout], programId);
        const paymentExportBeforeCronResponse = await exportList({
          programId,
          exportType: ExportType.payment,
          accessToken,
          options: {
            minPayment: 0,
            maxPayment: 1,
          },
        });
        const paymentExportBeforeCron =
          paymentExportBeforeCronResponse.body.data[0];

        await updateRegistration(
          programId,
          registrationFailTimeout.referenceId,
          { phoneNumber: '27000000000' },
          'to make payment work this time',
          accessToken,
        );

        await runCronjobUpdateNedbankVoucherStatus();
        const paymentExportAfterCronResponse = await exportList({
          programId,
          exportType: ExportType.payment,
          accessToken,
          options: {
            minPayment: 0,
            maxPayment: 1,
          },
        });
        const paymentExportAfterCron =
          paymentExportAfterCronResponse.body.data[0];

        // Assert
        expect(paymentExportBeforeCron.nedbankVoucherStatus).toBe(null);
        expect(paymentExportBeforeCron.status).toBe(
          TransactionStatusEnum.waiting,
        );
        expect(paymentExportAfterCron.nedbankOrderCreateReference).toBe(
          paymentExportBeforeCron.nedbankOrderCreateReference,
        );
        expect(paymentExportAfterCron.nedbankVoucherStatus).toBe(
          NedbankVoucherStatus.REDEEMED,
        );
        expect(paymentExportAfterCron.status).toBe(
          TransactionStatusEnum.success,
        );
      });

      it('should update the transaction status to failed in the nedbank cronjob if the voucher is not found', async () => {
        // Arrange
        const registrationFailTimeout = {
          ...registrationNedbank,
          phoneNumber: NedbankMockNumber.failTimoutSimulate, // This phone number will simulate a time-out in our mock service
          referenceId: NebankGetOrderMockReference.orderNotFound, // This referenceId will be copied to the orderCreateReference and this will simulate a not found order in our mock service when we try to get the order
        };
        await seedPaidRegistrations([registrationFailTimeout], programId);
        const paymentExportBeforeCronResponse = await exportList({
          programId,
          exportType: ExportType.payment,
          accessToken,
          options: {
            minPayment: 0,
            maxPayment: 1,
          },
        });
        const paymentExportBeforeCron =
          paymentExportBeforeCronResponse.body.data[0];

        await updateRegistration(
          programId,
          registrationFailTimeout.referenceId,
          { phoneNumber: '27000000000' },
          'to make payment work this time',
          accessToken,
        );

        await runCronjobUpdateNedbankVoucherStatus();
        const paymentExportAfterCronResponse = await exportList({
          programId,
          exportType: ExportType.payment,
          accessToken,
          options: {
            minPayment: 0,
            maxPayment: 1,
          },
        });
        const paymentExportAfterCron =
          paymentExportAfterCronResponse.body.data[0];

        // Assert
        expect(paymentExportBeforeCron.nedbankVoucherStatus).toBe(null);
        expect(paymentExportBeforeCron.status).toBe(
          TransactionStatusEnum.waiting,
        );
        expect(paymentExportAfterCron.nedbankOrderCreateReference).toBe(
          paymentExportBeforeCron.nedbankOrderCreateReference,
        );
        expect(paymentExportAfterCron.nedbankVoucherStatus).toBe(
          NedbankVoucherStatus.FAILED,
        );
        expect(paymentExportAfterCron.status).toBe(TransactionStatusEnum.error);
      });
    });
  });
});
