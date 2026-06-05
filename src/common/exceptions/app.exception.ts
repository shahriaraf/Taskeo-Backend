// src/common/exceptions/app.exception.ts

import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly errorCode?: string,
  ) {
    super(
      {
        success: false,
        error: {
          code: errorCode || 'APP_ERROR',
          message,
        },
      },
      statusCode,
    );
  }
}

// Specific exceptions
export class DuplicateTaskException extends AppException {
  constructor() {
    super(
      'This task already exists in the project.',
      HttpStatus.CONFLICT,
      'DUPLICATE_TASK',
    );
  }
}

export class CompletedTaskReassignException extends AppException {
  constructor() {
    super(
      'Completed tasks cannot be reassigned.',
      HttpStatus.BAD_REQUEST,
      'COMPLETED_TASK_REASSIGN',
    );
  }
}

export class PastDeadlineException extends AppException {
  constructor() {
    super(
      'Please select a valid deadline.',
      HttpStatus.BAD_REQUEST,
      'PAST_DEADLINE',
    );
  }
}

export class NotProjectMemberException extends AppException {
  constructor() {
    super(
      'User is not a member of this project.',
      HttpStatus.FORBIDDEN,
      'NOT_PROJECT_MEMBER',
    );
  }
}

export class InsufficientPermissionsException extends AppException {
  constructor() {
    super(
      'You do not have permission to perform this action.',
      HttpStatus.FORBIDDEN,
      'INSUFFICIENT_PERMISSIONS',
    );
  }
}