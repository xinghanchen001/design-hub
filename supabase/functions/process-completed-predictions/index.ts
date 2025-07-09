import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

    // Get all processing images with prediction IDs
    const { data: processingImages, error: fetchError } = await supabase
      .from('print_on_shirt_images')
      .select('*')
      .eq('status', 'processing')
      .not('prediction_id', 'is', null);

    if (fetchError) {
      console.error('❌ Error fetching processing images:', fetchError);
      throw fetchError;
    }

    if (!processingImages || processingImages.length === 0) {
      console.log('ℹ️ No processing images found');
      return new Response(
        JSON.stringify({ message: 'No processing images found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${processingImages.length} processing image(s)`);

    const replicateApiKey = Deno.env.get('REPLICATE_API_KEY');
    if (!replicateApiKey) {
      throw new Error('Missing REPLICATE_API_KEY');
    }

    let completedCount = 0;
    let failedCount = 0;

    for (const image of processingImages) {
      try {
        console.log(`🔍 Checking prediction: ${image.prediction_id}`);

        // Check prediction status from Replicate
        const predictionResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${image.prediction_id}`,
          {
            headers: {
              Authorization: `Token ${replicateApiKey}`,
            },
          }
        );

        if (!predictionResponse.ok) {
          console.error(
            `❌ Failed to get prediction status for ${image.prediction_id}`
          );
          continue;
        }

        const prediction = await predictionResponse.json();
        console.log(
          `📊 Prediction ${image.prediction_id} status: ${prediction.status}`
        );

        if (prediction.status === 'succeeded') {
          console.log(
            `✅ Prediction ${image.prediction_id} completed successfully`
          );

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
              const fileName = `${
                image.user_id
              }/${Date.now()}_print_on_shirt.png`;

              console.log(`📤 Uploading to storage: ${fileName}`);
              const { error: uploadError } = await supabase.storage
                .from('ai-generated-images')
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
              } = supabase.storage
                .from('ai-generated-images')
                .getPublicUrl(fileName);

              console.log(`🔗 Public URL: ${publicUrl}`);

              // Update database record
              const { error: updateError } = await supabase
                .from('print_on_shirt_images')
                .update({
                  status: 'completed',
                  image_url: publicUrl,
                  storage_path: fileName,
                  replicate_output_url: imageUrl,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', image.id);

              if (updateError) {
                console.error(`❌ Error updating image record:`, updateError);
                throw updateError;
              }

              completedCount++;
              console.log(`✅ Successfully processed image: ${image.id}`);
            } catch (downloadError) {
              console.error(
                `❌ Error downloading/storing image:`,
                downloadError
              );

              // Update as failed
              await supabase
                .from('print_on_shirt_images')
                .update({
                  status: 'failed',
                  error_message: `Download/storage failed: ${downloadError.message}`,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', image.id);

              failedCount++;
            }
          } else {
            console.error(
              `❌ No output URL for prediction ${image.prediction_id}`
            );

            // Update as failed
            await supabase
              .from('print_on_shirt_images')
              .update({
                status: 'failed',
                error_message: 'No output URL from Replicate',
                completed_at: new Date().toISOString(),
              })
              .eq('id', image.id);

            failedCount++;
          }
        } else if (prediction.status === 'failed') {
          console.error(
            `❌ Prediction ${image.prediction_id} failed:`,
            prediction.error
          );

          // Update as failed
          const { error: updateError } = await supabase
            .from('print_on_shirt_images')
            .update({
              status: 'failed',
              error_message: prediction.error?.message || 'Generation failed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', image.id);

          if (updateError) {
            console.error(
              `❌ Error updating failed image record:`,
              updateError
            );
          }

          failedCount++;
        } else {
          console.log(
            `⏳ Prediction ${image.prediction_id} still ${prediction.status}`
          );
        }
      } catch (error) {
        console.error(`❌ Error processing image ${image.id}:`, error);

        // Update as failed
        await supabase
          .from('print_on_shirt_images')
          .update({
            status: 'failed',
            error_message: `Processing error: ${error.message}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', image.id);

        failedCount++;
      }
    }

    console.log(
      `🎉 Processing complete: ${completedCount} completed, ${failedCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processingImages.length} predictions`,
        completed: completedCount,
        failed: failedCount,
        total_checked: processingImages.length,
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
