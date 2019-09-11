import { Component } from '@angular/core';
import { PersonalComponent } from '../personal-component.interface';
import { PersonalComponents } from '../personal-components.enum';

import { ConversationService } from 'src/app/services/conversation.service';
import { ProgramsServiceApiService } from 'src/app/services/programs-service-api.service';
import { TranslateService } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';

import { Timeslot } from 'src/app/models/timeslot.model';
import { Program } from 'src/app/models/program.model';
import { PaAccountApiService } from 'src/app/services/pa-account-api.service';

@Component({
  selector: 'app-select-appointment',
  templateUrl: './select-appointment.component.html',
  styleUrls: ['./select-appointment.component.scss'],
})
export class SelectAppointmentComponent implements PersonalComponent {
  public isDisabled = false;

  public languageCode: string;
  public fallbackLanguageCode: string;
  public dateFormat = 'EEE, dd-MM-yyyy';
  public timeFormat = 'HH:mm';

  public ngo: string;

  public timeslots: Timeslot[];
  public timeslotChoice: number;
  public chosenTimeslot: Timeslot;

  public timeslotSubmitted: boolean;

  public confirmAction: string;

  public meetingDocuments: string[];

  public qrDataString: string;
  public qrDataShow = false;

  constructor(
    public conversationService: ConversationService,
    public programsService: ProgramsServiceApiService,
    public paAccountApiService: PaAccountApiService,
    public translate: TranslateService,
    public storage: Storage,
  ) {
    this.fallbackLanguageCode = this.translate.getDefaultLang();
  }

  ngOnInit() {
    this.getLanguageChoice();
    this.getProgram();
  }

  private getLanguageChoice() {
    this.storage.get('languageChoice').then(value => {
      this.languageCode = value;
    });
  }

  private getProgram() {
    this.storage.get('programChoice').then(programId => {
      this.getProgramProperties(programId);
      this.getTimeslots(programId);
    });
  }

  private getProgramProperties(programId) {
    this.programsService.getProgramById(programId).subscribe((response: Program) => {
      if (response.ngo) {
        this.ngo = response.ngo;
      }
      if (response.meetingDocuments) {
        const documents = this.mapLabelByLanguageCode(response.meetingDocuments);
        this.meetingDocuments = this.buildDocumentsList(documents);
      }
    });
  }

  private getTimeslots(programId: any) {
    this.programsService.getTimeslots(programId).subscribe((response: Timeslot[]) => {
      this.timeslots = response;
    });
  }

  private mapLabelByLanguageCode(property: any) {
    let label = property[this.languageCode];

    if (!label) {
      label = property[this.fallbackLanguageCode];
    }

    return label;
  }

  private buildDocumentsList(documents: string): string[] {
    return documents.split(';');
  }

  private storeTimeslot(timeslotChoice: any) {
    this.storage.set('timeslotChoice', timeslotChoice);
  }

  private getTimeslotById(timeslotId: number) {
    return this.timeslots.find((item: Timeslot) => item.id === timeslotId);
  }

  public changeTimeslot($event) {
    this.timeslotChoice = parseInt($event.detail.value, 10);
    this.timeslotSubmitted = false;

    this.chosenTimeslot = this.getTimeslotById(this.timeslotChoice);
    this.storeTimeslot(this.timeslotChoice);
  }

  public submitTimeslot() {
    this.timeslotSubmitted = true;
  }

  public changeConfirmAction($event) {
    this.confirmAction = $event.detail.value;
  }

  public submitConfirmAction(action: string) {
    // This needs a check on 'already confirmed for this did' (max 1 timeslot-selection allowed)
    if (action === 'confirm') {
      this.postAppointment(this.timeslotChoice, 'did:sov:1235j123lk5');
    } else if (action === 'change') {
      this.timeslotSubmitted = false;
      this.isDisabled = false;
    }
  }

  public postAppointment(timeslotId: number, did: string) {
    this.programsService.postAppointment(timeslotId, did).subscribe(() => {

      this.generateQrCode();

      this.complete();
    });
  }

  async generateQrCode() {
    const did = await this.paRetrieveData('did');
    let programId: number;
    await this.storage.get('programChoice').then((value: string) => {
      programId = parseInt(value, 10);
    });
    const qrData = { did, programId };
    console.log('generateQrCode()', qrData);

    if (qrData) {
      this.qrDataString = JSON.stringify(qrData);
      this.qrDataShow = true;
    }
  }

  // NOTE: This should become a shared function
  async paRetrieveData(variableName: string): Promise<any> {
    return await this.paAccountApiService.retrieve(variableName)
      .toPromise();
  }

  getNextSection() {
    console.log('Done!');
    return '';
  }

  complete() {
    this.isDisabled = true;
    this.conversationService.onSectionCompleted({
      name: PersonalComponents.selectAppointment,
      data: {
        timeslot: this.chosenTimeslot,
      },
      next: this.getNextSection(),
    });
  }
}
