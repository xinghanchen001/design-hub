/**
 * Storage utility functions for consistent path generation across all projects
 */

export type ProjectType = 'project1' | 'project2' | 'project3';

export interface StoragePathOptions {
  userId: string;
  projectId: string;
  projectType: ProjectType;
  timestamp?: number;
  filename?: string;
  fileExtension?: string;
}

/**
 * Generate consistent storage paths for different project types
 */
export function generateStoragePath(options: StoragePathOptions): string {
  const { userId, projectId, projectType, timestamp, filename, fileExtension } =
    options;
  const ts = timestamp || Date.now();

  switch (projectType) {
    case 'project1':
      // Project 1 (Image Generation): user_id/project1/project_id/generated_timestamp.png
      return `${userId}/project1/${projectId}/generated_${ts}.png`;

    case 'project2':
      // Project 2 (Print on Shirt): user_id/project2/project_id/print_on_shirt_timestamp.png
      return `${userId}/project2/${projectId}/print_on_shirt_${ts}.png`;

    case 'project3':
      // Project 3 (Journal): user_id/project3/project_id/journal_timestamp.png
      return `${userId}/project3/${projectId}/journal_${ts}.png`;

    default:
      throw new Error(`Unknown project type: ${projectType}`);
  }
}

/**
 * Generate storage paths for user input images
 */
export function generateUserImagePath(options: {
  userId: string;
  projectId: string;
  imageType: 'reference' | 'input';
  timestamp?: number;
  imageNumber?: number;
  fileExtension?: string;
}): string {
  const {
    userId,
    projectId,
    imageType,
    timestamp,
    imageNumber,
    fileExtension,
  } = options;
  const ts = timestamp || Date.now();
  const ext = fileExtension || 'png';

  if (imageType === 'reference') {
    return `${userId}/reference/${projectId}/reference_${ts}.${ext}`;
  } else {
    const imgNum = imageNumber || 1;
    return `${userId}/inputs/${projectId}/input_${imgNum}_${ts}.${ext}`;
  }
}

/**
 * Parse storage path to extract project information
 */
export function parseStoragePath(path: string): {
  userId: string;
  projectType?: ProjectType;
  projectId?: string;
  filename: string;
} {
  const parts = path.split('/');

  if (parts.length < 2) {
    throw new Error(`Invalid storage path format: ${path}`);
  }

  const userId = parts[0];
  const filename = parts[parts.length - 1];

  // Check if it's a project-based path
  if (parts.length >= 4 && parts[1].startsWith('project')) {
    const projectType = parts[1] as ProjectType;
    const projectId = parts[2];
    return { userId, projectType, projectId, filename };
  }

  // Legacy format or user images
  return { userId, filename };
}

/**
 * Get bucket name for different content types
 */
export function getBucketName(contentType: 'generated' | 'user-input'): string {
  switch (contentType) {
    case 'generated':
      return 'ai-generated-images';
    case 'user-input':
      return 'user-images';
    default:
      throw new Error(`Unknown content type: ${contentType}`);
  }
}

/**
 * Migration helper: Convert legacy path to new project-based path
 */
export function migrateLegacyPath(
  legacyPath: string,
  projectId: string,
  projectType: ProjectType
): string {
  const parsed = parseStoragePath(legacyPath);

  // If already in new format, return as is
  if (parsed.projectType && parsed.projectId) {
    return legacyPath;
  }

  // Convert legacy format to new format
  const timestamp = Date.now();
  return generateStoragePath({
    userId: parsed.userId,
    projectId,
    projectType,
    timestamp,
  });
}
