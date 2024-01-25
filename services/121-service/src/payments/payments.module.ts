import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionModule } from '../actions/action.module';
import { FinancialServiceProviderEntity } from '../fsp/financial-service-provider.entity';
import { FspQuestionEntity } from '../fsp/fsp-question.entity';
import { FspModule } from '../fsp/fsp.module';
import { LookupService } from '../notifications/lookup/lookup.service';
import { ProgramCustomAttributeEntity } from '../programs/program-custom-attribute.entity';
import { ProgramQuestionEntity } from '../programs/program-question.entity';
import { ProgramEntity } from '../programs/program.entity';
import { ProgramModule } from '../programs/programs.module';
import { RegistrationDataEntity } from '../registration/registration-data.entity';
import { RegistrationScopedRepository } from '../registration/registration-scoped.repository';
import { RegistrationStatusChangeEntity } from '../registration/registration-status-change.entity';
import { RegistrationEntity } from '../registration/registration.entity';
import { RegistrationsModule } from '../registration/registrations.module';
import { InclusionScoreService } from '../registration/services/inclusion-score.service';
import { AzureLogService } from '../shared/services/azure-log.service';
import { UserModule } from '../user/user.module';
import { createScopedRepositoryProvider } from '../utils/scope/createScopedRepositoryProvider.helper';
import { AfricasTalkingModule } from './fsp-integration/africas-talking/africas-talking.module';
import { BelcashModule } from './fsp-integration/belcash/belcash.module';
import { BobFinanceModule } from './fsp-integration/bob-finance/bob-finance.module';
import { CommercialBankEthiopiaModule } from './fsp-integration/commercial-bank-ethiopia/commercial-bank-ethiopia.module';
import { IntersolveJumboModule } from './fsp-integration/intersolve-jumbo/intersolve-jumbo.module';
import { IntersolveVisaModule } from './fsp-integration/intersolve-visa/intersolve-visa.module';
import { IntersolveVoucherModule } from './fsp-integration/intersolve-voucher/intersolve-voucher.module';
import { SafaricomModule } from './fsp-integration/safaricom/safaricom.module';
import { UkrPoshtaModule } from './fsp-integration/ukrposhta/ukrposhta.module';
import { VodacashModule } from './fsp-integration/vodacash/vodacash.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TransactionEntity } from './transactions/transaction.entity';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProgramEntity,
      TransactionEntity,
      RegistrationEntity,
      ProgramQuestionEntity,
      FinancialServiceProviderEntity,
      FspQuestionEntity,
      ProgramCustomAttributeEntity,
    ]),
    UserModule,
    HttpModule,
    ActionModule,
    FspModule,
    IntersolveVoucherModule,
    IntersolveVisaModule,
    IntersolveJumboModule,
    AfricasTalkingModule,
    BelcashModule,
    TransactionsModule,
    BobFinanceModule,
    UkrPoshtaModule,
    VodacashModule,
    SafaricomModule,
    CommercialBankEthiopiaModule,
    RegistrationsModule,
    ProgramModule,
  ],
  providers: [
    PaymentsService,
    LookupService,
    InclusionScoreService,
    RegistrationScopedRepository,
    AzureLogService,
    createScopedRepositoryProvider(RegistrationStatusChangeEntity),
    createScopedRepositoryProvider(RegistrationDataEntity),
    IntersolveVisaModule,
    IntersolveVoucherModule,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, IntersolveVisaModule, IntersolveVoucherModule],
})
export class PaymentsModule {}
