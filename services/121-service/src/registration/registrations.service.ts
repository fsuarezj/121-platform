import { RegistrationDataEntity } from './registration-data.entity';
import { TryWhatsappEntity } from './../notifications/whatsapp/try-whatsapp.entity';
import { WhatsappService } from './../notifications/whatsapp/whatsapp.service';
import { FinancialServiceProviderEntity } from './../fsp/financial-service-provider.entity';
import { SmsService } from './../notifications/sms/sms.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getRepository, In, Repository, SelectQueryBuilder } from 'typeorm';
import { ProgramEntity } from '../programs/program.entity';
import { UserEntity } from '../user/user.entity';
import { RegistrationEntity } from './registration.entity';
import {
  RegistrationStatusEnum,
  RegistrationStatusTimestampField,
} from './enum/registration-status.enum';
import { ProgramAnswer } from './dto/store-program-answers.dto';
import {
  AnswerTypes,
  Attribute,
  AttributeType,
  CustomDataAttributes,
} from './enum/custom-data-attributes';
import { LookupService } from '../notifications/lookup/lookup.service';
import { ProgramQuestionEntity } from '../programs/program-question.entity';
import { FspQuestionEntity } from '../fsp/fsp-question.entity';
import { FspName } from '../fsp/financial-service-provider.entity';
import { LanguageEnum } from './enum/language.enum';
import { RegistrationStatusChangeEntity } from './registration-status-change.entity';
import { InlusionScoreService } from './services/inclusion-score.service';
import { BulkImportService, ImportType } from './services/bulk-import.service';
import { ImportResult } from './dto/bulk-import.dto';
import { RegistrationResponse } from './dto/registration-response.model';
import { NoteDto } from './dto/note.dto';
import { validate } from 'class-validator';
import { DownloadData } from './dto/download-data.interface';
import { AnswerSet, FspAnswersAttrInterface } from '../fsp/fsp-interface';
import { Attributes } from './dto/update-attribute.dto';
import { ValidationIssueDataDto } from './dto/validation-issue-data.dto';
import { InclusionStatus } from './dto/inclusion-status.dto';
import { ReferenceIdDto, ReferenceIdsDto } from './dto/reference-id.dto';
import { MessageHistoryDto } from './dto/message-history.dto';
import { ProgramCustomAttributeEntity } from '../programs/program-custom-attribute.entity';
import { CustomAttributeType } from '../programs/dto/create-program-custom-attribute.dto';
import { ProgramService } from '../programs/programs.service';
import { RegistrationDataRelation } from './dto/registration-data-relation.model';
import { v4 as uuid } from 'uuid';

@Injectable()
export class RegistrationsService {
  @InjectRepository(RegistrationEntity)
  private readonly registrationRepository: Repository<RegistrationEntity>;
  @InjectRepository(RegistrationStatusChangeEntity)
  private readonly registrationStatusChangeRepository: Repository<
    RegistrationStatusChangeEntity
  >;
  @InjectRepository(UserEntity)
  private readonly userRepository: Repository<UserEntity>;
  @InjectRepository(ProgramEntity)
  private readonly programRepository: Repository<ProgramEntity>;
  @InjectRepository(RegistrationDataEntity)
  private readonly registrationDataRepository: Repository<
    RegistrationDataEntity
  >;
  @InjectRepository(ProgramQuestionEntity)
  private readonly programQuestionRepository: Repository<ProgramQuestionEntity>;
  @InjectRepository(ProgramCustomAttributeEntity)
  private readonly programCustomAttributeRepository: Repository<
    ProgramCustomAttributeEntity
  >;
  @InjectRepository(FinancialServiceProviderEntity)
  private readonly fspRepository: Repository<FinancialServiceProviderEntity>;
  @InjectRepository(FspQuestionEntity)
  private readonly fspAttributeRepository: Repository<FspQuestionEntity>;
  @InjectRepository(TryWhatsappEntity)
  private readonly tryWhatsappRepository: Repository<TryWhatsappEntity>;

  private readonly fallbackLanguage = 'en';

  public constructor(
    private readonly lookupService: LookupService,
    private readonly smsService: SmsService,
    private readonly whatsappService: WhatsappService,
    private readonly inclusionScoreService: InlusionScoreService,
    private readonly bulkImportService: BulkImportService,
    private readonly programService: ProgramService,
  ) {}

