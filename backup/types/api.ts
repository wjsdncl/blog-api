// API 공통 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: {
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  error?: string;
}

// API 에러 응답 타입
export interface ApiErrorResponse {
  success: false;
  error: string;
}

// API 성공 응답 타입
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

// 페이지네이션 쿼리 타입
export interface PaginationQuery {
  offset?: string | number;
  limit?: string | number;
  page?: string | number;
}

// 검색 쿼리 타입
export interface SearchQuery extends PaginationQuery {
  search?: string;
  category?: string;
  tag?: string;
  sort?: "latest" | "oldest" | "popular" | "views";
}
