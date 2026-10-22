import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Trash } from './trash';

describe('Trash', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Trash],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ConfirmationService,
      ],
    }).compileComponents();
  });

  it('should create the trash page', () => {
    const fixture = TestBed.createComponent(Trash);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
