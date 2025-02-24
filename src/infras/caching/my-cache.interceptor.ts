import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class MyCacheInterceptor extends CacheInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    return next.handle().pipe(
      tap((response) => {
        // Check if the response meets your criteria for caching
        // For example, you might want to cache only successful responses
        if (this.shouldCache(response)) {
          super.intercept(context, next); // Proceed with caching
        }
      }),
      catchError((error) => {
        // Handle the error, maybe log it
        // Avoid caching by not calling super.intercept
        return throwError(() => error);
      }),
    );
  }

  private shouldCache(response: any): boolean {
    return !!response;
  }
}
