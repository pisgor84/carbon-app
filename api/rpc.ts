export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders(),
          'Content-Type': 'application/json',
        },
      },
    );
  }

  try {
    const body = await req.text();

    const upstream = await fetch(
      'https://tokyo.fullnode.mainnet.coti.io/rpc',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(10000),
      },
    );

    const responseBody = await upstream.text();

    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'RPC proxy failed',
        message:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders(),
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
