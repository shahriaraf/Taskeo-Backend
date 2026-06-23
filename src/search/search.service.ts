// src/search/search.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface SearchResults {
  tasks:    SearchTask[];
  projects: SearchProject[];
  total:    number;
}

interface SearchTask {
  id:          string;
  title:       string;
  description: string | null;
  status:      string;
  priority:    string;
  projectId:   string;
  project:     { id: string; name: string };
  type:        'task';
}

interface SearchProject {
  id:          string;
  name:        string;
  description: string | null;
  status:      string;
  type:        'project';
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  /**
   * Global search across tasks and projects.
   *
   * Uses PostgreSQL ILIKE (case-insensitive LIKE) with a "contains" match.
   * For production at scale, replace with PostgreSQL full-text search
   * (to_tsvector / to_tsquery) or Meilisearch for better ranking.
   *
   * Results are scoped to the user's accessible data:
   *  - Admins: all tasks and projects
   *  - Others: only projects they are a member of, and tasks in those projects
   */
  async search(
    query: string,
    userId: string,
    userRole: string,
    limit = 5,
  ): Promise<SearchResults> {
    if (!query || query.trim().length < 2) {
      return { tasks: [], projects: [], total: 0 };
    }

    const q = query.trim();
    const isAdmin = userRole === UserRole.admin;

    // ── Project filter ──────────────────────────────────
    const projectWhere: any = {
      OR: [
        { name:        { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
      ...(!isAdmin && {
        members: { some: { userId } },
      }),
    };

    // ── Task filter ─────────────────────────────────────
    const taskWhere: any = {
      parentId: null, // top-level tasks only
      OR: [
        { title:       { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
      ...(!isAdmin && {
        project: { members: { some: { userId } } },
      }),
    };

    const [tasks, projects] = await Promise.all([
      this.prisma.task.findMany({
        where: taskWhere,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id:          true,
          title:       true,
          description: true,
          status:      true,
          priority:    true,
          projectId:   true,
          project:     { select: { id: true, name: true } },
        },
      }),
      this.prisma.project.findMany({
        where: projectWhere,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id:          true,
          name:        true,
          description: true,
          status:      true,
        },
      }),
    ]);

    const typedTasks: SearchTask[]    = tasks.map((t) => ({ ...t, type: 'task' as const }));
    const typedProjects: SearchProject[] = projects.map((p) => ({ ...p, type: 'project' as const }));

    return {
      tasks:    typedTasks,
      projects: typedProjects,
      total:    typedTasks.length + typedProjects.length,
    };
  }
}
