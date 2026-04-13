export interface SmitheryServer {
  qualifiedName: string;
  displayName: string;
  description: string;
  iconUrl: string;
  homepage: string;
  useCount: number;
  verified: boolean;
  isDeployed: boolean;
}

export interface SmitheryResponse {
  servers: SmitheryServer[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
  };
}

export async function fetchSmitheryServers(
  page: number = 1, 
  searchQuery?: string,
  verified?: boolean,
  isDeployed?: boolean
): Promise<SmitheryResponse> {
  const url = new URL('/api/smithery', window.location.origin);
  url.searchParams.append('page', page.toString());
  if (searchQuery) {
    url.searchParams.append('search', searchQuery);
  }
  if (verified !== undefined) {
    url.searchParams.append('verified', verified.toString());
  }
  if (isDeployed !== undefined) {
    url.searchParams.append('isDeployed', isDeployed.toString());
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to fetch MCP servers from Smithery');
  }

  return response.json();
}
