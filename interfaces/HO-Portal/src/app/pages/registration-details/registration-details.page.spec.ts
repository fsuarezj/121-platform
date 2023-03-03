import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { RegistrationDetailsPage } from './registration-details.page';

describe('RegistrationDetailsComponent', () => {
  let component: RegistrationDetailsPage;
  let fixture: ComponentFixture<RegistrationDetailsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegistrationDetailsPage],
      imports: [RouterTestingModule, HttpClientTestingModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RegistrationDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
