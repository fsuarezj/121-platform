import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { User } from 'src/app/models/user.model';
import { UserStateComponent } from './user-state.component';

describe('UserStateComponent', () => {
  let component: UserStateComponent;
  let fixture: ComponentFixture<UserStateComponent>;

  const mockUser: User = {
    token: 'test',
    email: 'test@example.org',
    role: 'test',
  };
  const authServiceMock = {
    authenticationState$: of(mockUser),
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [UserStateComponent],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
      imports: [TranslateModule.forRoot()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the e-mail address of a logged-in user', () => {
    expect(fixture.nativeElement.innerHTML).toContain(mockUser.email);
  });
});
