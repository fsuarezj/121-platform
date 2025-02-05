import { test } from '@playwright/test';

import { AppRoutes } from '@121-portal/src/app/app-routes.enum';
import englishTranslations from '@121-portal/src/assets/i18n/en.json';
import { FinancialServiceProviders } from '@121-service/src/financial-service-providers/enum/financial-service-provider-name.enum';
import { getFinancialServiceProviderSettingByNameOrThrow } from '@121-service/src/financial-service-providers/financial-service-provider-settings.helpers';
import { SeedScript } from '@121-service/src/scripts/enum/seed-script.enum';
import NLRCProgram from '@121-service/src/seed-data/program/program-nlrc-ocw.json';
import { seedPaidRegistrations } from '@121-service/test/helpers/registration.helper';
import { resetDB } from '@121-service/test/helpers/utility.helper';
import { registrationsOCW } from '@121-service/test/registrations/pagination/pagination-data';

import Helpers from '../../../pages/Helpers/Helpers';
import HomePage from '../../../pages/Home/HomePage';
import LoginPage from '../../../pages/Login/LoginPage';
import RegistrationDetails from '../../../pages/RegistrationDetails/RegistrationDetailsPage';
import TableModule from '../../../pages/Table/TableModule';

const nlrcOcwProgrammeTitle = NLRCProgram.titlePortal.en;
const pageTitle = englishTranslations['registration-details'].pageTitle;
const status = englishTranslations.entity.registration.status.included;
const language =
  englishTranslations.page.program['program-people-affected'].language.nl;
const visaFsp = getFinancialServiceProviderSettingByNameOrThrow(
  FinancialServiceProviders.intersolveVisa,
).defaultLabel.en;

test.beforeEach(async ({ page }) => {
  await resetDB(SeedScript.nlrcMultiple);
  const programIdOCW = 3;
  const OcwProgramId = programIdOCW;

  await seedPaidRegistrations(registrationsOCW, OcwProgramId);

  // Login
  const loginPage = new LoginPage(page);
  await page.goto(AppRoutes.login);
  await loginPage.login(
    process.env.USERCONFIG_121_SERVICE_EMAIL_ADMIN,
    process.env.USERCONFIG_121_SERVICE_PASSWORD_ADMIN,
  );
});

test('[27492] View Personal information table', async ({ page }) => {
  const table = new TableModule(page);
  const registration = new RegistrationDetails(page);
  const homePage = new HomePage(page);

  await test.step('Should open PAs for registration', async () => {
    await homePage.navigateToProgramme(nlrcOcwProgrammeTitle);
  });

  await test.step('Should open first uploaded PA', async () => {
    await table.openFspProfile({ shouldIncludeVisa: true });
  });

  await test.step('Should validate PA profile includes Personal information with details', async () => {
    await registration.validateHeaderToContainText(pageTitle);
    // Reload the page to make asynchronous data available
    await page.reload();
    // Reload should be removed after fixing the issue with the data not being available https://dev.azure.com/redcrossnl/121%20Platform/_workitems/edit/27568
    await registration.validatePersonalInformationTable(
      'Luiz Garcia',
      status,
      await Helpers.getTodaysDate(),
      language,
      '+14155235555',
      visaFsp!,
    );
  });
});
