import type { VercelRequest, VercelResponse } from '@vercel/node';

const BLOCKED_COUNTRIES = [
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

  // Limited countries
  'US',
  'PR',
  'AS',
  'GU',
  'MP',
  'VI',
];

export default function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  const countryHeader = req.headers['x-vercel-ip-country'];

  const country = Array.isArray(countryHeader)
    ? countryHeader[0]
    : countryHeader || '';

  const isBlocked = BLOCKED_COUNTRIES.includes(
    country.toUpperCase(),
  );

  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, max-age=0, must-revalidate',
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return res.status(200).json(isBlocked);
}
