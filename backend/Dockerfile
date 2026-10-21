FROM node:20-alpine AS build
WORKDIR /app
# Prisma 5 needs OpenSSL to pick the right query engine; recent Alpine images no longer include it.
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# Prisma 5 needs OpenSSL to pick the right query engine; recent Alpine images no longer include it.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
