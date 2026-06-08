export class ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;

  constructor(params: {
    success: boolean;
    message: string;
    data?: T;
    meta?: PaginationMeta;
  }) {
    this.success = params.success;
    this.message = params.message;
    this.data = params.data;
    this.meta = params.meta;
  }

  static success<T>(data: T, message = 'Success', meta?: PaginationMeta) {
    return new ApiResponse({ success: true, message, data, meta });
  }

  static error(message: string) {
    return new ApiResponse({ success: false, message });
  }
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}