import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    transpilePackages: ['@ccs/ui', '@ccs/supabase', '@ccs/logic'],
    images: {
        remotePatterns: [
            { hostname: '*.supabase.co' },
        ],
    },
};

export default nextConfig;
