import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Shared } from './shared';

describe('Shared', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shared],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ConfirmationService,
        {
          provide: ActivatedRoute,
          useValue: { data: of({ mode: 'with-me' }), queryParamMap: of(convertToParamMap({})) },
        },
      ],
    }).compileComponents();
  });

  it('should create the shared page', () => {
    const fixture = TestBed.createComponent(Shared);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
