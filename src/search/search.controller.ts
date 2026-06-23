// src/search/search.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Search')
@ApiBearerAuth('JWT-auth')
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  /**
   * GET /search?q=login&limit=5
   * Returns matching tasks and projects for the authenticated user.
   */
  @Get()
  @ApiOperation({ summary: 'Global search across tasks and projects' })
  @ApiQuery({ name: 'q',     type: String,  required: true,  description: 'Search query (min 2 chars)' })
  @ApiQuery({ name: 'limit', type: Number,  required: false, description: 'Max results per type (default 5)' })
  async search(
    @Query('q') query: string,
    @Query('limit') limit: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const results = await this.searchService.search(
      query,
      userId,
      userRole,
      limit ? parseInt(limit, 10) : 5,
    );
    return ApiResponse.success(results, `Found ${results.total} results`);
  }
}
