import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('pageSize') || '20';
  const search = searchParams.get('search');
  const verified = searchParams.get('verified');
  const isDeployed = searchParams.get('isDeployed');

  const apiUrl = new URL('https://api.smithery.ai/servers');
  apiUrl.searchParams.append('page', page);
  apiUrl.searchParams.append('page-size', pageSize);
  if (search) {
    apiUrl.searchParams.append('q', search);
  }
  if (verified === 'true') {
    apiUrl.searchParams.append('verified', 'true');
  }
  if (isDeployed === 'true') {
    apiUrl.searchParams.append('is-deployed', 'true');
  }

  try {
    const response = await fetch(apiUrl.toString(), {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Smithery' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Smithery proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
