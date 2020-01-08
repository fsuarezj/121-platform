import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

import { Program } from '../models/program.model';
import { ProgramFunds } from '../models/program-funds.model';

@Injectable({
  providedIn: 'root',
})
export class ProgramsServiceApiService {
  constructor(
    private apiService: ApiService,
  ) { }

  login(email: string, password: string): Observable<any> {
    console.log('ProgramsService : login()');

    return this.apiService.post(
      environment.url_121_service_api,
      '/user/login',
      {
        email,
        password
      },
      true
    ).pipe(
      tap((response) => console.log(response)),
    );
  }

  getAllPrograms(): Observable<Program[]> {
    return this.apiService.get(
      environment.url_121_service_api,
      '/programs'
    ).pipe(
      tap((response) => console.log(response)),
      map((response) => {
        return response.programs;
      })
    );
  }

  getProgramById(programId: number | string): Observable<Program> {
    return this.apiService.get(
      environment.url_121_service_api,
      `/programs/${programId}`,
    ).pipe(
      tap((response) => console.log(response)),
      map((response) => response),
    );
  }

  getFundsById(programId: number | string): Promise<ProgramFunds> {
    return this.apiService.get(
      environment.url_121_service_api,
      `/programs/funds/${programId}`,
    ).pipe(
      tap((response) => console.log(response)),
      map((response) => response),
    ).toPromise();
  }

  getTotalIncluded(programId: number | string): Promise<number> {
    return this.apiService.get(
      environment.url_121_service_api,
      `/programs/total-included/${programId}`,
    ).pipe(
      tap((response) => console.log(response)),
      map((response) => response),
    ).toPromise();
  }

  submitPayout(programId: number, amount: number): Promise<any> {
    return this.apiService.post(
      environment.url_121_service_api,
      `/programs/payout`,
      {
        programId,
        amount,
      },
    ).pipe(
      tap((response) => console.log(response)),
      map((response) => response),
    ).toPromise();
  }

  getEnrolled(programId: number | string): Observable<any> {
    return this.apiService.get(
      environment.url_121_service_api,
      `/programs/enrolled/${programId}`,
    ).pipe(
      tap((response) => console.log(response)),
      map((response) => response),
    );
  }

  include(programId: number | string, dids: string): Promise<any> {
    return this.apiService.post(
      environment.url_121_service_api,
      `/programs/include/${programId}`,
      {
        dids
      },
    ).pipe(
      tap((response) => console.log(response)),
      map((response) => response),
    ).toPromise();
  }
}
