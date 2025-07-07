import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

console.log('Starting journal-blog-post function');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface JournalBlogPost {
  id: string;
  title: string;
  system_prompt: string;
  user_prompt: string;
  ai_response: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create authenticated Supabase client
    const supabaseClient = await createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Handle GET request (fetch journal posts)
    if (req.method === 'GET') {
      const { data: posts, error: fetchError } = await supabaseClient
        .from('journal_blog_posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching journal posts:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch journal posts' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify({ data: posts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle POST request (create journal post)
    if (req.method === 'POST') {
      const { title, systemPrompt, userPrompt } = await req.json();

      if (!title || !systemPrompt || !userPrompt) {
        return new Response(
          JSON.stringify({
            error: 'Missing required fields: title, systemPrompt, userPrompt',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('Creating journal post with title:', title);

      // Call Together AI API with the user's fine-tuned model
      const togetherApiKey = Deno.env.get('TOGETHER_AI_API_KEY');
      if (!togetherApiKey) {
        console.error('TOGETHER_AI_API_KEY environment variable not set');
        return new Response(
          JSON.stringify({ error: 'AI service configuration error' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        console.log('Calling Together AI API...');

        const response = await fetch(
          'https://api.together.xyz/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${togetherApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model:
                'hanchenxing_8f2b/DeepSeek-R1-Distill-Llama-70B-german-journalist-v1-23f09862-73eb6e3b',
              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                {
                  role: 'user',
                  content: userPrompt,
                },
              ],
              max_tokens: 2048,
              temperature: 0.7,
              top_p: 0.9,
              stream: false,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Together AI API error:', response.status, errorText);

          // Check if it's a dedicated endpoint issue
          if (errorText.includes('dedicated_endpoint_not_running')) {
            console.log(
              'Dedicated endpoint not running, trying fallback model...'
            );

            // Try with a public model as fallback
            const fallbackResponse = await fetch(
              'https://api.together.xyz/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${togetherApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
                  messages: [
                    {
                      role: 'system',
                      content: systemPrompt,
                    },
                    {
                      role: 'user',
                      content: userPrompt,
                    },
                  ],
                  max_tokens: 2048,
                  temperature: 0.7,
                  top_p: 0.9,
                  stream: false,
                }),
              }
            );

            if (!fallbackResponse.ok) {
              const fallbackErrorText = await fallbackResponse.text();
              console.error(
                'Fallback model error:',
                fallbackResponse.status,
                fallbackErrorText
              );
              return new Response(
                JSON.stringify({
                  error: 'AI service unavailable. Please try again later.',
                }),
                {
                  status: 503,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                  },
                }
              );
            }

            const fallbackResult = await fallbackResponse.json();
            const aiResponse =
              fallbackResult.choices[0]?.message?.content ||
              'No response generated';

            console.log('Fallback AI response received, saving to database...');

            // Save to database
            const { data: newPost, error: insertError } = await supabaseClient
              .from('journal_blog_posts')
              .insert([
                {
                  title,
                  system_prompt: systemPrompt,
                  user_prompt: userPrompt,
                  ai_response:
                    aiResponse +
                    '\n\n[Note: Generated using fallback model as dedicated endpoint is not running]',
                  user_id: user.id,
                },
              ])
              .select()
              .single();

            if (insertError) {
              console.error('Error saving journal post:', insertError);
              return new Response(
                JSON.stringify({ error: 'Failed to save journal post' }),
                {
                  status: 500,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                  },
                }
              );
            }

            console.log('Journal post saved successfully');
            return new Response(JSON.stringify({ data: newPost }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(
            JSON.stringify({ error: `AI service error: ${response.status}` }),
            {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const result = await response.json();
        console.log('Together AI API response received');

        const aiResponse =
          result.choices[0]?.message?.content || 'No response generated';

        console.log('AI response received, saving to database...');

        // Save to database
        const { data: newPost, error: insertError } = await supabaseClient
          .from('journal_blog_posts')
          .insert([
            {
              title,
              system_prompt: systemPrompt,
              user_prompt: userPrompt,
              ai_response: aiResponse,
              user_id: user.id,
            },
          ])
          .select()
          .single();

        if (insertError) {
          console.error('Error saving journal post:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to save journal post' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log('Journal post saved successfully');
        return new Response(JSON.stringify({ data: newPost }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (aiError) {
        console.error('AI processing error:', aiError);
        return new Response(
          JSON.stringify({ error: 'Failed to process AI request' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to create authenticated supabase client
async function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options: any
) {
  const { createClient } = await import(
    'https://esm.sh/@supabase/supabase-js@2'
  );
  return createClient(supabaseUrl, supabaseKey, options);
}
