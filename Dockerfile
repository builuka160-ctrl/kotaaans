# Portable image: the API plus the frontend it serves, on any Docker host.
FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev

# The backend serves index.html, css/, js/, images/ and media/ itself, so the
# whole site runs from this one container.
COPY backend ./backend
COPY index.html sw.js robots.txt sitemap.xml ./
COPY css ./css
COPY js ./js
COPY images ./images
COPY media ./media

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "backend/server.js"]
