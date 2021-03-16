import { LookupService } from './../../notifications/lookup/lookup.service';
import { SoapService } from './../../programs/fsp/api/soap.service';
import { AfricasTalkingService } from './../../programs/fsp/africas-talking.service';
import { SmsService } from './../../notifications/sms/sms.service';
import { VoiceService } from './../../notifications/voice/voice.service';
import { TwilioMessageEntity } from './../../notifications/twilio.entity';
import { UserEntity } from './../../user/user.entity';
import { CustomCriterium } from './../../programs/program/custom-criterium.entity';
import { ConnectionEntity } from './../create-connection/connection.entity';
import { SchemaEntity } from './../schema/schema.entity';
import { ProgramService } from './../../programs/program/program.service';
import { CredentialEntity } from './credential.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { CredentialService } from './credential.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { repositoryMockFactory } from '../../mock/repositoryMock.factory';
import { CredentialAttributesEntity } from './credential-attributes.entity';
import { CredentialRequestEntity } from './credential-request.entity';
import { ProgramEntity } from '../../programs/program/program.entity';
import { SchemaService } from '../schema/schema.service';
import { ProofService } from '../proof/proof.service';
import { HttpModule } from '@nestjs/common';
import { ProtectionServiceProviderEntity } from '../../programs/program/protection-service-provider.entity';
import { TransactionEntity } from '../../programs/program/transactions.entity';
import { FinancialServiceProviderEntity } from '../../programs/fsp/financial-service-provider.entity';
import { ActionEntity } from '../../actions/action.entity';
import { FspCallLogEntity } from '../../programs/fsp/fsp-call-log.entity';
import { FspService } from '../../programs/fsp/fsp.service';
import { AfricasTalkingNotificationEntity } from '../../programs/fsp/africastalking-notification.entity';
import { AfricasTalkingApiService } from '../../programs/fsp/api/africas-talking.api.service';
import { IntersolveService } from '../../programs/fsp/intersolve.service';
import { IntersolveApiService } from '../../programs/fsp/api/instersolve.api.service';
import { WhatsappService } from '../../notifications/whatsapp/whatsapp.service';
import { ImageCodeService } from '../../notifications/imagecode/image-code.service';
import { ImageCodeEntity } from '../../notifications/imagecode/image-code.entity';
import { IntersolveBarcodeEntity } from '../../programs/fsp/intersolve-barcode.entity';
import { FspAttributeEntity } from '../../programs/fsp/fsp-attribute.entity';
import { ImageCodeExportVouchersEntity } from '../../notifications/imagecode/image-code-export-vouchers.entity';
import { IntersolveRequestEntity } from '../../programs/fsp/intersolve-request.entity';
import { IntersolveInstructionsEntity } from '../../programs/fsp/intersolve-instructions.entity';
import { ActionService } from '../../actions/action.service';

describe('CredentialService', (): void => {
  let service: CredentialService;

  beforeEach(
    async (): Promise<void> => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [HttpModule],
        providers: [
          ActionService,
          CredentialService,
          ProgramService,
          SchemaService,
          ProofService,
          VoiceService,
          SmsService,
          FspService,
          AfricasTalkingApiService,
          AfricasTalkingService,
          ImageCodeService,
          IntersolveService,
          IntersolveApiService,
          SoapService,
          WhatsappService,
          LookupService,
          {
            provide: getRepositoryToken(CredentialAttributesEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(CredentialRequestEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(ProgramEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(CredentialEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(CredentialRequestEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(SchemaEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(ConnectionEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(CustomCriterium),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(UserEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(FinancialServiceProviderEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(FspCallLogEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(ProtectionServiceProviderEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(TwilioMessageEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(TransactionEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(ActionEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(AfricasTalkingNotificationEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(ImageCodeEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(ImageCodeExportVouchersEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(IntersolveBarcodeEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(FspAttributeEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(IntersolveRequestEntity),
            useFactory: repositoryMockFactory,
          },
          {
            provide: getRepositoryToken(IntersolveInstructionsEntity),
            useFactory: repositoryMockFactory,
          },
        ],
      }).compile();

      service = module.get<CredentialService>(CredentialService);
    },
  );

  it('should be defined ', (): void => {
    expect(service).toBeDefined();
  });
});
