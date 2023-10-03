import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { ProgramsServiceApiService } from 'src/app/services/programs-service-api.service';
import { SharedModule } from 'src/app/shared/shared.module';
import { SuccessPopupComponent } from '../success-popup/success-popup.component';

@Component({
  selector: 'app-program-team-popup',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    SharedModule,
    TranslateModule,
    FormsModule,
  ],
  templateUrl: './program-team-popup.component.html',
  styleUrls: ['./program-team-popup.component.scss'],
})
export class ProgramTeamPopupComponent implements OnInit {
  programId;
  userId;
  searchQuery: string = '';
  searchResults: any[] = [];
  rolesList: any[] = [];
  selectedRoles: any[] = [];
  showSearchResults: boolean;
  addButtonDisabled = true;

  constructor(
    private modalController: ModalController,
    private programsServiceApiService: ProgramsServiceApiService,
  ) {}

  public async search(event: CustomEvent) {
    const searchTerm = event.detail.value.toLowerCase();
    this.searchResults = await this.programsServiceApiService.getUsersByName(
      this.programId,
      searchTerm,
    );
    this.searchResults.length > 0 && searchTerm !== ''
      ? (this.showSearchResults = true)
      : (this.showSearchResults = false);
  }

  isFormComplete(): boolean {
    return this.searchQuery !== '' && this.selectedRoles.length !== 0;
  }

  updateSearchbarValue(selectedItem: string, userId: number) {
    this.searchQuery = selectedItem;
    this.userId = userId;
    this.showSearchResults = false;
  }

  public async getRoles() {
    this.rolesList = await this.programsServiceApiService.getRoles();
  }

  public async assignTeamMember() {
    try {
      await this.programsServiceApiService.assignAidworker(
        this.programId,
        this.userId,
        this.selectedRoles,
      );
      this.closeModal();
      this.successPopup(event);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  ngOnInit() {
    this.getRoles();
  }

  public async successPopup(e: Event) {
    event = e;
    const modal: HTMLIonModalElement = await this.modalController.create({
      component: SuccessPopupComponent,
      componentProps: { programId: this.programId },
    });
    await modal.present();
    window.setTimeout(() => {
      modal.dismiss();
    }, 3000);
  }

  public closeModal() {
    this.modalController.dismiss();
  }
}
