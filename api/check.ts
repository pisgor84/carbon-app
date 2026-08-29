const NO_NO_COUNTRIES = [
  'BY',
  'BI',
  'CF',
  'CG',
  'CD',
  'CU',
  'GN',
  'GW',
  'IR',
  'IQ',
  'KP',
  'LB',
  'LY',
  'ML',
  'MM',
  'RU',
  'SO',
  'SS',
  'SD',
  'SY',
  'UA',
  'VE',
  'YE',
  'ZW',
];

const LIMITED_COUNTRIES = [
  'US',
  'PR',
  'AS',
  'GU',
  'MP',
  'VI',
];

const BLOCKED_COUNTRIES = [
  ...NO_NO_COUNTRIES,
  ...LIMITED_COUNTRIES,
];

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
      }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const country =
    request.headers.get('x-vercel-ip-country') || '';

  const isBlocked = BLOCKED_COUNTRIES.includes(country);

  return new Response(
    JSON.stringify(isBlocked),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control':
          'no-store, no-cache, max-age=0, must-revalidate',
        Expires: '0',
        Pragma: 'no-cache',
      },
    },
  );
}
