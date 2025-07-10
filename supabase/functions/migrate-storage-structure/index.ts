import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  generateStoragePath,
  parseStoragePath,
  migrateLegacyPath,
} from '../_shared/storage-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface MigrationStats {
  schedulesUpdated: number;
  imagesReorganized: number;
  errors: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting storage structure migration...');

    // Initialize Supabase client with service role key
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseServiceKey
    );

    const stats: MigrationStats = {
      schedulesUpdated: 0,
      imagesReorganized: 0,
      errors: [],
    };

    // Step 1: Add project_id column to print_on_shirt_schedules table if it doesn't exist
    console.log(
      '📝 Adding project_id column to print_on_shirt_schedules table...'
    );
    try {
      // First, get a default project_id for existing schedules
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, user_id')
        .limit(1);

      if (projectsError) throw projectsError;

      const defaultProjectId = projects?.[0]?.id;
      if (!defaultProjectId) {
        console.log('⚠️ No projects found, skipping schedule migration');
      } else {
        // Update existing schedules to have a project_id
        // Note: This SQL will only work if the column already exists
        // You may need to run: ALTER TABLE print_on_shirt_schedules ADD COLUMN project_id uuid REFERENCES projects(id);
        console.log('🔄 Updating existing schedules with project_id...');

        const { data: schedules, error: schedulesError } = await supabase
          .from('print_on_shirt_schedules')
          .select('id, user_id');

        if (schedulesError) {
          console.error('Error fetching schedules:', schedulesError);
          stats.errors.push(
            `Failed to fetch schedules: ${schedulesError.message}`
          );
        } else if (schedules) {
          // Update each schedule with a project_id based on user_id
          for (const schedule of schedules) {
            // Find the first project for this user
            const { data: userProjects, error: userProjectsError } =
              await supabase
                .from('projects')
                .select('id')
                .eq('user_id', schedule.user_id)
                .limit(1);

            if (userProjectsError) {
              console.error(
                `Error fetching projects for user ${schedule.user_id}:`,
                userProjectsError
              );
              stats.errors.push(
                `Failed to fetch projects for user ${schedule.user_id}: ${userProjectsError.message}`
              );
              continue;
            }

            const projectId = userProjects?.[0]?.id || defaultProjectId;

            try {
              const { error: updateError } = await supabase
                .from('print_on_shirt_schedules')
                .update({ project_id: projectId })
                .eq('id', schedule.id);

              if (updateError) {
                console.error(
                  `Error updating schedule ${schedule.id}:`,
                  updateError
                );
                stats.errors.push(
                  `Failed to update schedule ${schedule.id}: ${updateError.message}`
                );
              } else {
                stats.schedulesUpdated++;
                console.log(
                  `✅ Updated schedule ${schedule.id} with project_id ${projectId}`
                );
              }
            } catch (error) {
              console.error(`Error updating schedule ${schedule.id}:`, error);
              stats.errors.push(
                `Failed to update schedule ${schedule.id}: ${error.message}`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in schedule migration:', error);
      stats.errors.push(`Schedule migration failed: ${error.message}`);
    }

    // Step 2: Reorganize existing images in storage buckets
    console.log('📁 Reorganizing existing images in storage...');

    // Migrate ai-generated-images bucket
    try {
      const { data: generatedImages, error: generatedImagesError } =
        await supabase.storage
          .from('ai-generated-images')
          .list('', { limit: 1000 });

      if (generatedImagesError) {
        console.error('Error listing generated images:', generatedImagesError);
        stats.errors.push(
          `Failed to list generated images: ${generatedImagesError.message}`
        );
      } else if (generatedImages) {
        console.log(
          `📸 Found ${generatedImages.length} generated images to process`
        );

        for (const file of generatedImages) {
          try {
            const oldPath = file.name;
            const parsed = parseStoragePath(oldPath);

            // Skip if already in new format
            if (parsed.projectType && parsed.projectId) {
              console.log(`⏭️ Skipping ${oldPath} - already in new format`);
              continue;
            }

            // Determine project type and ID based on filename
            let projectType: 'project1' | 'project2' = 'project1';
            let projectId = 'default-project';

            // If filename contains 'print_on_shirt', it's project2
            if (oldPath.includes('print_on_shirt')) {
              projectType = 'project2';
            }

            // Try to find the actual project_id for this user
            const { data: userProjects, error: userProjectsError } =
              await supabase
                .from('projects')
                .select('id')
                .eq('user_id', parsed.userId)
                .limit(1);

            if (!userProjectsError && userProjects?.[0]) {
              projectId = userProjects[0].id;
            }

            // Generate new path
            const newPath = generateStoragePath({
              userId: parsed.userId,
              projectId: projectId,
              projectType: projectType,
              timestamp: Date.now(),
            });

            // Copy file to new location
            const { error: copyError } = await supabase.storage
              .from('ai-generated-images')
              .copy(oldPath, newPath);

            if (copyError) {
              console.error(
                `Error copying ${oldPath} to ${newPath}:`,
                copyError
              );
              stats.errors.push(
                `Failed to copy ${oldPath} to ${newPath}: ${copyError.message}`
              );
              continue;
            }

            // Update database records that reference the old path
            if (projectType === 'project1') {
              const { error: updateError } = await supabase
                .from('generated_images')
                .update({ storage_path: newPath })
                .eq('storage_path', oldPath);

              if (updateError) {
                console.error(
                  `Error updating generated_images record for ${oldPath}:`,
                  updateError
                );
                stats.errors.push(
                  `Failed to update generated_images record for ${oldPath}: ${updateError.message}`
                );
              }
            } else {
              const { error: updateError } = await supabase
                .from('print_on_shirt_images')
                .update({ storage_path: newPath })
                .eq('storage_path', oldPath);

              if (updateError) {
                console.error(
                  `Error updating print_on_shirt_images record for ${oldPath}:`,
                  updateError
                );
                stats.errors.push(
                  `Failed to update print_on_shirt_images record for ${oldPath}: ${updateError.message}`
                );
              }
            }

            // Delete old file
            const { error: deleteError } = await supabase.storage
              .from('ai-generated-images')
              .remove([oldPath]);

            if (deleteError) {
              console.error(`Error deleting old file ${oldPath}:`, deleteError);
              stats.errors.push(
                `Failed to delete old file ${oldPath}: ${deleteError.message}`
              );
            } else {
              stats.imagesReorganized++;
              console.log(`✅ Reorganized ${oldPath} → ${newPath}`);
            }
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            stats.errors.push(
              `Failed to process file ${file.name}: ${error.message}`
            );
          }
        }
      }
    } catch (error) {
      console.error('Error in image reorganization:', error);
      stats.errors.push(`Image reorganization failed: ${error.message}`);
    }

    // Step 3: Migrate user-images bucket (input images)
    console.log('📁 Reorganizing user input images...');

    try {
      const { data: userImages, error: userImagesError } =
        await supabase.storage.from('user-images').list('', { limit: 1000 });

      if (userImagesError) {
        console.error('Error listing user images:', userImagesError);
        stats.errors.push(
          `Failed to list user images: ${userImagesError.message}`
        );
      } else if (userImages) {
        console.log(`📸 Found ${userImages.length} user images to process`);

        for (const file of userImages) {
          try {
            const oldPath = file.name;
            const parsed = parseStoragePath(oldPath);

            // Skip if already in new format (contains /reference/ or /inputs/)
            if (
              oldPath.includes('/reference/') ||
              oldPath.includes('/inputs/')
            ) {
              console.log(`⏭️ Skipping ${oldPath} - already in new format`);
              continue;
            }

            // Determine if it's a reference or input image
            let imageType: 'reference' | 'input' = 'input';
            let imageNumber = 1;

            if (oldPath.includes('reference')) {
              imageType = 'reference';
            } else if (oldPath.includes('input_2')) {
              imageNumber = 2;
            }

            // Try to find the actual project_id for this user
            let projectId = 'default-project';
            const { data: userProjects, error: userProjectsError } =
              await supabase
                .from('projects')
                .select('id')
                .eq('user_id', parsed.userId)
                .limit(1);

            if (!userProjectsError && userProjects?.[0]) {
              projectId = userProjects[0].id;
            }

            // Generate new path for user images
            const fileExt = oldPath.split('.').pop() || 'png';
            const newPath =
              imageType === 'reference'
                ? `${
                    parsed.userId
                  }/reference/${projectId}/reference_${Date.now()}.${fileExt}`
                : `${
                    parsed.userId
                  }/inputs/${projectId}/input_${imageNumber}_${Date.now()}.${fileExt}`;

            // Copy file to new location
            const { error: copyError } = await supabase.storage
              .from('user-images')
              .copy(oldPath, newPath);

            if (copyError) {
              console.error(
                `Error copying ${oldPath} to ${newPath}:`,
                copyError
              );
              stats.errors.push(
                `Failed to copy ${oldPath} to ${newPath}: ${copyError.message}`
              );
              continue;
            }

            // Update database records that reference the old path
            // Check projects table for reference images
            const { error: updateProjectError } = await supabase
              .from('projects')
              .update({ reference_image_url: newPath })
              .eq('reference_image_url', oldPath);

            if (updateProjectError) {
              console.error(
                `Error updating projects record for ${oldPath}:`,
                updateProjectError
              );
              stats.errors.push(
                `Failed to update projects record for ${oldPath}: ${updateProjectError.message}`
              );
            }

            // Check print_on_shirt_schedules table for input images
            const { error: updateScheduleError1 } = await supabase
              .from('print_on_shirt_schedules')
              .update({ input_image_1_url: newPath })
              .eq('input_image_1_url', oldPath);

            const { error: updateScheduleError2 } = await supabase
              .from('print_on_shirt_schedules')
              .update({ input_image_2_url: newPath })
              .eq('input_image_2_url', oldPath);

            if (updateScheduleError1 || updateScheduleError2) {
              console.error(
                `Error updating schedule records for ${oldPath}:`,
                updateScheduleError1 || updateScheduleError2
              );
              stats.errors.push(
                `Failed to update schedule records for ${oldPath}: ${
                  (updateScheduleError1 || updateScheduleError2).message
                }`
              );
            }

            // Delete old file
            const { error: deleteError } = await supabase.storage
              .from('user-images')
              .remove([oldPath]);

            if (deleteError) {
              console.error(`Error deleting old file ${oldPath}:`, deleteError);
              stats.errors.push(
                `Failed to delete old file ${oldPath}: ${deleteError.message}`
              );
            } else {
              stats.imagesReorganized++;
              console.log(`✅ Reorganized ${oldPath} → ${newPath}`);
            }
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            stats.errors.push(
              `Failed to process file ${file.name}: ${error.message}`
            );
          }
        }
      }
    } catch (error) {
      console.error('Error in user image reorganization:', error);
      stats.errors.push(`User image reorganization failed: ${error.message}`);
    }

    console.log('🎉 Migration completed!');
    console.log('📊 Migration Statistics:');
    console.log(`  - Schedules updated: ${stats.schedulesUpdated}`);
    console.log(`  - Images reorganized: ${stats.imagesReorganized}`);
    console.log(`  - Errors: ${stats.errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Storage structure migration completed',
        stats: stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in storage migration:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Check function logs for more information',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
