FROM node:18-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --production
COPY server ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "app.js"]
