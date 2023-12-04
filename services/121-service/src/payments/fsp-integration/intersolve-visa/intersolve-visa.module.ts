import { HttpModule } from '@nestjs/axios';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomHttpService } from '../../../shared/services/custom-http.service';
import { UserEntity } from '../../../user/user.entity';
import { UserModule } from '../../../user/user.module';
import { RegistrationDataQueryService } from '../../../utils/registration-data-query/registration-data-query.service';
import { TransactionsModule } from '../../transactions/transactions.module';
import { RegistrationEntity } from './../../../registration/registration.entity';
import { IntersolveVisaApiMockService } from './intersolve-visa-api-mock.service';
import { IntersolveVisaCustomerEntity } from './intersolve-visa-customer.entity';
import { IntersolveVisaWalletEntity } from './intersolve-visa-wallet.entity';
import { IntersolveVisaApiService } from './intersolve-visa.api.service';
import { IntersolveVisaController } from './intersolve-visa.controller';
import { IntersolveVisaService } from './intersolve-visa.service';
import { IntersolveVisaExportService } from './services/intersolve-visa-export.service';
import { IntersolveVisaStatusMappingService } from './services/intersolve-visa-status-mapping.service';
import { QueueMessageModule } from '../../../notifications/queue-message/queue-message.module';
import { IntersolveVisaWalletScopedRepository } from './intersolve-visa-wallet.scoped.repository';
import { ScopeMiddleware } from '../../../shared/middleware/scope.middelware';
import { ProgramAidworkerAssignmentEntity } from '../../../programs/program-aidworker.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      IntersolveVisaWalletEntity,
      UserEntity,
      RegistrationEntity,
      IntersolveVisaCustomerEntity,
      ProgramAidworkerAssignmentEntity,
    ]),
    UserModule,
    TransactionsModule,
    QueueMessageModule,
  ],
  providers: [
    IntersolveVisaService,
    IntersolveVisaApiService,
    IntersolveVisaApiMockService,
    CustomHttpService,
    RegistrationDataQueryService,
    IntersolveVisaExportService,
    IntersolveVisaStatusMappingService,
    IntersolveVisaWalletScopedRepository,
  ],
  controllers: [IntersolveVisaController],
  exports: [
    IntersolveVisaService,
    IntersolveVisaApiService,
    IntersolveVisaApiMockService,
    IntersolveVisaExportService,
  ],
})
export class IntersolveVisaModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ScopeMiddleware).forRoutes(IntersolveVisaController);
  }
}
