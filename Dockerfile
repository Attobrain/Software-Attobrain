FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js engine.js realtime.js live.js live.html live.css styles.css navigation.js app.js index.html runtime-config.js ./
COPY src ./src
COPY public ./public
COPY assets ./assets
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["npm", "start"]
