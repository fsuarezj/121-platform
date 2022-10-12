import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { ConversationService } from '../services/conversation.service';
import { SharedModule } from '../shared/shared.module';
import { DownloadDataComponent } from './download-data/download-data.component';
import { FindByPhoneComponent } from './find-by-phone/find-by-phone.component';
import { MainMenuComponent } from './main-menu/main-menu.component';
import { SelectProgramComponent } from './select-program/select-program.component';
import { UploadDataComponent } from './upload-data/upload-data.component';
import { ValidateFspComponent } from './validate-fsp/validate-fsp.component';
import { ValidateProgramComponent } from './validate-program/validate-program.component';

@NgModule({
  declarations: [
    MainMenuComponent,
    FindByPhoneComponent,
    ValidateProgramComponent,
    ValidateFspComponent,
    DownloadDataComponent,
    UploadDataComponent,
    SelectProgramComponent,
  ],
  imports: [CommonModule, SharedModule, FormsModule, ZXingScannerModule],
  exports: [
    MainMenuComponent,
    FindByPhoneComponent,
    ValidateProgramComponent,
    ValidateFspComponent,
    DownloadDataComponent,
    UploadDataComponent,
    SelectProgramComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [ConversationService],
})
export class ValidationComponentsModule {}
