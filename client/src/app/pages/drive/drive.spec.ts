import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { convertToParamMap } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Drive } from './drive';

describe('Drive', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Drive],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ConfirmationService,
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({})) },
        },
      ],
    }).compileComponents();
  });

  it('should create the drive page', () => {
    const fixture = TestBed.createComponent(Drive);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
