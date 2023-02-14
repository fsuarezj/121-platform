import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Not, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { EXTERNAL_API, TWILIO_SANDBOX_WHATSAPP_NUMBER } from '../../config';
import { IntersolvePayoutStatus } from '../../payments/fsp-integration/intersolve/enum/intersolve-payout-status.enum';
import { IntersolveBarcodeEntity } from '../../payments/fsp-integration/intersolve/intersolve-barcode.entity';
import { IntersolveService } from '../../payments/fsp-integration/intersolve/intersolve.service';
import { ImageCodeService } from '../../payments/imagecode/image-code.service';
import { TransactionEntity } from '../../payments/transactions/transaction.entity';
import { ProgramEntity } from '../../programs/program.entity';
import { CustomDataAttributes } from '../../registration/enum/custom-data-attributes';
import { RegistrationEntity } from '../../registration/registration.entity';
import { ProgramPhase } from '../../shared/enum/program-phase.model';
import { StatusEnum } from '../../shared/enum/status.enum';
import { MessageContentType } from '../message-type.enum';
import { twilioClient } from '../twilio.client';
import {
  TwilioIncomingCallbackDto,
  TwilioStatus,
  TwilioStatusCallbackDto,
} from '../twilio.dto';
import { NotificationType, TwilioMessageEntity } from '../twilio.entity';
import { FspName } from './../../fsp/financial-service-provider.entity';
import { SmsService } from './../sms/sms.service';
import { TryWhatsappEntity } from './try-whatsapp.entity';
import { WhatsappPendingMessageEntity } from './whatsapp-pending-message.entity';
import { WhatsappTemplateTestEntity } from './whatsapp-template-test.entity';

@Injectable()
export class WhatsappService {
  @InjectRepository(IntersolveBarcodeEntity)
  private readonly intersolveBarcodeRepository: Repository<IntersolveBarcodeEntity>;
  @InjectRepository(TwilioMessageEntity)
  private readonly twilioMessageRepository: Repository<TwilioMessageEntity>;
  @InjectRepository(RegistrationEntity)
  private readonly registrationRepository: Repository<RegistrationEntity>;
  @InjectRepository(TransactionEntity)
  public transactionRepository: Repository<TransactionEntity>;
  @InjectRepository(ProgramEntity)
  public programRepository: Repository<ProgramEntity>;
  @InjectRepository(TryWhatsappEntity)
  private readonly tryWhatsappRepository: Repository<TryWhatsappEntity>;
  @InjectRepository(WhatsappTemplateTestEntity)
  private readonly whatsappTemplateTestRepository: Repository<WhatsappTemplateTestEntity>;
  @InjectRepository(WhatsappPendingMessageEntity)
  private readonly whatsappPendingMessageRepo: Repository<WhatsappPendingMessageEntity>;

  private readonly fallbackLanguage = 'en';
  private readonly genericDefaultReplies = {
    en: 'This is an automated message. Your phone number is not recognized for any 121 program. For questions please contact the NGO.',
  };
  private readonly whatsappTemplatedMessageKeys = [
    'whatsappPayment',
    'whatsappGenericMessage',
  ];

  public constructor(
    private readonly imageCodeService: ImageCodeService,
    @Inject(forwardRef(() => IntersolveService))
    private readonly intersolveService: IntersolveService,
    private readonly smsService: SmsService,
    private readonly dataSource: DataSource,
  ) {}

  public async sendWhatsapp(
    message: string,
    recipientPhoneNr: string,
    messageType: null | IntersolvePayoutStatus,
    mediaUrl: null | string,
    registrationId?: number,
    messageContentType?: MessageContentType,
  ): Promise<any> {
    const payload = {
      body: message,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      statusCallback: EXTERNAL_API.whatsAppStatus,
      to: 'whatsapp:' + recipientPhoneNr,
    };
    if (mediaUrl) {
      payload['mediaUrl'] = mediaUrl;
    }
    if (!!process.env.MOCK_TWILIO) {
      payload['messageType'] = messageType;
    }
    return twilioClient.messages
      .create(payload)
      .then((message) => {
        this.storeSendWhatsapp(
          message,
          registrationId,
          mediaUrl,
          messageContentType,
        );
        return message.sid;
      })
      .catch((err) => {
        console.log('Error from Twilio:', err);
        throw err;
      });
  }

