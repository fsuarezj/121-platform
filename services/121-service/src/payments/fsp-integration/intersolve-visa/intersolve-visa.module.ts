import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageModule } from '../../../notifications/message.module';
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

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      IntersolveVisaWalletEntity,
      UserEntity,
      RegistrationEntity,
      IntersolveVisaCustomerEntity,
    ]),
    UserModule,
    TransactionsModule,
    MessageModule,
  ],
  providers: [
    IntersolveVisaService,
    IntersolveVisaApiService,
    IntersolveVisaApiMockService,
    CustomHttpService,
    RegistrationDataQueryService,
  ],
  controllers: [IntersolveVisaController],
  exports: [
    IntersolveVisaService,
    IntersolveVisaApiService,
    IntersolveVisaApiMockService,
  ],
})
export class IntersolveVisaModule {}
