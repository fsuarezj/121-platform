import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import Permission from 'src/app/auth/permission.enum';
import { User } from 'src/app/models/user.model';
import { UserStateComponent } from './user-state.component';

describe('UserStateComponent', () => {
  let component: UserStateComponent;
  let fixture: ComponentFixture<UserStateComponent>;

  const mockUser: User = {
    username: 'test@example.org',
    permissions: [Permission.Test],
    expires: Date().toString(),
  };
  const authServiceMock = {
    authenticationState$: of(mockUser),
  };

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [UserStateComponent],
        providers: [
          {
            provide: AuthService,
            useValue: authServiceMock,
          },
        ],
        imports: [TranslateModule.forRoot(), RouterTestingModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      }).compileComponents();
    }),
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(UserStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the e-mail address of a logged-in user', () => {
    expect(fixture.nativeElement.innerHTML).toContain(mockUser.username);
  });
});
