import { Injectable } from '@angular/core';
import { PaymentData } from '../models/payment.model';
import { ProgramsServiceApiService } from './programs-service-api.service';

@Injectable({
  providedIn: 'root',
})
export class PastPaymentsService {
  constructor(private programsService: ProgramsServiceApiService) {}

  public async getLastPaymentId(
    programId: number | string,
    pastPayments?: PaymentData[],
  ): Promise<number> {
    if (!pastPayments) {
      pastPayments = await this.programsService.getPastPayments(programId);
    }
    if (pastPayments.length === 0) {
      return 0;
    }
    return pastPayments[pastPayments.length - 1].id;
  }

  public async getPaymentsWithDates(programId: number): Promise<
    {
      id: number;
      date: Date | string;
    }[]
  > {
    const payments = await this.programsService.getPastPayments(programId);
    return payments
      .sort((a, b) => (a.id < b.id ? 1 : -1))
      .map((payment) => {
        return {
          id: payment.id,
          date: payment.paymentDate,
        };
      });
  }

  public async getPaymentYearMonths(programId: number): Promise<
    {
      date: Date | string;
    }[]
  > {
    const payments = await this.getPaymentsWithDates(programId);
    const yearMonths: {
      label: string;
      date: Date | string;
    }[] = payments.map((payment) => {
      const date = new Date(payment.date);
      const yearMonth = {
        label: `${date.getFullYear()}-${date.getMonth()}`,
        date,
      };
      return yearMonth;
    });
    // Filter for only unique months
    return yearMonths.filter((value, index, self) => {
      return (
        self.indexOf(self.find((item) => item.label === value.label)) === index
      );
    });
  }

  public async getPaymentsWithStateSums(programId: number): Promise<
    {
      id: number;
      values: {
        [state: string]: number;
      };
    }[]
  > {
    return this.programsService.getPaymentsWithStateSums(programId);
  }
}