  public async queueMessageSendTemplate(
    message: string,
    recipientPhoneNr: string,
    messageType: null | IntersolvePayoutStatus,
    mediaUrl: null | string,
    registrationId: number,
    messageContentType: MessageContentType,
  ): Promise<any> {
    const pendingMesssage = new WhatsappPendingMessageEntity();
    pendingMesssage.body = message;
    pendingMesssage.to = recipientPhoneNr;
    pendingMesssage.mediaUrl = mediaUrl;
    pendingMesssage.messageType = messageType;
    pendingMesssage.registrationId = registrationId;
    pendingMesssage.contentType = messageContentType;
    this.whatsappPendingMessageRepo.save(pendingMesssage);

    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId },
      relations: ['program'],
    });
    const language = registration.preferredLanguage || this.fallbackLanguage;
    const whatsappGenericMessage = this.getGenericNotificationText(
      language,
      registration.program,
    );
    return this.sendWhatsapp(
      whatsappGenericMessage,
      recipientPhoneNr,
      messageType,
      mediaUrl,
      registrationId,
      MessageContentType.genericTemplated,
    );
  }

  public getGenericNotificationText(
    language: string,
    program: ProgramEntity,
  ): string {
    const key = 'whatsappGenericMessage';
    const fallbackNotifications = program.notifications[this.fallbackLanguage];
    let notifications = fallbackNotifications;

    if (program.notifications[language]) {
      notifications = program.notifications[language];
    }
    if (notifications[key]) {
      return notifications[key];
    }
    return fallbackNotifications[key] ? fallbackNotifications[key] : '';
  }

  public storeSendWhatsapp(
    message,
    registrationId: number,
    mediaUrl: string,
    messageContentType?: MessageContentType,
  ): void {
    const twilioMessage = new TwilioMessageEntity();
    twilioMessage.accountSid = message.accountSid;
    twilioMessage.body = message.body;
    twilioMessage.mediaUrl = mediaUrl;
    twilioMessage.to = message.to;
    twilioMessage.from = message.messagingServiceSid;
    twilioMessage.sid = message.sid;
    twilioMessage.status = message.status;
    twilioMessage.type = NotificationType.Whatsapp;
    twilioMessage.dateCreated = message.dateCreated;
    twilioMessage.registrationId = registrationId;
    twilioMessage.contentType = messageContentType;
    this.twilioMessageRepository.save(twilioMessage);
  }

  public async findOne(sid: string): Promise<TwilioMessageEntity> {
    const findOneOptions = {
      sid: sid,
    };
    return await this.twilioMessageRepository.findOneBy(findOneOptions);
  }

  public async statusCallback(
    callbackData: TwilioStatusCallbackDto,
  ): Promise<void> {
    if (
      callbackData.MessageStatus === TwilioStatus.delivered ||
      callbackData.MessageStatus === TwilioStatus.failed
    ) {
      const tryWhatsapp = await this.tryWhatsappRepository.findOne({
        where: { sid: callbackData.SmsSid },
        relations: ['registration'],
      });
      if (tryWhatsapp) {
        await this.handleWhatsappTestResult(callbackData, tryWhatsapp);
      }
    }
    await this.twilioMessageRepository.update(
      {
        sid: callbackData.MessageSid,
        status: Not(In([TwilioStatus.read, TwilioStatus.failed])),
      },
      {
        status: callbackData.MessageStatus,
        errorCode: callbackData.ErrorCode,
        errorMessage: callbackData.ErrorMessage,
      },
    );

    const statuses = [
      TwilioStatus.delivered,
      TwilioStatus.read,
      TwilioStatus.failed,
      TwilioStatus.undelivered,
    ];
    if (statuses.includes(callbackData.MessageStatus)) {
      await this.intersolveService.processStatus(callbackData);
    }
  }

  private async handleWhatsappTestResult(
    callbackData: TwilioStatusCallbackDto,
    tryWhatsapp: TryWhatsappEntity,
  ): Promise<void> {
    if (
      callbackData.MessageStatus === TwilioStatus.failed &&
      callbackData.ErrorCode === '63003'
    ) {
      // PA does not have whatsapp
      // Send pending message via sms
      const whatsapPendingMessages = await this.whatsappPendingMessageRepo.find(
        {
          where: { to: tryWhatsapp.registration.phoneNumber },
          relations: ['registration'],
        },
      );
      for (const w of whatsapPendingMessages) {
        await this.smsService.sendSms(
          w.body,
          w.registration.phoneNumber,
          w.registration.id,
        );
        await this.whatsappPendingMessageRepo.remove(w);
      }
      await this.tryWhatsappRepository.remove(tryWhatsapp);
    }
    if (callbackData.MessageStatus === TwilioStatus.delivered) {
      // PA does have whatsapp
      // Store PA phone number as whatsappPhonenumber
      // Since it is for now impossible to store a whatsapp number without a chosen FSP
      // Explicitely search for the the fsp intersolve (in the related FSPs of this program)
      // This should be refactored later
      const program = await this.programRepository.findOne({
        where: { id: tryWhatsapp.registration.programId },
        relations: ['financialServiceProviders'],
      });
      const fspIntersolveWhatsapp = program.financialServiceProviders.find(
        (fsp) => {
          return (fsp.fsp = FspName.intersolve);
        },
      );
      tryWhatsapp.registration.fsp = fspIntersolveWhatsapp;
      const savedRegistration = await this.registrationRepository.save(
        tryWhatsapp.registration,
      );
      await savedRegistration.saveData(tryWhatsapp.registration.phoneNumber, {
        name: CustomDataAttributes.whatsappPhoneNumber,
      });
      this.tryWhatsappRepository.remove(tryWhatsapp);
    }
  }

  private async getRegistrationsWithPhoneNumber(
    phoneNumber,
  ): Promise<RegistrationEntity[]> {
    const registrationsWithPhoneNumber = await this.dataSource
      .getRepository(RegistrationEntity)
      .createQueryBuilder('registration')
      .select('registration')
      .leftJoin('registration.data', 'registration_data')
      .leftJoinAndSelect(
        'registration.whatsappPendingMessages',
        'whatsappPendingMessages',
      )
      .leftJoinAndSelect('registration.program', 'program')
      .leftJoin('registration_data.fspQuestion', 'fspQuestion')
      .where('registration.phoneNumber = :phoneNumber', {
        phoneNumber: phoneNumber,
      })
      .orWhere(
        new Brackets((qb) => {
          qb.where('registration_data.value = :whatsappPhoneNumber', {
            whatsappPhoneNumber: phoneNumber,
          }).andWhere('fspQuestion.name = :name', {
            name: CustomDataAttributes.whatsappPhoneNumber,
          });
        }),
      )
      .orderBy('whatsappPendingMessages.created', 'ASC')
      .getMany();

    if (!registrationsWithPhoneNumber.length) {
      console.log(
        'Incoming WhatsApp-message from non-registered phone-number: ',
        phoneNumber.substr(-5).padStart(phoneNumber.length, '*'),
      );
    }
    return registrationsWithPhoneNumber;
  }

  private async getRegistrationsWithOpenVouchers(
    registrations: RegistrationEntity[],
  ): Promise<RegistrationEntity[]> {
    // Trim registrations down to only those with outstanding vouchers
    const registrationIds = registrations.map((c) => c.id);
    const registrationWithVouchers = await this.registrationRepository.find({
      where: { id: In(registrationIds) },
      relations: ['images', 'images.barcode'],
    });

    const filteredRegistrations: RegistrationEntity[] = [];
    for (const r of registrationWithVouchers) {
      // Don't send more then 3 vouchers, so no vouchers of more than 2 payments ago
      const lastPayment = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('MAX(transaction.payment)', 'max')
        .where('transaction.programId = :programId', {
          programId: r.programId,
        })
        .getRawOne();
      const minimumPayment = lastPayment ? lastPayment.max - 2 : 0;

      r.images = r.images.filter(
        (image) =>
          !image.barcode.send && image.barcode.payment >= minimumPayment,
      );
      if (r.images.length > 0) {
        filteredRegistrations.push(r);
      }
    }
    return filteredRegistrations;
  }

  private cleanWhatsAppNr(value: string): string {
    return value.replace('whatsapp:+', '');
  }

  public async handleIncoming(
    callbackData: TwilioIncomingCallbackDto,
  ): Promise<void> {
    if (!callbackData.From) {
      throw new HttpException(
        `No "From" address specified.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const fromNumber = this.cleanWhatsAppNr(callbackData.From);

    // Get (potentially multiple) registrations on incoming phonenumber
    const registrationsWithPhoneNumber =
      await this.getRegistrationsWithPhoneNumber(fromNumber);

    const registrationsWithPendingMessage = registrationsWithPhoneNumber.filter(
      (registration: RegistrationEntity) =>
        registration.whatsappPendingMessages.length > 0,
    );

    const registrationsWithOpenVouchers =
      await this.getRegistrationsWithOpenVouchers(registrationsWithPhoneNumber);

    // If no registrations with outstanding barcodes or messages: send auto-reply
    if (
      registrationsWithOpenVouchers.length === 0 &&
      registrationsWithPendingMessage.length === 0
    ) {
      let program: ProgramEntity;
      // If phonenumber is found in active programs but the registration has no outstanding vouchers/messages use the corresponding program
      const registrationsWithPhoneNumberInActivePrograms =
        registrationsWithPhoneNumber.filter((registration) =>
          [
            ProgramPhase.registrationValidation,
            ProgramPhase.inclusion,
            ProgramPhase.payment,
          ].includes(registration.program.phase),
        );
      if (registrationsWithPhoneNumberInActivePrograms.length > 0) {
        program = registrationsWithPhoneNumberInActivePrograms[0].program;
      } else {
        // If only 1 program in database: use default reply of that program
        const programs = await this.dataSource
          .getRepository(ProgramEntity)
          .find();
        if (programs.length === 1) {
          program = programs[0];
        }
      }
      if (program) {
        const language =
          registrationsWithPhoneNumber[0]?.preferredLanguage ||
          this.fallbackLanguage;
        const whatsappDefaultReply =
          program.notifications[language]['whatsappReply'];
        await this.sendWhatsapp(
          whatsappDefaultReply,
          fromNumber,
          null,
          null,
          null,
          MessageContentType.defaultReply,
        );
        return;
      } else {
        // If multiple or 0 programs and phonenumber not found: use generic reply in code
        await this.sendWhatsapp(
          this.genericDefaultReplies[this.fallbackLanguage],
          fromNumber,
          null,
          null,
          null,
          MessageContentType.defaultReply,
        );
        return;
      }
    }

    // Start loop over (potentially) multiple PA's
    let firstVoucherSent = false;
    for await (const registration of registrationsWithOpenVouchers) {
      const intersolveBarcodesPerPa = registration.images.map(
        (image) => image.barcode,
      );
      const program = await this.dataSource
        .getRepository(ProgramEntity)
        .findOneBy({
          id: registration.programId,
        });
      const language = registration.preferredLanguage || this.fallbackLanguage;

      // Loop over current and (potentially) old barcodes per PA
      for await (const intersolveBarcode of intersolveBarcodesPerPa) {
        const mediaUrl = await this.imageCodeService.createVoucherUrl(
          intersolveBarcode,
        );

        // Only include text with first voucher (across PA's and payments)
        let message = firstVoucherSent
          ? ''
          : registrationsWithOpenVouchers.length > 1
          ? program.notifications[language]['whatsappVoucherMultiple'] ||
            program.notifications[language]['whatsappVoucher']
          : program.notifications[language]['whatsappVoucher'];
        message = message.split('{{1}}').join(intersolveBarcode.amount);
        await this.sendWhatsapp(
          message,
          fromNumber,
          IntersolvePayoutStatus.VoucherSent,
          mediaUrl,
          registration.id,
          MessageContentType.payment,
        );
        firstVoucherSent = true;

        // Save results
        intersolveBarcode.send = true;
        await this.intersolveBarcodeRepository.save(intersolveBarcode);
        await this.intersolveService.storeTransactionResult(
          intersolveBarcode.payment,
          intersolveBarcode.amount,
          registration.id,
          2,
          StatusEnum.success,
          null,
          registration.programId,
        );

        // Add small delay/sleep to ensure the order in which messages are received
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Send instruction message only once (outside of loops)
      if (registrationsWithOpenVouchers.length > 0) {
        await this.sendWhatsapp(
          '',
          fromNumber,
          null,
          EXTERNAL_API.voucherInstructionsUrl,
          registration.id,
          MessageContentType.paymentInstructions,
        );
      }
    }
    if (
      registrationsWithPendingMessage &&
      registrationsWithPendingMessage.length > 0
    ) {
      this.sendPendingWhatsappMessages(registrationsWithPendingMessage);
    }
  }
  private sendPendingWhatsappMessages(
    registrationsWithPendingMessage: RegistrationEntity[],
  ): void {
    for (const registration of registrationsWithPendingMessage) {
      if (registration.whatsappPendingMessages) {
        for (const message of registration.whatsappPendingMessages) {
          this.sendWhatsapp(
            message.body,
            message.to,
            message.messageType
              ? (message.messageType as IntersolvePayoutStatus)
              : null,
            message.mediaUrl,
            message.registrationId,
            message.contentType,
          ).then(() => {
            this.whatsappPendingMessageRepo.remove(message);
          });
        }
      }
    }
  }

  public async testTemplates(): Promise<object> {
    const sessionId = uuid();
    const programs = await this.programRepository.find();
    for (const program of programs) {
      await this.testProgramTemplate(program, sessionId);
    }
    return {
      sessionId: sessionId,
    };
  }

  private async testProgramTemplate(
    program: ProgramEntity,
    sessionId: string,
  ): Promise<void> {
    for (const [languageKey, notifications] of Object.entries(
      program.notifications,
    )) {
      await this.testLanguageTemplates(
        notifications,
        languageKey,
        program.id,
        sessionId,
      );
    }
  }

  private async testLanguageTemplates(
    messages: object,
    language: string,
    programId: number,
    sessionId: string,
  ): Promise<void> {
    for (const [messageKey, messageText] of Object.entries(messages)) {
      if (this.whatsappTemplatedMessageKeys.includes(messageKey)) {
        const payload = {
          body: messageText,
          messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
          from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
          statusCallback: EXTERNAL_API.whatsAppStatusTemplateTest,
          to: 'whatsapp:' + TWILIO_SANDBOX_WHATSAPP_NUMBER,
        };
        await twilioClient.messages.create(payload).then((message) => {
          this.whatsappTemplateTestRepository.save({
            sid: message.sid,
            language: language,
            programId: programId,
            messageKey: messageKey,
            sessionId: sessionId,
          });
          return 'Succes';
        });
      }
    }
  }

  public async storeTemplateTestResult(
    callbackData: TwilioStatusCallbackDto,
  ): Promise<void> {
    const tryWhatsappTemplateEntity =
      await this.whatsappTemplateTestRepository.findOne({
        where: { sid: callbackData.SmsSid },
      });
    if (tryWhatsappTemplateEntity) {
      if (!tryWhatsappTemplateEntity.succes) {
        tryWhatsappTemplateEntity.callback = JSON.stringify(callbackData);
        tryWhatsappTemplateEntity.succes =
          callbackData.MessageStatus === 'delivered';
        this.whatsappTemplateTestRepository.save(tryWhatsappTemplateEntity);
      }
    } else {
      throw new HttpException('Message sid not found', HttpStatus.NOT_FOUND);
    }
  }

  public async getWhatsappTemplateResult(sessionId: string): Promise<object> {
    const tryWhatsappTemplateEntity =
      await this.whatsappTemplateTestRepository.findOne({
        where: {
          sessionId: sessionId,
        },
      });
    if (!tryWhatsappTemplateEntity) {
      return {
        error: 'sessionId not found',
      };
    }
    const programs = await this.programRepository.find();
    const result = {};
    for (const program of programs) {
      result[`program-${program.id}`] = await this.getProgramTemplateResult(
        program,
        sessionId,
      );
    }
    return result;
  }

  private async getProgramTemplateResult(
    program: ProgramEntity,
    sessionId: string,
  ): Promise<object> {
    const resultOfProgram = {};
    for (const [languageKey, notifications] of Object.entries(
      program.notifications,
    )) {
      resultOfProgram[languageKey] = await this.getLanguageTemplateResults(
        notifications,
        languageKey,
        program.id,
        sessionId,
      );
    }
    return resultOfProgram;
  }

  private async getLanguageTemplateResults(
    messages: object,
    language: string,
    programId: number,
    sessionId: string,
  ): Promise<object> {
    const resultsLanguage = {};
    for (const messageKey in messages) {
      if (this.whatsappTemplatedMessageKeys.includes(messageKey)) {
        const whatsappTemplateTestEntity =
          await this.whatsappTemplateTestRepository.findOne({
            where: {
              language: language,
              messageKey: messageKey,
              programId: programId,
              sessionId: sessionId,
            },
            order: { created: 'ASC' },
          });
        if (whatsappTemplateTestEntity && whatsappTemplateTestEntity.succes) {
          resultsLanguage[messageKey] = {
            status: 'Succes',
            created: whatsappTemplateTestEntity.created,
          };
        } else if (whatsappTemplateTestEntity) {
          resultsLanguage[messageKey] = {
            status: 'Failed',
            created: whatsappTemplateTestEntity.created,
            callback: JSON.parse(whatsappTemplateTestEntity.callback),
          };
        } else {
          resultsLanguage[messageKey] = {
            status: 'No tests found for this notification',
          };
        }
      }
    }
    return resultsLanguage;
  }
}
