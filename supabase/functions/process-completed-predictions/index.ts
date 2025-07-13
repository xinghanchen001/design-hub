import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Inline storage utilities to avoid import issues
type ProjectType =
  | 'image-generation'
  | 'print-on-shirt'
  | 'journal'
  | 'video-generation';

function generateStoragePath(options: {
  userId: string;
  projectId: string;
  projectType: ProjectType;
  timestamp?: number;
}): string {
  const { userId, projectId, projectType, timestamp } = options;
  const ts = timestamp || Date.now();

  switch (projectType) {
    case 'image-generation':
      return `${userId}/image-generation/${projectId}/generated_${ts}.png`;
    case 'print-on-shirt':
      return `${userId}/print-on-shirt/${projectId}/design_${ts}.png`;
    case 'journal':
      return `${userId}/journal/${projectId}/journal_${ts}.png`;
    case 'video-generation':
      return `${userId}/video-generation/${projectId}/video_${ts}.mp4`;
    default:
      throw new Error(`Unknown project type: ${projectType}`);
  }
}

function getBucketName(contentType: 'generated' | 'user-input'): string {
  switch (contentType) {
    case 'generated':
      return 'generated-images';
    case 'user-input':
      return 'user-bucket-images';
    default:
      throw new Error(`Unknown content type: ${contentType}`);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseServiceKey
    );

    console.log('🔍 Checking for completed predictions...');

    // Get all processing content with prediction IDs and related schedule info
    const { data: processingContent, error: fetchError } = await supabase
      .from('generated_content')
      .select(
        `
        *,
        schedules (
          id,
          task_id,
          name
        )
      `
      )
      .eq('generation_status', 'processing')
      .in('content_type', ['design', 'video'])
      .not('metadata->prediction_id', 'is', null);

    if (fetchError) {
      console.error('❌ Error fetching processing content:', fetchError);
      throw fetchError;
    }

    if (!processingContent || processingContent.length === 0) {
      console.log('ℹ️ No processing content found');
      return new Response(
        JSON.stringify({ message: 'No processing content found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `📋 Found ${processingContent.length} processing content item(s)`
    );

    const replicateApiKey = Deno.env.get('REPLICATE_API_TOKEN');
    if (!replicateApiKey) {
      throw new Error('Missing REPLICATE_API_TOKEN');
    }

    let completedCount = 0;
    let failedCount = 0;

    for (const content of processingContent) {
      try {
        const metadata = (content.metadata as any) || {};
        const predictionId = metadata.prediction_id;

        if (!predictionId) {
          console.log(`⚠️ No prediction ID found for content ${content.id}`);
          continue;
        }

        console.log(`🔍 Checking prediction: ${predictionId}`);

        // Check prediction status from Replicate
        const predictionResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${predictionId}`,
          {
            headers: {
              Authorization: `Token ${replicateApiKey}`,
            },
          }
        );

        if (!predictionResponse.ok) {
          console.error(
            `❌ Failed to get prediction status for ${predictionId}`
          );
          continue;
        }

        const prediction = await predictionResponse.json();
        console.log(
          `📊 Prediction ${predictionId} status: ${prediction.status}`
        );

        if (prediction.status === 'succeeded') {
          console.log(`✅ Prediction ${predictionId} completed successfully`);

          // Download and store the generated content (image or video)
          const contentUrl = prediction.output;
          if (contentUrl) {
            try {
              const isVideo = content.content_type === 'video';
              console.log(
                `⬇️ Downloading ${
                  isVideo ? 'video' : 'image'
                } from: ${contentUrl}`
              );

              const contentResponse = await fetch(contentUrl);
              if (!contentResponse.ok) {
                throw new Error(
                  `Failed to download ${isVideo ? 'video' : 'image'}: ${
                    contentResponse.statusText
                  }`
                );
              }

              const contentBuffer = await contentResponse.arrayBuffer();

              // Get task_id from schedule or use content's task_id
              const projectId =
                content.schedules?.task_id || content.task_id || 'default-task';

              // Generate consistent storage path using utility
              const taskType = content.task_type || 'default';
              const fileName = generateStoragePath({
                userId: content.user_id,
                projectId: projectId,
                projectType: taskType as ProjectType,
                timestamp: Date.now(),
              });

              // Determine content type and file extension
              const contentType = isVideo ? 'video/mp4' : 'image/png';
              const fileExtension = isVideo ? '.mp4' : '.png';
              const fileNameWithExt = fileName.endsWith(fileExtension)
                ? fileName
                : fileName + fileExtension;

              console.log(
                `📤 Uploading to storage: ${fileNameWithExt} (${contentType})`
              );
              const bucketName = getBucketName('generated');
              const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileNameWithExt, contentBuffer, {
                  contentType: contentType,
                  upsert: false,
                });

              if (uploadError) {
                console.error(`❌ Storage upload error:`, uploadError);
                throw uploadError;
              }

              // Get public URL
              const {
                data: { publicUrl },
              } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileNameWithExt);

              console.log(`🔗 Public URL: ${publicUrl}`);

              // Update database record
              const updatedMetadata = {
                ...metadata,
                replicate_output_url: contentUrl,
                generation_time_seconds: metadata.generation_time_seconds || 0,
                prediction_id: predictionId,
              };

              const { error: updateError } = await supabase
                .from('generated_content')
                .update({
                  generation_status: 'completed',
                  content_url: publicUrl,
                  storage_path: fileNameWithExt,
                  metadata: updatedMetadata,
                })
                .eq('id', content.id);

              if (updateError) {
                console.error(`❌ Error updating content record:`, updateError);
                throw updateError;
              }

              completedCount++;
              console.log(`✅ Successfully processed content: ${content.id}`);
            } catch (downloadError) {
              console.error(
                `❌ Error downloading/storing ${
                  content.content_type === 'video' ? 'video' : 'image'
                }:`,
                downloadError
              );

              // Update as failed
              const { error: failedUpdateError } = await supabase
                .from('generated_content')
                .update({
                  generation_status: 'failed',
                  metadata: {
                    ...((content.metadata as any) || {}),
                    error_message: `Download/storage failed: ${downloadError.message}`,
                  },
                })
                .eq('id', content.id);

              if (failedUpdateError) {
                console.error(
                  `❌ Error updating failed content record:`,
                  failedUpdateError
                );
              }

              failedCount++;
            }
          } else {
            console.error(`❌ No output URL for prediction ${predictionId}`);

            // Update as failed
            const { error: noOutputUpdateError } = await supabase
              .from('generated_content')
              .update({
                generation_status: 'failed',
                metadata: {
                  ...((content.metadata as any) || {}),
                  error_message: 'No output URL from Replicate',
                },
              })
              .eq('id', content.id);

            if (noOutputUpdateError) {
              console.error(
                `❌ Error updating no-output content record:`,
                noOutputUpdateError
              );
            }

            failedCount++;
          }
        } else if (prediction.status === 'failed') {
          console.error(
            `❌ Prediction ${predictionId} failed:`,
            prediction.error
          );

          // Update as failed
          const { error: updateError } = await supabase
            .from('generated_content')
            .update({
              generation_status: 'failed',
              metadata: {
                ...((content.metadata as any) || {}),
                error_message: prediction.error?.message || 'Generation failed',
              },
            })
            .eq('id', content.id);

          if (updateError) {
            console.error(
              `❌ Error updating failed content record:`,
              updateError
            );
          }

          failedCount++;
        } else {
          console.log(
            `⏳ Prediction ${predictionId} still ${prediction.status}`
          );
        }
      } catch (error) {
        console.error(`❌ Error processing content ${content.id}:`, error);

        // Update as failed
        const { error: processingUpdateError } = await supabase
          .from('generated_content')
          .update({
            generation_status: 'failed',
            metadata: {
              ...((content.metadata as any) || {}),
              error_message: `Processing error: ${error.message}`,
            },
          })
          .eq('id', content.id);

        if (processingUpdateError) {
          console.error(
            `❌ Error updating processing-error content record:`,
            processingUpdateError
          );
        }

        failedCount++;
      }
    }

    console.log(
      `🎉 Processing complete: ${completedCount} completed, ${failedCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processingContent.length} predictions`,
        completed: completedCount,
        failed: failedCount,
        total_checked: processingContent.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in process-completed-predictions:', error);
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
