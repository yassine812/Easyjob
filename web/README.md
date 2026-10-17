This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### EasyJob local ports

- Development frontend: `http://localhost:3000`.
- Development API (started by `predev`): `http://127.0.0.1:3002`.
- Docker staging API diagnostic port: `http://127.0.0.1:3003` (internal container port remains 3000).
- Docker staging web diagnostic port: `http://127.0.0.1:3001`.

Run only one `npm run dev` instance. `EADDRINUSE` means a server already owns the port; use that instance, or stop it with Ctrl+C in its terminal before restarting. Do not move the development frontend to 3001. If the browser returns a NestJS `Cannot GET /company/...` JSON response, check for an old Docker API binding to host port 3000. After updating the staging compose configuration, recreate only its API service using the same project name and environment file; no database reset is needed.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
