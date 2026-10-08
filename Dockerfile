# One container: builds the React site, then serves it and the Flask API together.
# Works on Render, Railway, Fly.io or anywhere that runs Docker.
FROM node:22-alpine AS web
WORKDIR /build
COPY app_site/web/package.json app_site/web/package-lock.json ./
RUN npm ci
COPY app_site/web/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /srv
RUN pip install --no-cache-dir "flask>=3.0" "mysql-connector-python>=8.0" "python-dotenv>=1.0" "gunicorn>=22.0"
COPY app_site/api ./app_site/api
COPY --from=web /build/dist ./app_site/web/dist
ENV PORT=10000 COOKIE_SECURE=1
EXPOSE 10000
CMD gunicorn --chdir app_site/api --workers 2 --threads 4 --timeout 60 --bind 0.0.0.0:${PORT} app:app
