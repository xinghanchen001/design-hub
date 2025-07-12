import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  generateStoragePath,
  getBucketName,
} from '../_shared/storage-utils.ts';

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
          project_id,
          name
        )
      `
      )
      .eq('generation_status', 'processing')
      .eq('content_type', 'design')
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

    const replicateApiKey = Deno.env.get('REPLICATE_API_KEY');
    if (!replicateApiKey) {
      throw new Error('Missing REPLICATE_API_KEY');
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

          // Download and store the generated image
          const imageUrl = prediction.output;
          if (imageUrl) {
            try {
              console.log(`⬇️ Downloading image from: ${imageUrl}`);
              const imageResponse = await fetch(imageUrl);
              if (!imageResponse.ok) {
                throw new Error(
                  `Failed to download image: ${imageResponse.statusText}`
                );
              }

              const imageBuffer = await imageResponse.arrayBuffer();

              // Get project_id from schedule or use content's project_id
              const projectId =
                content.schedules?.project_id ||
                content.project_id ||
                'default-project';

              // Generate consistent storage path using utility
              const fileName = generateStoragePath({
                userId: content.user_id,
                projectId: projectId,
                projectType: 'print-on-shirt',
                timestamp: Date.now(),
              });

              console.log(`📤 Uploading to storage: ${fileName}`);
              const bucketName = getBucketName('generated');
              const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileName, imageBuffer, {
                  contentType: 'image/png',
                  upsert: false,
                });

              if (uploadError) {
                console.error(`❌ Storage upload error:`, uploadError);
                throw uploadError;
              }

              // Get public URL
              const {
                data: { publicUrl },
              } = supabase.storage.from(bucketName).getPublicUrl(fileName);

              console.log(`🔗 Public URL: ${publicUrl}`);

              // Update database record
              const updatedMetadata = {
                ...metadata,
                replicate_output_url: imageUrl,
                generation_time_seconds: metadata.generation_time_seconds || 0,
                prediction_id: predictionId,
              };

              const { error: updateError } = await supabase
                .from('generated_content')
                .update({
                  generation_status: 'completed',
                  content_url: publicUrl,
                  storage_path: fileName,
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
                `❌ Error downloading/storing image:`,
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
