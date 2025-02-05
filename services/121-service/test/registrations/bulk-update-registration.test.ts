import { SeedScript } from '@121-service/src/scripts/enum/seed-script.enum';
import { waitFor } from '@121-service/src/utils/waitFor.helper';
import { assertRegistrationBulkUpdate } from '@121-service/test/helpers/assert.helper';
import { patchProgram } from '@121-service/test/helpers/program.helper';
import {
  bulkUpdateRegistrationsCSV,
  importRegistrationsCSV,
  searchRegistrationByReferenceId,
} from '@121-service/test/helpers/registration.helper';
import {
  getAccessToken,
  resetDB,
} from '@121-service/test/helpers/utility.helper';

describe('Update attribute of multiple PAs via Bulk update', () => {
  const programIdOcw = 3;

  let accessToken: string;

  beforeEach(async () => {
    await resetDB(SeedScript.nlrcMultiple);
    accessToken = await getAccessToken();

    await importRegistrationsCSV(
      programIdOcw,
      './test-registration-data/test-registrations-OCW.csv',
      accessToken,
    );
  });

  it('Should bulk update and validate changed records', async () => {
    const registrationDataThatWillChangePa1 = {
      phoneNumber: '14155238880',
      fullName: 'updated name1',
      addressStreet: 'newStreet1',
      addressHouseNumber: '2',
      addressHouseNumberAddition: '',
      preferredLanguage: 'ar',
      paymentAmountMultiplier: 2,
      whatsappPhoneNumber: '14155238880',
    };
    const registrationDataThatWillChangePa2 = {
      phoneNumber: '14155238881',
      fullName: 'updated name 2',
      addressStreet: 'newStreet2',
      addressHouseNumber: '3',
      addressHouseNumberAddition: 'updated',
      preferredLanguage: 'nl',
      paymentAmountMultiplier: 3,
      whatsappPhoneNumber: '14155238881',
    };

    // Registration before patch
    const searchByReferenceIdBeforePatchPa1 =
      await searchRegistrationByReferenceId(
        '00dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );
    const pa1BeforePatch = searchByReferenceIdBeforePatchPa1.body.data[0];

    const searchByReferenceIdBeforePatchPa2 =
      await searchRegistrationByReferenceId(
        '01dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );
    const pa2BeforePatch = searchByReferenceIdBeforePatchPa2.body.data[0];

    // Act
    const bulkUpdateResult = await bulkUpdateRegistrationsCSV(
      programIdOcw,
      './test-registration-data/test-registrations-patch-OCW.csv',
      accessToken,
      'test-reason',
    );
    expect(bulkUpdateResult.statusCode).toBe(200);
    await waitFor(2000);

    const searchByReferenceIdAfterPatchPa1 =
      await searchRegistrationByReferenceId(
        '00dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );

    const pa1AfterPatch = searchByReferenceIdAfterPatchPa1.body.data[0];

    const searchByReferenceIdAfterPatchPa2 =
      await searchRegistrationByReferenceId(
        '01dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );

    const pa2AfterPatch = searchByReferenceIdAfterPatchPa2.body.data[0];

    // Assert
    assertRegistrationBulkUpdate(
      registrationDataThatWillChangePa1,
      pa1AfterPatch,
      pa1BeforePatch,
    );
    assertRegistrationBulkUpdate(
      registrationDataThatWillChangePa2,
      pa2AfterPatch,
      pa2BeforePatch,
    );
  });

  it('Should bulk update chosen FSP and validate changed records', async () => {
    const registrationDataThatWillChangePa1 = {
      financialServiceProviderName: 'Intersolve-voucher-whatsapp',
      programFinancialServiceProviderConfigurationId: 5,
      programFinancialServiceProviderConfigurationName:
        'Intersolve-voucher-whatsapp',
      programFinancialServiceProviderConfigurationLabel: {
        en: 'Albert Heijn voucher WhatsApp',
      },
    };
    const registrationDataThatWillChangePa2 = {
      financialServiceProviderName: 'Intersolve-visa',
      programFinancialServiceProviderConfigurationId: 6,
      programFinancialServiceProviderConfigurationName: 'Intersolve-visa',
      programFinancialServiceProviderConfigurationLabel: {
        en: 'Visa debit card',
      },
    };

    // Registration before patch
    const searchByReferenceIdBeforePatchPa1 =
      await searchRegistrationByReferenceId(
        '00dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );
    const pa1BeforePatch = searchByReferenceIdBeforePatchPa1.body.data[0];

    const searchByReferenceIdBeforePatchPa2 =
      await searchRegistrationByReferenceId(
        '01dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );
    const pa2BeforePatch = searchByReferenceIdBeforePatchPa2.body.data[0];

    // Act
    const bulkUpdateResult = await bulkUpdateRegistrationsCSV(
      programIdOcw,
      './test-registration-data/test-registrations-patch-OCW-chosen-FSP.csv',
      accessToken,
      'test-reason',
    );
    expect(bulkUpdateResult.statusCode).toBe(200);
    await waitFor(2000);

    const searchByReferenceIdAfterPatchPa1 =
      await searchRegistrationByReferenceId(
        '00dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );

    const pa1AfterPatch = searchByReferenceIdAfterPatchPa1.body.data[0];

    const searchByReferenceIdAfterPatchPa2 =
      await searchRegistrationByReferenceId(
        '01dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );

    const pa2AfterPatch = searchByReferenceIdAfterPatchPa2.body.data[0];

    // Assert
    assertRegistrationBulkUpdate(
      registrationDataThatWillChangePa1,
      pa1AfterPatch,
      pa1BeforePatch,
    );
    assertRegistrationBulkUpdate(
      registrationDataThatWillChangePa2,
      pa2AfterPatch,
      pa2BeforePatch,
    );
  });

  it('Should bulk update if phoneNumber column is empty and program is configured as allowing empty phone number', async () => {
    const registrationDataThatWillChangePa1 = {
      fullName: 'updated name1',
      addressStreet: 'newStreet1',
      addressHouseNumber: '2',
      addressHouseNumberAddition: '',
      preferredLanguage: 'ar',
      paymentAmountMultiplier: 2,
      phoneNumber: '14155238880',
    };
    const registrationDataThatWillChangePa2 = {
      fullName: 'updated name 2',
      addressStreet: 'newStreet2',
      addressHouseNumber: '3',
      addressHouseNumberAddition: 'updated',
      preferredLanguage: 'nl',
      paymentAmountMultiplier: 3,
      phoneNumber: null,
    };
    await patchProgram(
      programIdOcw,
      { allowEmptyPhoneNumber: true },
      accessToken,
    );

    // Registration before patch
    const searchByReferenceIdBeforePatchPa1 =
      await searchRegistrationByReferenceId(
        '00dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );
    const pa1BeforePatch = searchByReferenceIdBeforePatchPa1.body.data[0];

    const searchByReferenceIdBeforePatchPa2 =
      await searchRegistrationByReferenceId(
        '17dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );
    const pa2BeforePatch = searchByReferenceIdBeforePatchPa2.body.data[0];

    // Act
    const bulkUpdateResult = await bulkUpdateRegistrationsCSV(
      programIdOcw,
      './test-registration-data/test-registrations-patch-OCW-without-phoneNumber-column.csv',
      accessToken,
      'test-reason',
    );
    expect(bulkUpdateResult.statusCode).toBe(200);

    await waitFor(2000);

    const searchByReferenceIdAfterPatchPa1 =
      await searchRegistrationByReferenceId(
        '00dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );
    const pa1AfterPatch = searchByReferenceIdAfterPatchPa1.body.data[0];

    const searchByReferenceIdAfterPatchPa2 =
      await searchRegistrationByReferenceId(
        '17dc9451-1273-484c-b2e8-ae21b51a96ab',
        programIdOcw,
        accessToken,
      );
    const pa2AfterPatch = searchByReferenceIdAfterPatchPa2.body.data[0];

    // Assert
    assertRegistrationBulkUpdate(
      registrationDataThatWillChangePa1,
      pa1AfterPatch,
      pa1BeforePatch,
    );
    assertRegistrationBulkUpdate(
      registrationDataThatWillChangePa2,
      pa2AfterPatch,
      pa2BeforePatch,
    );
  });
});
