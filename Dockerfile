FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/data/uploads && chown -R node:node /app/data
USER node
EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate && if [ \"$SEED_DEMO\" = \"true\" ]; then npm run db:seed; fi && npm start"]