  private async findUserOrThrow(userId: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      const errors = 'This user is not known.';
      throw new HttpException({ errors }, HttpStatus.NOT_FOUND);
    }
    return user;
  }

  public async create(
    postData: CreateRegistrationDto,
    userId: number,
  ): Promise<RegistrationEntity> {
    const user = await this.findUserOrThrow(userId);
    let registration = new RegistrationEntity();
    registration.referenceId = postData.referenceId;
    registration.user = user;
    registration.program = await this.programRepository.findOne(
      postData.programId,
    );
    await this.registrationRepository.save(registration);
    return this.setRegistrationStatus(
      postData.referenceId,
      RegistrationStatusEnum.startedRegistration,
    );
  }

  public async setRegistrationStatus(
    referenceId: string,
    status: RegistrationStatusEnum,
  ): Promise<RegistrationEntity> {
    const registrationToUpdate = await this.getRegistrationFromReferenceId(
      referenceId,
    );
    registrationToUpdate.registrationStatus = status;
    return await this.registrationRepository.save(registrationToUpdate);
  }

  private async getRegistrationFromReferenceId(
    referenceId: string,
    relations: string[] = [],
  ): Promise<RegistrationEntity> {
    const registration = await this.registrationRepository.findOne({
      where: { referenceId: referenceId },
      relations: relations,
    });
    if (!registration) {
      const errors = 'This referenceId is not known.';
      throw new HttpException({ errors }, HttpStatus.NOT_FOUND);
    }
    registration['customData'] = await this.getCustomDataForReferenceId(
      registration.referenceId,
    );
    return registration;
  }

  public async storeProgramAnswers(
    referenceId: string,
    rawProgramAnswers: ProgramAnswer[],
  ): Promise<void> {
    const registration = await this.getRegistrationFromReferenceId(
      referenceId,
      ['program'],
    );
    const programAnswers = await this.cleanAnswers(
      rawProgramAnswers,
      registration.program.id,
    );
    for (let answer of programAnswers) {
      const programQuestion = await this.programQuestionRepository.findOne({
        where: { name: answer.programQuestionName },
      });
      if (programQuestion) {
        let storedAnswer = await this.registrationDataRepository.findOne({
          where: {
            registration: { id: registration.id },
            programQuestion: { id: programQuestion.id },
          },
        });
        if (!storedAnswer) {
          storedAnswer = new RegistrationDataEntity();
          storedAnswer.registration = registration;
          storedAnswer.programQuestion = programQuestion;
        }
        storedAnswer.value = answer.programAnswer;

        await this.registrationDataRepository.save(storedAnswer);
      }
    }
    await this.storePhoneNumberInRegistration(programAnswers, referenceId);
    await this.inclusionScoreService.calculateInclusionScore(referenceId);
    await this.inclusionScoreService.calculatePaymentAmountMultiplier(
      registration.program.id,
      referenceId,
    );
  }

  public async cleanAnswers(
    programAnswers: ProgramAnswer[],
    programId: number,
  ): Promise<ProgramAnswer[]> {
    const program = await this.programRepository.findOne(programId, {
      relations: ['programQuestions'],
    });
    const phonenumberTypedAnswers = [];
    for (let programQuestion of program.programQuestions) {
      if (programQuestion.answerType == AnswerTypes.tel) {
        phonenumberTypedAnswers.push(programQuestion.name);
      }
    }

    const cleanedAnswers = [];
    for (let programAnswer of programAnswers) {
      if (phonenumberTypedAnswers.includes(programAnswer.programQuestionName)) {
        programAnswer.programAnswer = await this.lookupService.lookupAndCorrect(
          programAnswer.programAnswer,
        );
      }
      cleanedAnswers.push(programAnswer);
    }
    return cleanedAnswers;
  }

  public async storePhoneNumberInRegistration(
    programAnswers: ProgramAnswer[],
    referenceId: string,
  ): Promise<void> {
    const registration = await this.getRegistrationFromReferenceId(
      referenceId,
      ['program'],
    );
    const phoneAnswer = programAnswers.find(
      answer => answer.programQuestionName === CustomDataAttributes.phoneNumber,
    );
    if (phoneAnswer) {
      const programId = registration.program.id;
      const cleanedAnswers = await this.cleanAnswers([phoneAnswer], programId);

      registration.phoneNumber = cleanedAnswers[0].programAnswer;

      await this.registrationRepository.save(registration);
    }
  }

  public async addFsp(
    referenceId: string,
    fspId: number,
  ): Promise<RegistrationEntity> {
    const registration = await this.getRegistrationFromReferenceId(referenceId);
    const fsp = await this.fspRepository.findOne({
      where: { id: fspId },
      relations: ['questions'],
    });
    registration.fsp = fsp;
    return await this.registrationRepository.save(registration);
  }

  public async addRegistrationData(
    referenceId: string,
    customDataKey: string,
    customDataValueRaw: string,
  ): Promise<RegistrationEntity> {
    const registration = await this.getRegistrationFromReferenceId(referenceId);
    const customDataValue = await this.cleanCustomDataIfPhoneNr(
      customDataKey,
      customDataValueRaw,
    );
    return registration.saveData(customDataValue, { name: customDataKey });
  }

  public async cleanCustomDataIfPhoneNr(
    customDataKey: string,
    customDataValue: string | number,
  ): Promise<string | number> {
    const answersTypeTel = [];
    const fspAttributesTypeTel = await this.fspAttributeRepository.find({
      where: { answerType: AnswerTypes.tel },
    });
    for (let fspAttr of fspAttributesTypeTel) {
      answersTypeTel.push(fspAttr.name);
    }
    const programQuestionsTypeTel = await this.programQuestionRepository.find({
      where: { answerType: AnswerTypes.tel },
    });
    for (let question of programQuestionsTypeTel) {
      answersTypeTel.push(question.name);
    }
    if (answersTypeTel.includes(customDataKey)) {
      return await this.lookupService.lookupAndCorrect(String(customDataValue));
    } else {
      return customDataValue;
    }
  }

  public async addPhone(
    referenceId: string,
    phoneNumber: string,
    preferredLanguage: LanguageEnum,
    useForInvitationMatching?: boolean,
  ): Promise<void> {
    const sanitizedPhoneNr = await this.lookupService.lookupAndCorrect(
      phoneNumber,
    );

    const importedRegistration = await this.findImportedRegistrationByPhoneNumber(
      sanitizedPhoneNr,
    );
    const currentRegistration = await this.getRegistrationFromReferenceId(
      referenceId,
      ['fsp'],
    );

    if (!useForInvitationMatching || !importedRegistration) {
      // If endpoint is used for other purpose OR no imported registration found  ..
      // .. continue with current registration
      // .. and store phone number and language
      if (!currentRegistration.phoneNumber) {
        currentRegistration.phoneNumber = sanitizedPhoneNr;
      }
      currentRegistration.preferredLanguage = preferredLanguage;
      await this.registrationRepository.save(currentRegistration);
      return;
    }

    // If imported registration found ..
    // .. then transfer relevant attributes from imported registration to current registration
    for (const d of importedRegistration.data) {
      d.registrationId = currentRegistration.id;
      this.registrationDataRepository.save(d);
    }
    currentRegistration.paymentAmountMultiplier =
      importedRegistration.paymentAmountMultiplier;

    // .. and store phone number and language
    currentRegistration.phoneNumber = sanitizedPhoneNr;
    currentRegistration.preferredLanguage = preferredLanguage;

    // Update the 'imported' registration-changes to the current registration
    const importedRegistrationChanges = await this.registrationStatusChangeRepository.find(
      {
        where: {
          registration: importedRegistration,
        },
      },
    );
    importedRegistrationChanges.forEach(
      i => (i.registration = currentRegistration),
    );
    await this.registrationStatusChangeRepository.save(
      importedRegistrationChanges,
    );
    // .. then delete the imported registration
    await this.registrationRepository.remove(importedRegistration);

    // .. and save the updated import-registration
    const updatedRegistration = await this.registrationRepository.save(
      currentRegistration,
    );

    // .. if imported registration status was noLongerEligible set to registeredWhileNoLongerEligible
    if (
      importedRegistration.registrationStatus ===
      RegistrationStatusEnum.noLongerEligible
    ) {
      await this.setRegistrationStatus(
        updatedRegistration.referenceId,
        RegistrationStatusEnum.registeredWhileNoLongerEligible,
      );
    }
  }

  private async findImportedRegistrationByPhoneNumber(
    phoneNumber: string,
  ): Promise<RegistrationEntity> {
    const importStatuses = [
      RegistrationStatusEnum.imported,
      RegistrationStatusEnum.invited,
      RegistrationStatusEnum.noLongerEligible,
    ];
    return await this.registrationRepository.findOne({
      where: {
        phoneNumber: phoneNumber,
        registrationStatus: In(importStatuses),
      },
      relations: ['fsp'],
    });
  }

  public async addQrIdentifier(
    referenceId: string,
    qrIdentifier: string,
  ): Promise<void> {
    const registration = await this.getRegistrationFromReferenceId(referenceId);

    const duplicateIdentifier = await this.registrationRepository.findOne({
      where: { qrIdentifier: qrIdentifier },
    });
    if (duplicateIdentifier) {
      const errors = 'This QR identifier already exists';
      throw new HttpException({ errors }, HttpStatus.NOT_FOUND);
    }
    registration.qrIdentifier = qrIdentifier;
    await this.registrationRepository.save(registration);
  }

  public async register(referenceId: string): Promise<void> {
    const registration = await this.getRegistrationFromReferenceId(
      referenceId,
      ['program'],
    );

    if (
      RegistrationStatusEnum.startedRegistration !==
      registration.registrationStatus
    ) {
      const errors = `Registration status is not 'startedRegistration'`;
      throw new HttpException(errors, HttpStatus.NOT_FOUND);
    }

    await this.setRegistrationStatus(
      referenceId,
      RegistrationStatusEnum.registered,
    );
    this.inclusionScoreService.calculateInclusionScore(referenceId);

    this.sendTextMessage(
      registration,
      registration.program.id,
      null,
      RegistrationStatusEnum.registered,
    );
  }

  public async importBulk(
    csvFile,
    programId: number,
    userId: number,
  ): Promise<ImportResult> {
    const program = await this.findProgramOrThrow(programId);
    return await this.bulkImportService.importBulk(csvFile, program, userId);
  }

  public async getImportRegistrationsTemplate(
    programId: number,
    type: ImportType,
  ): Promise<string[]> {
    if (!Object.values(ImportType).includes(type)) {
      throw new HttpException('Wrong import type', HttpStatus.BAD_REQUEST);
    }
    return await this.bulkImportService.getImportRegistrationsTemplate(
      programId,
      type,
    );
  }

  public async importRegistrations(
    csvFile,
    programId: number,
  ): Promise<ImportResult> {
    const program = await this.findProgramOrThrow(programId);
    return await this.bulkImportService.importRegistrations(csvFile, program);
  }

  private async findProgramOrThrow(programId: number): Promise<ProgramEntity> {
    const program = await this.programRepository.findOne(programId, {
      relations: ['programCustomAttributes'],
    });
    if (!program) {
      const errors = 'Program not found.';
      throw new HttpException({ errors }, HttpStatus.NOT_FOUND);
    }
    return program;
  }

  public customDataEntrySubQuery(
    subQuery: SelectQueryBuilder<any>,
    relation: RegistrationDataRelation,
  ): SelectQueryBuilder<any> {
    const uniqueSubQueryId = uuid()
      .replace(/-/g, '')
      .toLowerCase();
    subQuery = subQuery
      .where(`"${uniqueSubQueryId}"."registrationId" = registration.id`)
      .from(RegistrationDataEntity, uniqueSubQueryId);
    if (relation.programQuestionId) {
      subQuery = subQuery.andWhere(
        `"${uniqueSubQueryId}"."programQuestionId" = ${relation.programQuestionId}`,
      );
    } else if (relation.monitoringQuestionId) {
      subQuery = subQuery.andWhere(
        `"${uniqueSubQueryId}"."monitoringQuestionId" = ${relation.monitoringQuestionId}`,
      );
    } else if (relation.programCustomAttributeId) {
      subQuery = subQuery.andWhere(
        `"${uniqueSubQueryId}"."programCustomAttributeId" = ${relation.programCustomAttributeId}`,
      );
    } else if (relation.fspQuestionId) {
      subQuery = subQuery.andWhere(
        `"${uniqueSubQueryId}"."fspQuestionId" = ${relation.fspQuestionId}`,
      );
    }
    subQuery.addSelect(`"${uniqueSubQueryId}".value`);
    return subQuery;
  }

  private customDataSubQuery(subQuery: SelectQueryBuilder<any>): any {
    return subQuery
      .where('rd."registrationId" = registration.id')
      .from(RegistrationDataEntity, 'rd')
      .leftJoin('rd.programQuestion', 'programQuestion')
      .leftJoin('rd.fspQuestion', 'fspQuestion')
      .leftJoin('rd.monitoringQuestion', 'monitoringQuestion')
      .leftJoin('rd.programCustomAttribute', 'programCustomAttribute')
      .addSelect(
        `json_build_object(
                'values', array_agg("rd"."value"),
                'keys', array_agg( CASE
          WHEN ("programQuestion"."name" is not NULL) THEN "programQuestion"."name"
          WHEN ("fspQuestion"."name" is not NULL) THEN "fspQuestion"."name"
          WHEN ("monitoringQuestion"."name" is not NULL) THEN "monitoringQuestion"."name"
          WHEN ("programCustomAttribute"."name" is not NULL) THEN "programCustomAttribute"."name"
          ELSE ''
        END ))`,
        'name',
      );
  }

  private buildCustomDataObject(input: {
    values: string[];
    keys: string[];
  }): object {
    const customData = {};
    for (const i in input['keys']) {
      customData[input['keys'][i]] = input['values'][i];
    }
    return customData;
  }

  private async getCustomDataForReferenceId(
    referenceId: string,
  ): Promise<object> {
    const result = await this.registrationRepository
      .createQueryBuilder('registration')
      .select(subQuery => {
        return this.customDataSubQuery(subQuery);
      }, 'customData')
      .where('registration."referenceId" = :referenceId', {
        referenceId: referenceId,
      })
      .getRawOne();
    return this.buildCustomDataObject(result['customData']);
  }

  public async getRegistrationsForProgram(
    programId: number,
    includePersonalData: boolean,
  ): Promise<RegistrationResponse[]> {
    let q = await this.registrationRepository
      .createQueryBuilder('registration')
      .select('registration.id', 'id')
      .distinctOn(['registration.id'])
      .orderBy(`registration.id`, 'ASC')
      .addSelect('registration.referenceId', 'referenceId')
      .addSelect('registration.registrationStatus', 'status')
      .addSelect('registration.preferredLanguage', 'preferredLanguage')
      .addSelect('registration.inclusionScore', 'inclusionScore')
      .addSelect('fsp.fsp', 'fsp')
      .addSelect(
        'registration.paymentAmountMultiplier',
        'paymentAmountMultiplier',
      )
      .addSelect(
        `${RegistrationStatusEnum.startedRegistration}.created`,
        RegistrationStatusTimestampField.startedRegistrationDate,
      )
      .addOrderBy(
        `${RegistrationStatusEnum.startedRegistration}.created`,
        'DESC',
      )
      .addSelect(
        `${RegistrationStatusEnum.imported}.created`,
        RegistrationStatusTimestampField.importedDate,
      )
      .addSelect(subQuery => {
        return this.customDataSubQuery(subQuery);
      }, 'customData')
      .addOrderBy(`${RegistrationStatusEnum.imported}.created`, 'DESC')
      .addSelect(
        `${RegistrationStatusEnum.invited}.created`,
        RegistrationStatusTimestampField.invitedDate,
      )
      .addOrderBy(`${RegistrationStatusEnum.invited}.created`, 'DESC')
      .addSelect(
        `${RegistrationStatusEnum.noLongerEligible}.created`,
        RegistrationStatusTimestampField.noLongerEligibleDate,
      )
      .addOrderBy(`${RegistrationStatusEnum.noLongerEligible}.created`, 'DESC')
      .addSelect(
        `${RegistrationStatusEnum.registered}.created`,
        RegistrationStatusTimestampField.registeredDate,
      )
      .addOrderBy(`${RegistrationStatusEnum.registered}.created`, 'DESC')
      .addSelect(
        `${RegistrationStatusEnum.selectedForValidation}.created`,
        RegistrationStatusTimestampField.selectedForValidationDate,
      )
      .addOrderBy(
        `${RegistrationStatusEnum.selectedForValidation}.created`,
        'DESC',
      )
      .addSelect(
        `${RegistrationStatusEnum.validated}.created`,
        RegistrationStatusTimestampField.validationDate,
      )
      .addOrderBy(`${RegistrationStatusEnum.validated}.created`, 'DESC')
      .addSelect(
        `${RegistrationStatusEnum.included}.created`,
        RegistrationStatusTimestampField.inclusionDate,
      )
      .addOrderBy(`${RegistrationStatusEnum.included}.created`, 'DESC')
      .addSelect(
        `${RegistrationStatusEnum.inclusionEnded}.created`,
        RegistrationStatusTimestampField.inclusionEndDate,
      )
      .addOrderBy(`${RegistrationStatusEnum.inclusionEnded}.created`, 'DESC')
      .addSelect(
        `${RegistrationStatusEnum.rejected}.created`,
        RegistrationStatusTimestampField.rejectionDate,
      )
      .addSelect('registration.phoneNumber', 'phoneNumber')
      .addSelect('data.value', 'data')
      .addOrderBy(`${RegistrationStatusEnum.rejected}.created`, 'DESC')
      .leftJoin('registration.data', 'data')
      .leftJoin('data.programQuestion', 'programQuestion')
      .leftJoin('registration.fsp', 'fsp')
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.startedRegistration,
        `registration.id = ${RegistrationStatusEnum.startedRegistration}.registrationId AND ${RegistrationStatusEnum.startedRegistration}.registrationStatus = '${RegistrationStatusEnum.startedRegistration}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.imported,
        `registration.id = ${RegistrationStatusEnum.imported}.registrationId AND ${RegistrationStatusEnum.imported}.registrationStatus = '${RegistrationStatusEnum.imported}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.invited,
        `registration.id = ${RegistrationStatusEnum.invited}.registrationId AND ${RegistrationStatusEnum.invited}.registrationStatus = '${RegistrationStatusEnum.invited}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.noLongerEligible,
        `registration.id = ${RegistrationStatusEnum.noLongerEligible}.registrationId AND ${RegistrationStatusEnum.noLongerEligible}.registrationStatus = '${RegistrationStatusEnum.noLongerEligible}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.registered,
        `registration.id = ${RegistrationStatusEnum.registered}.registrationId AND ${RegistrationStatusEnum.registered}.registrationStatus = '${RegistrationStatusEnum.registered}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.selectedForValidation,
        `registration.id = ${RegistrationStatusEnum.selectedForValidation}.registrationId AND ${RegistrationStatusEnum.selectedForValidation}.registrationStatus = '${RegistrationStatusEnum.selectedForValidation}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.validated,
        `registration.id = ${RegistrationStatusEnum.validated}.registrationId AND ${RegistrationStatusEnum.validated}.registrationStatus = '${RegistrationStatusEnum.validated}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.included,
        `registration.id = ${RegistrationStatusEnum.included}.registrationId AND ${RegistrationStatusEnum.included}.registrationStatus = '${RegistrationStatusEnum.included}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.inclusionEnded,
        `registration.id = ${RegistrationStatusEnum.inclusionEnded}.registrationId AND ${RegistrationStatusEnum.inclusionEnded}.registrationStatus = '${RegistrationStatusEnum.inclusionEnded}'`,
      )
      .leftJoin(
        RegistrationStatusChangeEntity,
        RegistrationStatusEnum.rejected,
        `registration.id = ${RegistrationStatusEnum.rejected}.registrationId AND ${RegistrationStatusEnum.rejected}.registrationStatus = '${RegistrationStatusEnum.rejected}'`,
      )
      .where('registration.program.id = :programId', { programId: programId });

    if (!includePersonalData) {
      const rows = await q.getRawMany();
      const responseRows = [];
      for (let row of rows) {
        row['customData'] = this.buildCustomDataObject(row['customData']);
        row['hasPhoneNumber'] = !!(
          row.phoneNumber || row.customData[CustomDataAttributes.phoneNumber]
        );
        delete row.customData;
        delete row.phoneNumber;
        responseRows.push(row);
      }
      return responseRows;
    }

    q = q.addSelect('registration.note', 'note');

    const rows = await q.getRawMany();
    const responseRows = [];
    const paTableAttributes = await this.programService.getPaTableAttributes(
      programId,
    );
    for (let row of rows) {
      row['customData'] = this.buildCustomDataObject(row['customData']);
      row['name'] = this.getName(row.customData);
      row['hasNote'] = !!row.note;
      row['hasPhoneNumber'] = !!(
        row.phoneNumber || row.customData[CustomDataAttributes.phoneNumber]
      );
      row['phoneNumber'] =
        row.phoneNumber || row.customData[CustomDataAttributes.phoneNumber];
      row['paTableAttributes'] = {};
      for (let attribute of paTableAttributes) {
        const value = this.mapAttributeByType(attribute, row.customData);

        row['paTableAttributes'][attribute.name] = {
          type: attribute.type,
          value,
        };
      }
      delete row.customData;
      responseRows.push(row);
    }
    return responseRows;
  }

  public async getLatestDateForRegistrationStatus(
    registrationId: number,
    status: RegistrationStatusEnum,
  ): Promise<Date> {
    const registrationStatusChange = await this.registrationStatusChangeRepository.findOne(
      {
        where: {
          registration: { id: registrationId },
          registrationStatus: status,
        },
        order: { created: 'DESC' },
      },
    );
    return registrationStatusChange ? registrationStatusChange.created : null;
  }

  public getName(customData): string {
    if (customData[CustomDataAttributes.name]) {
      return customData[CustomDataAttributes.name];
    } else if (customData[CustomDataAttributes.fathersName]) {
      return (
        customData[CustomDataAttributes.lastName] +
        (customData[CustomDataAttributes.firstName]
          ? ' ' + customData[CustomDataAttributes.firstName]
          : '') +
        (customData[CustomDataAttributes.fathersName]
          ? ' ' + customData[CustomDataAttributes.fathersName]
          : '')
      );
    } else if (customData[CustomDataAttributes.firstName]) {
      return (
        customData[CustomDataAttributes.firstName] +
        (customData[CustomDataAttributes.secondName]
          ? ' ' + customData[CustomDataAttributes.secondName]
          : '') +
        (customData[CustomDataAttributes.thirdName]
          ? ' ' + customData[CustomDataAttributes.thirdName]
          : '')
      );
    } else if (customData[CustomDataAttributes.nameFirst]) {
      return (
        customData[CustomDataAttributes.nameFirst] +
        (customData[CustomDataAttributes.nameLast]
          ? ' ' + customData[CustomDataAttributes.nameLast]
          : '')
      );
    } else {
      return '';
    }
  }

  public transformRegistrationByNamingConvention(
    nameColumns: string[],
    registrationObject: object,
  ): object {
    const fullnameConcat = [];
    for (const nameColumn of nameColumns) {
      fullnameConcat.push(registrationObject[nameColumn]);
      delete registrationObject[nameColumn];
    }
    registrationObject['name'] = fullnameConcat.join(' ');
    return registrationObject;
  }

  public getDateColumPerStatus(
    filterStatus: RegistrationStatusEnum,
  ): RegistrationStatusTimestampField {
    switch (filterStatus) {
      case RegistrationStatusEnum.imported:
        return RegistrationStatusTimestampField.importedDate;
      case RegistrationStatusEnum.invited:
        return RegistrationStatusTimestampField.invitedDate;
      case RegistrationStatusEnum.noLongerEligible:
        return RegistrationStatusTimestampField.noLongerEligibleDate;
      case RegistrationStatusEnum.startedRegistration:
        return RegistrationStatusTimestampField.startedRegistrationDate;
      case RegistrationStatusEnum.registered:
        return RegistrationStatusTimestampField.registeredDate;
      case RegistrationStatusEnum.selectedForValidation:
        return RegistrationStatusTimestampField.selectedForValidationDate;
      case RegistrationStatusEnum.validated:
        return RegistrationStatusTimestampField.validationDate;
      case RegistrationStatusEnum.included:
        return RegistrationStatusTimestampField.inclusionDate;
      case RegistrationStatusEnum.inclusionEnded:
        return RegistrationStatusTimestampField.inclusionEndDate;
      case RegistrationStatusEnum.rejected:
        return RegistrationStatusTimestampField.rejectionDate;
      case RegistrationStatusEnum.registeredWhileNoLongerEligible:
        return RegistrationStatusTimestampField.registeredWhileNoLongerEligibleDate;
    }
  }

  public async setAttribute(
    referenceId: string,
    attribute: Attributes | string,
    value: string | number,
  ): Promise<RegistrationEntity> {
    let registration = await this.getRegistrationFromReferenceId(referenceId, [
      'program',
    ]);
    value = await this.cleanCustomDataIfPhoneNr(attribute, value);

    if (typeof registration[attribute] !== 'undefined') {
      registration[attribute] = value;
    }

    // This checks registration attributes (like paymentAmountMultiplier)
    const errors = await validate(registration);
    if (errors.length > 0) {
      throw new HttpException({ errors }, HttpStatus.BAD_REQUEST);
    }

    await registration.saveData(value, { name: attribute });

    const savedRegistration = await this.registrationRepository.save(
      registration,
    );
    const calculatedRegistration = await this.inclusionScoreService.calculatePaymentAmountMultiplier(
      registration.program.id,
      referenceId,
    );
    if (calculatedRegistration) {
      return this.getRegistrationFromReferenceId(
        calculatedRegistration.referenceId,
      );
    }
    return this.getRegistrationFromReferenceId(savedRegistration.referenceId);
  }

  public async updateNote(referenceId: string, note: string): Promise<NoteDto> {
    const registration = await this.getRegistrationFromReferenceId(referenceId);
    registration.note = note;
    registration.noteUpdated = new Date();
    await this.registrationRepository.save(registration);
    const newNote = new NoteDto();
    newNote.note = registration.note;
    newNote.noteUpdated = registration.noteUpdated;
    return newNote;
  }

  public async retrieveNote(referenceId: string): Promise<NoteDto> {
    const registration = await this.getRegistrationFromReferenceId(referenceId);
    const note = new NoteDto();
    note.note = registration.note;
    note.noteUpdated = registration.noteUpdated;
    return note;
  }

  public async updateRegistrationStatusBatch(
    programId: number,
    referenceIdsDto: ReferenceIdsDto,
    registrationStatus: RegistrationStatusEnum,
    message?: string,
  ): Promise<void> {
    await this.findProgramOrThrow(programId);

    for (let referenceId of referenceIdsDto.referenceIds) {
      const registration = await this.setRegistrationStatus(
        referenceId,
        registrationStatus,
      );

      if (message) {
        this.sendTextMessage(registration, programId, message);
      }
    }
  }

  public async invite(
    programId: number,
    phoneNumbers: string,
    message?: string,
  ): Promise<void> {
    const program = await this.findProgramOrThrow(programId);

    for (let phoneNumber of JSON.parse(phoneNumbers['phoneNumbers'])) {
      const sanitizedPhoneNr = await this.lookupService.lookupAndCorrect(
        phoneNumber,
      );
      let registration = await this.registrationRepository.findOne({
        where: { phoneNumber: sanitizedPhoneNr },
      });
      if (!registration) continue;

      this.setRegistrationStatus(
        registration.referenceId,
        RegistrationStatusEnum.invited,
      );

      if (message) {
        this.sendTextMessage(
          registration,
          programId,
          message,
          null,
          program.tryWhatsAppFirst,
        );
      }
    }
  }

  private async sendTextMessage(
    registration: RegistrationEntity,
    programId: number,
    message?: string,
    key?: string,
    tryWhatsApp: boolean = false,
  ): Promise<void> {
    if (!message && !key) {
      throw new HttpException(
        'A message or a key should be supplied.',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      let whatsappNumber = (
        await registration.getRegistrationDataByName(
          CustomDataAttributes.whatsappPhoneNumber,
        )
      ).value;

      const messageText = message
        ? message
        : await this.getNotificationText(
            registration.preferredLanguage,
            key,
            programId,
          );
      if (whatsappNumber) {
        this.whatsappService.queueMessageSendTemplate(
          messageText,
          whatsappNumber,
          null,
          null,
          registration.id,
          registration.preferredLanguage,
        );
      } else if (tryWhatsApp && registration.phoneNumber) {
        this.tryWhatsapp(registration, messageText);
      } else if (registration.phoneNumber) {
        this.smsService.sendSms(
          messageText,
          registration.phoneNumber,
          registration.id,
        );
      } else {
        throw new HttpException(
          'A recipientPhoneNr should be supplied.',
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error) {
      console.log('error: ', error);
    }
  }

  private async tryWhatsapp(
    registration: RegistrationEntity,
    messageText,
  ): Promise<void> {
    this.whatsappService
      .queueMessageSendTemplate(
        messageText,
        registration.phoneNumber,
        null,
        null,
        registration.id,
        registration.preferredLanguage,
      )
      .then(result => {
        // Store the sid of a whatsapp message of which we do not know if the receiver registered on whatsapp
        const tryWhatsapp = {
          sid: result,
          registration,
        };
        this.tryWhatsappRepository.save(tryWhatsapp);
      });
  }

  public async getNotificationText(
    language: string,
    key: string,
    programId: number,
  ): Promise<string> {
    const program = await getRepository(ProgramEntity).findOne(programId);
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

  public async searchRegistration(
    rawPhoneNumber?: string,
    name?: string,
    id?: number,
  ): Promise<RegistrationEntity[]> {
    const phoneNumber = await this.lookupService.lookupAndCorrect(
      rawPhoneNumber,
    );

    const registrations = await this.registrationRepository.find({
      relations: ['fsp'],
    });

    return registrations.filter(async registration => {
      const registrationName = (
        await registration.getRegistrationDataByName(CustomDataAttributes.name)
      ).value;
      const registrationNameFirst = (
        await registration.getRegistrationDataByName(
          CustomDataAttributes.nameFirst,
        )
      ).value;
      const registrationNameLast = (
        await registration.getRegistrationDataByName(
          CustomDataAttributes.nameLast,
        )
      ).value;
      const registrationFirstName = (
        await registration.getRegistrationDataByName(
          CustomDataAttributes.firstName,
        )
      ).value;
      const registrationSecondName = (
        await registration.getRegistrationDataByName(
          CustomDataAttributes.secondName,
        )
      ).value;
      const registrationThirdName = (
        await registration.getRegistrationDataByName(
          CustomDataAttributes.thirdName,
        )
      ).value;
      const registrationPhoneNumber = (
        await registration.getRegistrationDataByName(
          CustomDataAttributes.phoneNumber,
        )
      ).value;
      const registrationWhatsappPhoneNumber = (
        await registration.getRegistrationDataByName(
          CustomDataAttributes.whatsappPhoneNumber,
        )
      ).value;
      return (
        (name &&
          (registrationName === name ||
            registrationNameFirst === name ||
            registrationNameLast === name ||
            registrationFirstName === name ||
            registrationSecondName === name ||
            registrationThirdName === name)) ||
        (phoneNumber &&
          (registrationPhoneNumber === phoneNumber ||
            registrationWhatsappPhoneNumber === phoneNumber ||
            registration.phoneNumber === phoneNumber)) ||
        registration.id === id
      );
    });
  }

  public async updateChosenFsp(
    referenceId: string,
    newFspName: FspName,
    newFspAttributesRaw: object,
  ): Promise<RegistrationEntity> {
    //Identify new FSP
    const newFsp = await this.fspRepository.findOne({
      where: { fsp: newFspName },
      relations: ['questions'],
    });
    if (!newFsp) {
      const errors = `FSP with this name not found`;
      throw new HttpException({ errors }, HttpStatus.NOT_FOUND);
    }

    // Check if required attributes are present

    newFsp.questions.forEach(requiredAttribute => {
      if (
        !newFspAttributesRaw ||
        !Object.keys(newFspAttributesRaw).includes(requiredAttribute.name)
      ) {
        const requiredAttributes = newFsp.questions.map(a => a.name).join(', ');
        const errors = `Not all required FSP attributes provided correctly: ${requiredAttributes}`;
        throw new HttpException({ errors }, HttpStatus.BAD_REQUEST);
      }
    });

    // Check if potential phonenumbers are correct and clean them
    const newFspAttributes = {};
    for (const [key, value] of Object.entries(newFspAttributesRaw)) {
      newFspAttributes[key] = await this.cleanCustomDataIfPhoneNr(key, value);
    }

    // Get registration by referenceId
    const registration = await this.registrationRepository.findOne({
      where: { referenceId: referenceId },
      relations: ['fsp', 'fsp.attributes'],
    });
    if (registration.fsp?.id === newFsp.id) {
      const errors = `New FSP is the same as existing FSP for this Person Affected.`;
      throw new HttpException({ errors }, HttpStatus.BAD_REQUEST);
    }
    // Remove old attributes
    const oldFsp = registration.fsp;
    for (const attribute of oldFsp?.questions) {
      const regData = await registration.getRegistrationDataByName(
        attribute.name,
      );
      this.registrationDataRepository.delete(regData);
    }

    // Update FSP
    const updatedRegistration = await this.addFsp(referenceId, newFsp.id);

    // Add new attributes

    for (const attribute of updatedRegistration.fsp.questions) {
      await this.addRegistrationData(
        referenceId,
        attribute.name,
        newFspAttributes[attribute.name],
      );
    }
    return await this.registrationRepository.save(updatedRegistration);
  }

  public async deleteBatch(referenceIdsDto: ReferenceIdsDto): Promise<void> {
    const registrations = [];
    const users = [];
    for (let referenceId of referenceIdsDto.referenceIds) {
      const registration = await this.registrationRepository.findOne({
        where: { referenceId: referenceId },
        relations: ['user'],
      });
      if (!registration) {
        throw new HttpException(
          `Registration '${referenceId}' is not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      registrations.push(registration);
      // Also delete user if present (not in the case of imported PAs)
      if (registration.user) {
        const user = await this.userRepository.findOne(registration.user.id);
        users.push(user);
      }
    }
    await this.registrationRepository.remove(registrations);
    await this.userRepository.remove(users);
  }

  public async downloadValidationData(userId: number): Promise<DownloadData> {
    const user = await this.userRepository.findOne(userId, {
      relations: ['programAssignments', 'programAssignments.program'],
    });
    if (
      !user ||
      !user.programAssignments ||
      user.programAssignments.length === 0
    ) {
      const errors = 'User not found or no assigned programs';
      throw new HttpException({ errors }, HttpStatus.UNAUTHORIZED);
    }
    const programIds = user.programAssignments.map(p => p.program.id);
    const data = {
      answers: await this.getAllProgramAnswers(user),
      fspData: await this.getAllFspAnswers(programIds),
      qrRegistrationMapping: await this.getQrRegistrationMapping(programIds),
      programIds: user.programAssignments.map(assignment => {
        return assignment.program.id;
      }),
    };
    return data;
  }

  public async getAllProgramAnswers(
    user: UserEntity,
  ): Promise<RegistrationDataEntity[]> {
    const programIds = user.programAssignments.map(p => p.program.id);
    const registrationsToValidate = await getRepository(RegistrationEntity)
      .createQueryBuilder('registration')
      .addSelect('"referenceId"')
      .leftJoinAndSelect('registration.program', 'program')
      .leftJoinAndSelect('registration.data', 'data')
      .leftJoinAndSelect('data.programQuestion', 'programQuestion')
      .andWhere('registration.program.id IN (:...programIds)', {
        programIds: programIds,
      })
      .andWhere('"registrationStatus" IN (:...registrationStatuses)', {
        registrationStatuses: [
          RegistrationStatusEnum.registered,
          RegistrationStatusEnum.selectedForValidation,
        ],
      })
      .andWhere('data.programQuestionId is not null', {
        programIds: programIds,
      })
      .getMany();

    let answers = [];
    for (const r of registrationsToValidate) {
      for (const a of r.data) {
        a['referenceId'] = r.referenceId;
        a['programId'] = r.program.id;
      }
      answers = [...answers, ...r.data];
    }
    return answers;
  }

  public async getAllFspAnswers(
    programIds: number[],
  ): Promise<FspAnswersAttrInterface[]> {
    const registrations = await getRepository(RegistrationEntity)
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.fsp', 'fsp')
      .leftJoinAndSelect('fsp.questions', ' fsp_question.fsp')
      .leftJoin('registration.program', 'program')
      .where('registration.fsp IS NOT NULL')
      .andWhere('registration.program.id IN (:...programIds)', {
        programIds: programIds,
      })
      .andWhere('"registrationStatus" IN (:...registrationStatuses)', {
        registrationStatuses: [
          RegistrationStatusEnum.registered,
          RegistrationStatusEnum.selectedForValidation,
        ],
      })
      .getMany();

    const fspDataPerRegistration = [];
    for (const registration of registrations) {
      const answers = await this.getFspAnswers(registration);
      const fspData = {
        attributes: registration.fsp.questions,
        answers: answers,
        referenceId: registration.referenceId,
      };
      fspDataPerRegistration.push(fspData);
    }
    return fspDataPerRegistration;
  }

  public async getFspAnswers(
    registration: RegistrationEntity,
  ): Promise<AnswerSet> {
    const fspAttributeNames = [];
    for (const attribute of registration.fsp.questions) {
      fspAttributeNames.push(attribute.name);
    }
    const fspCustomData = {};
    for (const key in registration.data) {
      console.log('key: ', key);
      if (fspAttributeNames.includes(key)) {
        fspCustomData[key] = {
          name: key,
          value: (await registration.getRegistrationDataByName(key)).value,
        };
      }
    }
    return fspCustomData;
  }

  public async getQrRegistrationMapping(
    programIds: number[],
  ): Promise<RegistrationEntity[]> {
    return await this.registrationRepository
      .createQueryBuilder('registration')
      .select(['registration.qrIdentifier', 'registration.referenceId'])
      .where('registration."programId" IN (:...programIds)', {
        programIds: programIds,
      })
      .andWhere('"registrationStatus" IN (:...registrationStatuses)', {
        registrationStatuses: [
          RegistrationStatusEnum.registered,
          RegistrationStatusEnum.selectedForValidation,
        ],
      })
      .getMany();
  }

  // AW: get answers to attributes for a given PA (identified first through referenceId/QR)
  public async get(referenceId: string): Promise<RegistrationEntity> {
    return await this.registrationRepository.findOne({
      where: { referenceId: referenceId },
      relations: ['program', 'programAnswers', 'program.programQuestions'],
    });
  }

  public async getFspAnswersAttributes(
    referenceId: string,
  ): Promise<FspAnswersAttrInterface> {
    const qb = await getRepository(RegistrationEntity)
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.fsp', 'fsp')
      .leftJoinAndSelect('fsp.attributes', ' fsp_attribute.fsp')
      .where('registration.referenceId = :referenceId', {
        referenceId: referenceId,
      });
    const registration = await qb.getOne();
    const fspAnswers = await this.getFspAnswers(registration);
    return {
      attributes: registration.fsp.questions,
      answers: fspAnswers,
      referenceId: referenceId,
    };
  }

  // Used by Aidworker
  public async issueValidation(payload: ValidationIssueDataDto): Promise<void> {
    await this.storeProgramAnswers(payload.referenceId, payload.programAnswers);
    await this.setRegistrationStatus(
      payload.referenceId,
      RegistrationStatusEnum.validated,
    );
  }

  public async findReferenceIdWithQrIdentifier(
    qrIdentifier: string,
  ): Promise<ReferenceIdDto> {
    let registration = await this.registrationRepository.findOne({
      where: { qrIdentifier: qrIdentifier },
    });
    if (!registration) {
      const errors = 'No registration found for QR';
      throw new HttpException({ errors }, HttpStatus.NOT_FOUND);
    }
    return { referenceId: registration.referenceId };
  }

  public async getInclusionStatus(
    programId: number,
    referenceId: string,
  ): Promise<InclusionStatus> {
    let registration = await this.getRegistrationFromReferenceId(referenceId);

    await this.findProgramOrThrow(programId);

    let inclusionStatus: InclusionStatus;

    if (registration.registrationStatus === RegistrationStatusEnum.included) {
      inclusionStatus = { status: RegistrationStatusEnum.included };
    } else if (
      registration.registrationStatus === RegistrationStatusEnum.rejected
    ) {
      inclusionStatus = { status: RegistrationStatusEnum.rejected };
    } else {
      inclusionStatus = { status: 'unavailable' };
    }

    return inclusionStatus;
  }

  public async sendCustomTextMessage(
    referenceIds: string[],
    message: string,
  ): Promise<void> {
    const validRegistrations: RegistrationEntity[] = [];
    for (const referenceId of referenceIds) {
      const registration = await this.getRegistrationFromReferenceId(
        referenceId,
        ['program'],
      );
      if (!registration.phoneNumber) {
        const errors = `Registration with referenceId: ${registration.referenceId} has no phonenumber.`;
        throw new HttpException({ errors }, HttpStatus.NOT_FOUND);
      }
      validRegistrations.push(registration);
    }
    for (const validRegistration of validRegistrations) {
      this.sendTextMessage(
        validRegistration,
        validRegistration.program.id,
        message,
      );
    }
  }

  public async getMessageHistoryRegistration(
    referenceId: string,
  ): Promise<MessageHistoryDto[]> {
    const messageHistoryArray = await this.registrationRepository
      .createQueryBuilder('registration')
      .select([
        'twilioMessage.dateCreated as created',
        'twilioMessage.from as from',
        'twilioMessage.to as to',
        'twilioMessage.body as body',
        'twilioMessage.status as status',
        'twilioMessage.type as type',
        'twilioMessage.mediaUrl as mediaUrl',
      ])
      .leftJoin('registration.twilioMessages', 'twilioMessage')
      .where('registration.referenceId = :referenceId', {
        referenceId: referenceId,
      })
      .orderBy('twilioMessage.dateCreated', 'DESC')
      .getRawMany();

    if (
      messageHistoryArray.length === 1 &&
      messageHistoryArray[0].created === null
    ) {
      return [];
    }
    return messageHistoryArray;
  }

  public addProgramCustomAttributesToRow(
    row: object,
    registrationData: RegistrationDataEntity[],
    programCustomAttributes: ProgramCustomAttributeEntity[],
  ): object {
    for (const programCustomAttribute of programCustomAttributes) {
      const regisrationDataEntry = registrationData.find(
        d => d.programCustomAttributeId === programCustomAttribute.id,
      );

      if (programCustomAttribute.type === CustomAttributeType.boolean) {
        row[programCustomAttribute.name] = regisrationDataEntry.value || false;
      } else {
        row[programCustomAttribute.name] = regisrationDataEntry.value;
      }
    }
    return row;
  }

  public addDeprecatedCustomDataKeysToRow(
    row: object,
    customData: object,
    deprecatedCustomDataKeys: string[],
  ): object {
    /// TODO refeactor this code
    for (const key of deprecatedCustomDataKeys) {
      row[key] = customData[key];
    }
    return row;
  }

  public mapAttributeByType(
    attribute: Attribute,
    customData: any,
  ): string | number | boolean {
    const value = customData[attribute.name];
    switch (attribute.type) {
      case AttributeType.numeric:
        return Number(value) || 0;
      case AttributeType.boolean:
        return value ? JSON.parse(value) : false;
      default:
        return value || '';
    }
  }
}
