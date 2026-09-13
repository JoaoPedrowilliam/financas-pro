/**
 * Uma configuração, dois destinos.
 *
 * Por padrão o projeto roda como app Next completo (`next dev`, Vercel, Node):
 * a rota /api/cotacoes existe e as cotações atualizam de verdade.
 *
 * Com EXPORT_ESTATICO=1 ele vira um site estático para o GitHub Pages, que só
 * serve arquivos. Nesse modo:
 *  - não há servidor, então /api/cotacoes some (o workflow remove a pasta antes
 *    de compilar — route handler que lê a Request não sobrevive ao export);
 *  - o site fica numa subpasta (github.io/NOME-DO-REPO), daí o basePath;
 *  - a otimização de imagem precisa de servidor, então desliga.
 *
 * O condicional existe para que publicar no Pages não impeça subir na Vercel
 * depois com o mesmo commit.
 */
const exportEstatico = process.env.EXPORT_ESTATICO === '1';
const basePath = process.env.BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: exportEstatico,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  ...(exportEstatico
    ? {
        output: 'export',
        basePath,
        assetPrefix: basePath || undefined,
        // O Pages serve /rota/ como /rota/index.html; sem isso os links quebram.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
